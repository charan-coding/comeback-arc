/**
 * Comeback Arc — Apps Script backend.
 *
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone with the link).
 * See the repo README for full setup steps. This file is the entire backend:
 * no services, no secret keys — just this script bound to a Google Sheet.
 *
 * All writes go through doPost with an `action` field in a JSON body. The client
 * sends the body as Content-Type: text/plain to avoid a CORS preflight request,
 * which Apps Script Web Apps cannot answer; we parse e.postData.contents as JSON
 * regardless of the declared content type.
 */

var SHEET_PLAYERS = 'Players';
var SHEET_HABITS = 'Habits';
var SHEET_LOGS = 'Logs';
var SHEET_CONFIG = 'Config';

var PLAYERS_HEADERS = ['playerId', 'name', 'class', 'passHash', 'createdAt'];
var HABITS_HEADERS = ['habitId', 'name', 'category', 'tier', 'weight', 'type', 'target', 'period', 'active', 'direction', 'unit', 'toleranceMinutes', 'group'];
var LOGS_HEADERS = ['date', 'playerId', 'habitId', 'value', 'done', 'updatedAt'];
var CONFIG_HEADERS = ['key', 'value'];

/**
 * Default habits. Keep this in sync with frontend/src/lib/habitDefs.ts — the
 * habitId values are referenced by id elsewhere (badges, demo data).
 */
var DEFAULT_HABITS = [
  ['workout_pushups', 'Workout: Pushups', 'Body', 'core', 1, 'counter', 50, 'daily', true, '', 'reps', '', 'workout'],
  ['workout_squats', 'Workout: Squats', 'Body', 'core', 1, 'counter', 50, 'daily', true, '', 'reps', '', 'workout'],
  ['workout_crunches', 'Workout: Crunches', 'Body', 'core', 1, 'counter', 50, 'daily', true, '', 'reps', '', 'workout'],
  ['workout_hang', 'Workout: Dead Hangs', 'Body', 'core', 1, 'duration', 300, 'daily', true, '', 'seconds', '', 'workout'],
  ['workout_cardio', 'Workout: Walk/Run', 'Body', 'core', 1, 'minutes', 30, 'daily', true, '', 'minutes', '', 'workout'],
  ['read', 'Read', 'Mind', 'bonus', 1, 'minutes', 30, 'daily', true, '', 'minutes', '', ''],
  ['bed_time', 'In Bed By 11:07pm', 'Discipline', 'core', 1, 'time', 1387, 'daily', true, '', '', 0, ''],
  ['wake_time', 'Wake By 7:00am', 'Discipline', 'core', 1, 'time', 420, 'daily', true, '', '', 0, ''],
  ['meals_cooked', 'Two Cooked Meals', 'Fuel', 'bonus', 1, 'count', 2, 'daily', true, '', '', '', ''],
  ['meds', 'Meds & Supplements', 'Discipline', 'bonus', 1, 'checklist', 1, 'daily', true, '', '', '', ''],
  ['protein', 'Protein 60g+', 'Fuel', 'core', 1, 'grams', 60, 'daily', true, '', 'g', '', ''],
  ['creatine', 'Creatine', 'Fuel', 'bonus', 1, 'checkbox', 1, 'daily', true, '', '', '', ''],
  ['screen_time', 'Screen Time Under 4h', 'Discipline', 'bonus', 1, 'hours', 4, 'daily', true, 'atMost', 'h', '', ''],
  ['no_sugar', 'No Sugar', 'Fuel', 'core', 1, 'cheatday', 1, 'daily', true, '', '', '', ''],
  ['portion_control', 'Portion Control', 'Fuel', 'bonus', 1, 'checkbox', 1, 'daily', true, '', '', '', ''],
  ['water', 'Water 2.5L+', 'Fuel', 'core', 1, 'litres', 2.5, 'daily', true, '', 'L', '', ''],
  ['fasting', 'Fasting Window Kept', 'Discipline', 'bonus', 1, 'checkbox', 1, 'daily', true, '', '', '', ''],
  ['study', 'Study 4-8h', 'Mind', 'core', 1, 'hours', 4, 'weekly', true, '', 'h', '', ''],
];

var DEFAULT_CONFIG_ROWS = [
  ['rolloverHour', '4'],
  ['backfillDays', '3'],
  ['cheatDayLimit', '1'],
  ['goodDayThreshold', '0.7'],
  ['coreWeightMultiplier', '2'],
  ['restTokensPerWeek', '1'],
  ['defaultEatingWindowHours', '8'],
  ['defaultSleepToleranceMinutes', '0'],
];

