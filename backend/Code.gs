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
var SHEET_PUSH = 'PushSubscriptions';

var PLAYERS_HEADERS = ['playerId', 'name', 'class', 'passHash', 'createdAt'];
var HABITS_HEADERS = ['habitId', 'name', 'category', 'tier', 'weight', 'type', 'target', 'period', 'active', 'direction', 'unit', 'toleranceMinutes', 'group'];
var LOGS_HEADERS = ['date', 'playerId', 'habitId', 'value', 'done', 'updatedAt'];
var CONFIG_HEADERS = ['key', 'value'];
var PUSH_HEADERS = ['playerId', 'endpoint', 'p256dh', 'auth', 'reminderTimes', 'enabled', 'updatedAt'];

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
  // Shown as the VAPID JWT's "sub" claim (required by the Web Push spec so a push
  // service can contact the sender). Edit this Config row to your own contact if you want.
  ['vapidSubject', 'mailto:noreply@example.com'],
];

/** Run this once from the Apps Script editor (Run > setup) after creating the bound sheet. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_PLAYERS, PLAYERS_HEADERS);
  ensureSheet_(ss, SHEET_HABITS, HABITS_HEADERS);
  ensureSheet_(ss, SHEET_LOGS, LOGS_HEADERS);
  ensureSheet_(ss, SHEET_CONFIG, CONFIG_HEADERS);
  ensureSheet_(ss, SHEET_PUSH, PUSH_HEADERS);

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

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('vapidPrivateKey')) {
    var keyPair = generateVapidKeyPair_();
    props.setProperty('vapidPrivateKey', keyPair.privateKeyHex);
    Logger.log(
      'Generated a new VAPID key pair for push notifications.\n' +
        'Copy this PUBLIC key into frontend/.env as VITE_VAPID_PUBLIC_KEY ' +
        '(and, once redeployed, into the matching GitHub secret):\n' +
        keyPair.publicKeyB64Url
    );
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
      case 'registerPush':
        return registerPush_(body);
      case 'unregisterPush':
        return unregisterPush_(body);
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

function findPushRowIndex_(sheet, playerId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === playerId) return i + 2;
  }
  return -1;
}

/** One push subscription per player (last device registered wins), same upsert-by-key convention as Logs. */
function registerPush_(body) {
  var auth = authenticate_(body.playerId, body.passphrase);
  if (!auth.ok) return errorOut_(auth.error);
  if (!body.subscription || !body.subscription.endpoint || !body.subscription.keys) {
    return errorOut_('subscription is required');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PUSH);
  var rowIndex = findPushRowIndex_(sheet, body.playerId);
  var reminderTimes = (body.reminderTimes || []).join(',');
  var row = [
    body.playerId,
    body.subscription.endpoint,
    body.subscription.keys.p256dh,
    body.subscription.keys.auth,
    reminderTimes,
    true,
    new Date().toISOString(),
  ];
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return jsonOut_({ ok: true });
}

function unregisterPush_(body) {
  var auth = authenticate_(body.playerId, body.passphrase);
  if (!auth.ok) return errorOut_(auth.error);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PUSH);
  var rowIndex = findPushRowIndex_(sheet, body.playerId);
  if (rowIndex > 0) sheet.getRange(rowIndex, 6).setValue(false);
  return jsonOut_({ ok: true });
}

/** Fixed IST (+05:30, no DST) wall-clock minutes-of-day right now, mirroring frontend/src/lib/day.ts. */
function istMinutesNow_() {
  var istMs = new Date().getTime() + 5.5 * 60 * 60 * 1000;
  var ist = new Date(istMs);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** Today's logical "YYYY-MM-DD" date, rolled over at `rolloverHour` IST. */
function logicalToday_(rolloverHour) {
  var istMs = new Date().getTime() + 5.5 * 60 * 60 * 1000;
  var logicalMs = istMs - rolloverHour * 60 * 60 * 1000;
  return Utilities.formatDate(new Date(logicalMs), 'UTC', 'yyyy-MM-dd');
}

/** Mirrors frontend/src/lib/day.ts's rollover + backfill logic using a fixed IST (+05:30) offset. */
function isWithinBackfillWindow_(dateStr) {
  var config = getConfigMap_();
  var rolloverHour = Number(config.rolloverHour || 4);
  var backfillDays = Number(config.backfillDays || 3);
  var todayStr = logicalToday_(rolloverHour);

  var earliest = new Date(Date.parse(todayStr + 'T00:00:00Z'));
  earliest.setUTCDate(earliest.getUTCDate() - backfillDays);
  var target = new Date(Date.parse(dateStr + 'T00:00:00Z'));
  var todayDate = new Date(Date.parse(todayStr + 'T00:00:00Z'));

  return target.getTime() >= earliest.getTime() && target.getTime() <= todayDate.getTime();
}

// =====================================================================================
// Web Push (RFC 8030) + VAPID (RFC 8292), implemented from scratch because Apps Script
// has no ECDSA and we deliberately avoid any service that would need a service-account
// key (e.g. Firebase Cloud Messaging). Sends are payload-less (no RFC 8291 encryption,
// which would need ECDH+HKDF+AES-128-GCM on top of this) — the service worker shows a
// fixed reminder string. This whole section is a verbatim port of
// frontend/src/lib/vapid.ts, which is unit-tested against RFC 6979's own P-256/SHA-256
// test vectors; keep the two in sync if you ever touch the math.
//
// Apps Script's Utilities class returns/accepts Java-style SIGNED bytes (-128..127), so
// every call into it is wrapped with toSignedBytes_/toUnsignedBytes_ to work in the
// unsigned 0..255 domain everywhere else.
// =====================================================================================

var P256_P_ = BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF');
var P256_A_ = P256_P_ - 3n;
var P256_N_ = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551');
var P256_GX_ = BigInt('0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296');
var P256_GY_ = BigInt('0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5');
var P256_INFINITY_ = { x: -1n, y: -1n };

function toSignedBytes_(unsignedArr) {
  var out = new Array(unsignedArr.length);
  for (var i = 0; i < unsignedArr.length; i++) {
    var v = unsignedArr[i];
    out[i] = v > 127 ? v - 256 : v;
  }
  return out;
}

function toUnsignedBytes_(signedArr) {
  var out = new Array(signedArr.length);
  for (var i = 0; i < signedArr.length; i++) {
    var v = signedArr[i];
    out[i] = v < 0 ? v + 256 : v;
  }
  return out;
}

function asciiToBytes_(str) {
  var out = new Array(str.length);
  for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function bytesToHex_(bytes) {
  return bytes
    .map(function (b) {
      return (b < 16 ? '0' : '') + b.toString(16);
    })
    .join('');
}

function hexToBytes_(hex) {
  var out = [];
  for (var i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}

function bytesToBigInt_(bytes) {
  var hex = bytesToHex_(bytes);
  return BigInt(hex === '' ? '0x0' : '0x' + hex);
}

function bigIntToBytes_(n, length) {
  var hex = n.toString(16);
  while (hex.length < length * 2) hex = '0' + hex;
  return hexToBytes_(hex);
}

function sha256Bytes_(unsignedBytes) {
  var signedDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toSignedBytes_(unsignedBytes));
  return toUnsignedBytes_(signedDigest);
}

function hmacSha256Bytes_(keyUnsigned, dataUnsigned) {
  var signedSig = Utilities.computeHmacSha256Signature(toSignedBytes_(dataUnsigned), toSignedBytes_(keyUnsigned));
  return toUnsignedBytes_(signedSig);
}

function p256Mod_(a, m) {
  var r = a % m;
  return r < 0n ? r + m : r;
}

function p256ModInverse_(a, m) {
  var oldR = p256Mod_(a, m);
  var r = m;
  var oldS = 1n;
  var s = 0n;
  while (r !== 0n) {
    var q = oldR / r;
    var tr = oldR - q * r;
    oldR = r;
    r = tr;
    var ts = oldS - q * s;
    oldS = s;
    s = ts;
  }
  return p256Mod_(oldS, m);
}

function p256IsInfinity_(p) {
  return p.x === -1n && p.y === -1n;
}

function p256Double_(p) {
  if (p256IsInfinity_(p) || p.y === 0n) return P256_INFINITY_;
  var lambda = p256Mod_((3n * p.x * p.x + P256_A_) * p256ModInverse_(2n * p.y, P256_P_), P256_P_);
  var x3 = p256Mod_(lambda * lambda - 2n * p.x, P256_P_);
  var y3 = p256Mod_(lambda * (p.x - x3) - p.y, P256_P_);
  return { x: x3, y: y3 };
}

function p256Add_(p1, p2) {
  if (p256IsInfinity_(p1)) return p2;
  if (p256IsInfinity_(p2)) return p1;
  if (p1.x === p2.x) {
    if (p256Mod_(p1.y + p2.y, P256_P_) === 0n) return P256_INFINITY_;
    return p256Double_(p1);
  }
  var lambda = p256Mod_((p2.y - p1.y) * p256ModInverse_(p2.x - p1.x, P256_P_), P256_P_);
  var x3 = p256Mod_(lambda * lambda - p1.x - p2.x, P256_P_);
  var y3 = p256Mod_(lambda * (p1.x - x3) - p1.y, P256_P_);
  return { x: x3, y: y3 };
}

function p256ScalarMultiply_(k, point) {
  var result = P256_INFINITY_;
  var addend = point;
  var n = k;
  while (n > 0n) {
    if (n & 1n) result = p256Add_(result, addend);
    addend = p256Double_(addend);
    n >>= 1n;
  }
  return result;
}

/** RFC 6979 deterministic k, specialized for qlen === hlen === 256 bits (P-256 + SHA-256). */
function rfc6979Nonce_(privateKey, hash) {
  var z1 = bytesToBigInt_(hash);
  if (z1 >= P256_N_) z1 -= P256_N_;
  var int2octets = function (x) {
    return bigIntToBytes_(p256Mod_(x, P256_N_), 32);
  };
  var h1Octets = int2octets(z1);
  var xOctets = int2octets(privateKey);

  var V = new Array(32).fill(1);
  var K = new Array(32).fill(0);
  K = hmacSha256Bytes_(K, V.concat([0x00], xOctets, h1Octets));
  V = hmacSha256Bytes_(K, V);
  K = hmacSha256Bytes_(K, V.concat([0x01], xOctets, h1Octets));
  V = hmacSha256Bytes_(K, V);

  for (;;) {
    V = hmacSha256Bytes_(K, V);
    var k = bytesToBigInt_(V);
    if (k >= 1n && k < P256_N_) return k;
    K = hmacSha256Bytes_(K, V.concat([0x00]));
    V = hmacSha256Bytes_(K, V);
  }
}

/** Deterministic ECDSA sign over P-256/SHA-256 (RFC 6979). `messageBytes` is hashed internally. */
function ecdsaSignP256_(privateKeyHex, messageBytes) {
  var x = BigInt('0x' + privateKeyHex);
  var hash = sha256Bytes_(messageBytes);
  var k = rfc6979Nonce_(x, hash);
  var R = p256ScalarMultiply_(k, { x: P256_GX_, y: P256_GY_ });
  var r = p256Mod_(R.x, P256_N_);
  var e = bytesToBigInt_(hash);
  var kInv = p256ModInverse_(k, P256_N_);
  var s = p256Mod_(kInv * (e + r * x), P256_N_);
  return { r: r, s: s };
}

function privateKeyToPublicKeyBytes_(privateKeyHex) {
  var point = p256ScalarMultiply_(BigInt('0x' + privateKeyHex), { x: P256_GX_, y: P256_GY_ });
  return [0x04].concat(bigIntToBytes_(point.x, 32), bigIntToBytes_(point.y, 32));
}

function base64UrlFromBytes_(unsignedBytes) {
  return Utilities.base64EncodeWebSafe(toSignedBytes_(unsignedBytes)).replace(/=+$/, '');
}

function base64UrlFromString_(str) {
  return Utilities.base64EncodeWebSafe(str).replace(/=+$/, '');
}

function buildVapidJwt_(privateKeyHex, audience, subject, expirySeconds) {
  expirySeconds = expirySeconds || 12 * 60 * 60;
  var header = JSON.stringify({ typ: 'JWT', alg: 'ES256' });
  var payload = JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + expirySeconds, sub: subject });
  var signingInput = base64UrlFromString_(header) + '.' + base64UrlFromString_(payload);
  var sig = ecdsaSignP256_(privateKeyHex, asciiToBytes_(signingInput));
  var sigBytes = bigIntToBytes_(sig.r, 32).concat(bigIntToBytes_(sig.s, 32));
  return signingInput + '.' + base64UrlFromBytes_(sigBytes);
}