/** Run this once from the Apps Script editor (Run > setup) after creating the bound sheet. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_PLAYERS, PLAYERS_HEADERS);
  ensureSheet_(ss, SHEET_HABITS, HABITS_HEADERS);
  ensureSheet_(ss, SHEET_LOGS, LOGS_HEADERS);
  ensureSheet_(ss, SHEET_CONFIG, CONFIG_HEADERS);

  var habitsSheet = ss.getSheetByName(SHEET_HABITS);
  if (habitsSheet.getLastRow() < 2) {
    habitsSheet.getRange(2, 1, DEFAULT_HABITS.length, HABITS_HEADERS.length).setValues(DEFAULT_HABITS);
  }

  var configSheet = ss.getSheetByName(SHEET_CONFIG);
  var existingKeys = {};
  if (configSheet.getLastRow() >= 2) {
    var rows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < rows.length; i++) existingKeys[rows[i][0]] = true;
  }
  var toAppend = DEFAULT_CONFIG_ROWS.filter(function (r) { return !existingKeys[r[0]]; });
  if (!existingKeys['passphraseSalt']) {
    toAppend.push(['passphraseSalt', Utilities.getUuid()]);
  }
  if (toAppend.length > 0) {
    configSheet.getRange(configSheet.getLastRow() + 1, 1, toAppend.length, 2).setValues(toAppend);
  }

  Logger.log('Setup complete.');
}

// Columns that hold a logical "YYYY-MM-DD" date, vs. a full ISO timestamp. Sheets can
// silently auto-convert a text-looking date into a real Date cell; we both (a) force these
// columns to plain-text formatting up front and (b) re-normalize any Date cell we read back,
// so the API always returns the exact string shape the frontend expects either way.
var DATE_ONLY_FIELDS = { date: true, createdAt: true };
var TIMESTAMP_FIELDS = { updatedAt: true };

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  headers.forEach(function (header, i) {
    if (DATE_ONLY_FIELDS[header] || TIMESTAMP_FIELDS[header]) {
      sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
    }
  });
  return sheet;
}

function normalizeCell_(header, value) {
  if (!(value instanceof Date)) return value;
  if (DATE_ONLY_FIELDS[header]) return Utilities.formatDate(value, 'Etc/UTC', 'yyyy-MM-dd');
  if (TIMESTAMP_FIELDS[header]) return Utilities.formatDate(value, 'Etc/UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  return value.toISOString();
}

function sheetAsObjects_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(function (row) {
    var obj = {};
    for (var i = 0; i < headers.length; i++) obj[headers[i]] = normalizeCell_(headers[i], row[i]);
    return obj;
  });
}

function getConfigMap_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rows = sheetAsObjects_(ss.getSheetByName(SHEET_CONFIG));
  var map = {};
  rows.forEach(function (r) { map[r.key] = r.value; });
  return map;
}

function hashPassphrase_(passphrase, salt) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + passphrase);
  return digest.map(function (b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); }).join('');
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorOut_(message) {
  return jsonOut_({ ok: false, error: message });
}

function doGet(e) {
  var action = e.parameter.action || 'read';
  if (action !== 'read') return errorOut_('Unknown GET action: ' + action);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var players = sheetAsObjects_(ss.getSheetByName(SHEET_PLAYERS)).map(function (p) {
    return { playerId: p.playerId, name: p.name, class: p.class, createdAt: p.createdAt }; // never expose passHash
  });
  var habits = sheetAsObjects_(ss.getSheetByName(SHEET_HABITS));
  var logs = sheetAsObjects_(ss.getSheetByName(SHEET_LOGS));
  var config = sheetAsObjects_(ss.getSheetByName(SHEET_CONFIG));

  var since = e.parameter.since;
  if (since) {
    logs = logs.filter(function (l) { return String(l.updatedAt) > since; });
  }

  return jsonOut_({ ok: true, players: players, habits: habits, logs: logs, config: config });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return errorOut_('Invalid JSON body');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    switch (body.action) {
      case 'createPlayer':
        return createPlayer_(body);
      case 'login':
        return login_(body);
      case 'logHabit':
        return logHabit_(body);
      case 'logBatch':
        return logBatch_(body);
      case 'setHabitOverride':
        return setHabitOverride_(body);
      default:
        return errorOut_('Unknown action: ' + body.action);
    }
  } finally {
    lock.releaseLock();
  }
}

function createPlayer_(body) {
  if (!body.name || !body.passphrase || !body.class) return errorOut_('name, class and passphrase are required');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PLAYERS);
  var players = sheetAsObjects_(sheet);
  if (players.length >= 8) return errorOut_('Party is full (8 players max)');
  if (players.some(function (p) { return String(p.name).toLowerCase() === String(body.name).toLowerCase(); })) {
    return errorOut_('That name is already taken');
  }

  var config = getConfigMap_();
  var playerId = 'pl_' + Utilities.getUuid().slice(0, 8);
  var passHash = hashPassphrase_(body.passphrase, config.passphraseSalt);
  var createdAt = body.logicalDate || new Date().toISOString().slice(0, 10);

  sheet.appendRow([playerId, body.name, body.class, passHash, createdAt]);
  return jsonOut_({ ok: true, player: { playerId: playerId, name: body.name, class: body.class, createdAt: createdAt } });
}

function findPlayerRow_(playerId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PLAYERS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, PLAYERS_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === playerId) return { rowIndex: i + 2, data: values[i] };
  }
  return null;
}

function authenticate_(playerId, passphrase) {
  var row = findPlayerRow_(playerId);
  if (!row) return { ok: false, error: 'Unknown player' };
  var config = getConfigMap_();
  var expected = row.data[3];
  var actual = hashPassphrase_(passphrase, config.passphraseSalt);
  if (actual !== expected) return { ok: false, error: 'Wrong passphrase' };
  return { ok: true, row: row };
}

function login_(body) {
  var auth = authenticate_(body.playerId, body.passphrase);
  if (!auth.ok) return errorOut_(auth.error);
  var data = auth.row.data;
  return jsonOut_({ ok: true, player: { playerId: data[0], name: data[1], class: data[2], createdAt: data[4] } });
}

function upsertLog_(sheet, logsCache, date, playerId, habitId, value, updatedAt) {
  var done = !!value; // a coarse boolean kept for quick sheet-level inspection; scoring is recomputed client-side
  var key = date + '|' + playerId + '|' + habitId;
  var existing = logsCache[key];
  if (existing) {
    sheet.getRange(existing.rowIndex, 1, 1, LOGS_HEADERS.length).setValues([[date, playerId, habitId, value, done, updatedAt]]);
  } else {
    sheet.appendRow([date, playerId, habitId, value, done, updatedAt]);
  }
}

function buildLogsCache_(sheet) {
  var lastRow = sheet.getLastRow();
  var cache = {};
  if (lastRow < 2) return cache;
  var values = sheet.getRange(2, 1, lastRow - 1, LOGS_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var key = values[i][0] + '|' + values[i][1] + '|' + values[i][2];
    cache[key] = { rowIndex: i + 2 };
  }
  return cache;
}

function logHabit_(body) {
  var auth = authenticate_(body.playerId, body.passphrase);
  if (!auth.ok) return errorOut_(auth.error);
  if (!isWithinBackfillWindow_(body.date)) return errorOut_('Date is outside the editable backfill window');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOGS);
  var cache = buildLogsCache_(sheet);
  var updatedAt = new Date().toISOString();
  upsertLog_(sheet, cache, body.date, body.playerId, body.habitId, body.value, updatedAt);
  return jsonOut_({ ok: true, updatedAt: updatedAt });
}

function logBatch_(body) {
  var auth = authenticate_(body.playerId, body.passphrase);
  if (!auth.ok) return errorOut_(auth.error);
  if (!body.entries || !body.entries.length) return errorOut_('entries is required');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOGS);
  var cache = buildLogsCache_(sheet);
  var updatedAt = new Date().toISOString();
  var rejected = [];

  body.entries.forEach(function (entry) {
    if (!isWithinBackfillWindow_(entry.date)) {
      rejected.push(entry);
      return;
    }
    upsertLog_(sheet, cache, entry.date, body.playerId, entry.habitId, entry.value, updatedAt);
  });

  return jsonOut_({ ok: true, updatedAt: updatedAt, rejected: rejected });
}

/** Per-player overrides (habit target/active) are stored as Config rows: override.<playerId>.<habitId>.<field> */
function setHabitOverride_(body) {
  var auth = authenticate_(body.playerId, body.passphrase);
  if (!auth.ok) return errorOut_(auth.error);
  if (body.field !== 'target' && body.field !== 'active') return errorOut_('field must be target or active');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CONFIG);
  var key = 'override.' + body.playerId + '.' + body.habitId + '.' + body.field;
  var lastRow = sheet.getLastRow();
  var rowIndex = -1;
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) { rowIndex = i + 2; break; }
    }
  }
  var value = String(body.value);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 2).setValue(value);
  } else {
    sheet.appendRow([key, value]);
  }
  return jsonOut_({ ok: true });
}

/** Mirrors frontend/src/lib/day.ts's rollover + backfill logic using a fixed IST (+05:30) offset. */
function isWithinBackfillWindow_(dateStr) {
  var config = getConfigMap_();
  var rolloverHour = Number(config.rolloverHour || 4);
  var backfillDays = Number(config.backfillDays || 3);

  var now = new Date();
  var istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  var logicalMs = istMs - rolloverHour * 60 * 60 * 1000;
  var logical = new Date(logicalMs);
  var todayStr = Utilities.formatDate(logical, 'UTC', 'yyyy-MM-dd');

  var earliest = new Date(Date.parse(todayStr + 'T00:00:00Z'));
  earliest.setUTCDate(earliest.getUTCDate() - backfillDays);
  var target = new Date(Date.parse(dateStr + 'T00:00:00Z'));
  var todayDate = new Date(Date.parse(todayStr + 'T00:00:00Z'));

  return target.getTime() >= earliest.getTime() && target.getTime() <= todayDate.getTime();
}