/**
 * One-time VAPID identity key generation (run from `setup()`). Not RFC 6979 (that's only
 * for per-signature nonces) — this seeds from two Apps Script UUIDs, which are backed by
 * Java's SecureRandom, combined through SHA-256. Fine for a long-lived identity key in a
 * small hobby app; Apps Script has no `crypto.getRandomValues` equivalent to do better.
 */
function generateVapidKeyPair_() {
  var seed = Utilities.getUuid() + Utilities.getUuid() + new Date().getTime() + Math.random();
  var hash = sha256Bytes_(asciiToBytes_(seed));
  var scalar = p256Mod_(bytesToBigInt_(hash), P256_N_ - 1n) + 1n;
  var privateKeyHex = scalar.toString(16);
  while (privateKeyHex.length < 64) privateKeyHex = '0' + privateKeyHex;
  var publicKeyBytes = privateKeyToPublicKeyBytes_(privateKeyHex);
  return { privateKeyHex: privateKeyHex, publicKeyB64Url: base64UrlFromBytes_(publicKeyBytes) };
}

/** Sends one payload-less Web Push to a subscription. Errors are logged, never thrown (one bad endpoint shouldn't stop the rest). */
function sendWebPush_(sub, privateKeyHex, subject) {
  var originMatch = String(sub.endpoint).match(/^(https?:\/\/[^/]+)/);
  var audience = originMatch ? originMatch[1] : sub.endpoint;
  var jwt = buildVapidJwt_(privateKeyHex, audience, subject);
  var publicKeyB64 = base64UrlFromBytes_(privateKeyToPublicKeyBytes_(privateKeyHex));

  try {
    var response = UrlFetchApp.fetch(sub.endpoint, {
      method: 'post',
      headers: {
        Authorization: 'vapid t=' + jwt + ', k=' + publicKeyB64,
        TTL: '60',
      },
      muteHttpExceptions: true,
    });
    Logger.log('Push to ' + sub.playerId + ': HTTP ' + response.getResponseCode());
  } catch (err) {
    Logger.log('Push send failed for ' + sub.playerId + ': ' + err);
  }
}

/**
 * The time-driven trigger target (see `installReminderTrigger`). Sends a reminder to
 * every enabled subscription whose configured reminder time is within 15 minutes of now
 * (matching the trigger's own granularity) and who hasn't logged anything today yet.
 */
function sendDueReminders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = getConfigMap_();
  var rolloverHour = Number(config.rolloverHour || 4);
  var todayStr = logicalToday_(rolloverHour);
  var nowMinutes = istMinutesNow_();

  var logs = sheetAsObjects_(ss.getSheetByName(SHEET_LOGS));
  var loggedToday = {};
  logs.forEach(function (l) {
    if (l.date === todayStr) loggedToday[l.playerId] = true;
  });

  var privateKey = PropertiesService.getScriptProperties().getProperty('vapidPrivateKey');
  if (!privateKey) {
    Logger.log('No VAPID key found — run setup() first.');
    return;
  }
  var subject = config.vapidSubject || 'mailto:noreply@example.com';
  var subs = sheetAsObjects_(ss.getSheetByName(SHEET_PUSH));

  subs.forEach(function (sub) {
    if (!sub.enabled || loggedToday[sub.playerId]) return;
    var times = String(sub.reminderTimes || '')
      .split(',')
      .filter(function (t) {
        return t.indexOf(':') > 0;
      });
    var due = times.some(function (t) {
      var parts = t.split(':');
      var tm = Number(parts[0]) * 60 + Number(parts[1]);
      return Math.abs(nowMinutes - tm) <= 7;
    });
    if (due) sendWebPush_(sub, privateKey, subject);
  });
}

/** Run once from the Apps Script editor to schedule `sendDueReminders` every 15 minutes. */
function installReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDueReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDueReminders').timeBased().everyMinutes(15).create();
  Logger.log('Reminder trigger installed: sendDueReminders will run every 15 minutes.');
}

/** Manual smoke test: run from the editor with a real playerId to send one push right now. */
function sendTestPush(playerId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sub = sheetAsObjects_(ss.getSheetByName(SHEET_PUSH)).filter(function (s) {
    return s.playerId === playerId;
  })[0];
  if (!sub) {
    Logger.log('No push subscription found for ' + playerId);
    return;
  }
  var privateKey = PropertiesService.getScriptProperties().getProperty('vapidPrivateKey');
  var config = getConfigMap_();
  sendWebPush_(sub, privateKey, config.vapidSubject || 'mailto:noreply@example.com');
  Logger.log('Test push sent to ' + playerId);
}
