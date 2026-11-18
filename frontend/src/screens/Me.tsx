import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../store/AppProvider';
import { today, weekStart, addDays, daysBetween, minutesToHhmm } from '../lib/day';
import { computeStreaks } from '../lib/scoring';
import { totalXp, levelFromXp, classTitle, computeFloor, computeRuns, computeEarnedBadges, BADGE_DEFINITIONS } from '../lib/rpg';
import { Card, SectionTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { compressSpriteFile, compressBoardImage } from '../lib/sprite';

export function Me() {
  const {
    session,
    players,
    logs,
    myHabits,
    baseHabits,
    config,
    setOverride,
    uploadSprite,
    visionBoard,
    addVisionBoardImage,
    removeVisionBoardImage,
    logout,
    isDemoMode,
  } = useApp();
  const todayStr = today(config.rolloverHour);
  const [editingHabits, setEditingHabits] = useState(false);
  const [spriteBusy, setSpriteBusy] = useState(false);
  const [spriteError, setSpriteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const boardInputRef = useRef<HTMLInputElement>(null);

  const player = players.find((p) => p.playerId === session?.playerId);
  const myLogs = useMemo(() => logs.filter((l) => l.playerId === session?.playerId), [logs, session]);
  const startDate = player?.createdAt ?? todayStr;

  const streaks = useMemo(() => computeStreaks(session!.playerId, myLogs, myHabits, config, startDate, todayStr), [session, myLogs, myHabits, config, startDate, todayStr]);
  const xp = useMemo(() => totalXp(session!.playerId, myLogs, myHabits, config, startDate, todayStr), [session, myLogs, myHabits, config, startDate, todayStr]);
  const level = levelFromXp(xp);
  const title = player ? classTitle(player.class, level.level) : '';

  const mondays = useMemo(() => {
    const out: string[] = [];
    let m = weekStart(startDate);
    const last = weekStart(todayStr);
    while (m <= last) {
      out.push(m);
      m = addDays(m, 7);
    }
    return out;
  }, [startDate, todayStr]);

  const floors = useMemo(
    () => mondays.map((m) => computeFloor(session!.playerId, myLogs, myHabits, config, m)),
    [mondays, session, myLogs, myHabits, config]
  );
  const runSummary = useMemo(() => computeRuns(floors), [floors]);

  const earnedBadges = useMemo(
    () => computeEarnedBadges({ playerId: session!.playerId, playerLogs: myLogs, habits: myHabits, config, startDate, endDate: todayStr, longestStreak: streaks.longest }),
    [session, myLogs, myHabits, config, startDate, todayStr, streaks.longest]
  );

  const historyDays = daysBetween(addDays(todayStr, -13), todayStr);
  const myBoard = visionBoard.filter((img) => img.playerId === session?.playerId);

  if (!session || !player) return null;

  async function handleSpriteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSpriteBusy(true);
    setSpriteError(null);
    try {
      const { base64, mimeType } = await compressSpriteFile(file);
      await uploadSprite(base64, mimeType);
    } catch (err) {
      setSpriteError(err instanceof Error ? err.message : 'Could not upload that image');
    } finally {
      setSpriteBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function addBoardFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setBoardBusy(true);
    setBoardError(null);
    try {
      for (const file of imageFiles) {
        const { base64, mimeType, width, height } = await compressBoardImage(file);
        await addVisionBoardImage(base64, mimeType, width, height);
      }
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : 'Could not add that image');
    } finally {
      setBoardBusy(false);
    }
  }

  function handleBoardInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addBoardFiles(e.target.files);
    if (boardInputRef.current) boardInputRef.current.value = '';
  }

  function handleBoardDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addBoardFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-4 pb-24">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-parchment-50">{player.name}</div>
            <div className="text-sm text-ember-400">
              Lvl {level.level} {title}
            </div>
          </div>
          <button onClick={logout} className="text-sm text-parchment-300 underline">
            Log out
          </button>
        </div>
        <div className="mt-3">
          <ProgressBar
            fraction={level.xpIntoLevel / level.xpForNextLevel}
            colorClass="bg-mana-500"
            label={<span>{level.xpIntoLevel} / {level.xpForNextLevel} XP to next level</span>}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm text-parchment-200">
          <span>🔥 Streak: {streaks.current}</span>
          <span>🏆 Best: {streaks.longest}</span>
          <span>✨ Total XP: {xp}</span>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 border-dungeon-500 bg-dungeon-800">
            {player.spriteUrl ? (
              <img src={player.spriteUrl} alt={`${player.name}'s sprite`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl">🧙</span>
            )}
          </div>
          <div className="flex-1">
            <SectionTitle>Arena Sprite</SectionTitle>
            <p className="mb-2 text-sm text-parchment-300">Upload a picture of yourself to fight with in the Arena.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleSpriteChange}
              disabled={spriteBusy}
              className="block w-full text-sm text-parchment-200 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-ember-500 file:px-4 file:py-2 file:font-semibold file:text-dungeon-900"
            />
            {spriteBusy && <p className="mt-1 text-sm text-parchment-300">Uploading…</p>}
            {spriteError && <p className="mt-1 text-sm text-hp-500">{spriteError}</p>}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Run History</SectionTitle>
        <div className="mb-2 flex justify-between text-sm text-parchment-200">
          <span>Current run: {runSummary.currentRun} floor{runSummary.currentRun === 1 ? '' : 's'}</span>
          <span>Best run: {runSummary.bestRun} floor{runSummary.bestRun === 1 ? '' : 's'}</span>
        </div>
        <ul className="space-y-1 text-sm">
          {floors
            .slice()
            .reverse()
            .slice(0, 8)
            .map((f) => (
              <li key={f.weekStart} className="flex items-center justify-between rounded bg-dungeon-800 px-2 py-1">
                <span>Floor {f.weekStart}</span>
                <span className={f.pass ? 'text-good-500' : 'text-hp-500'}>{f.pass ? 'Cleared' : 'Failed'}</span>
                <span className="text-parchment-300">{(f.weeklyScore * 100).toFixed(0)}%</span>
              </li>
            ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>Badges</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BADGE_DEFINITIONS.map((b) => {
            const earned = earnedBadges.has(b.id);
            return (
              <div
                key={b.id}
                title={b.description}
                className={`flex flex-col items-center rounded-md p-2 text-center ${earned ? 'bg-dungeon-600' : 'bg-dungeon-800 opacity-40'}`}
              >
                <span className="text-2xl">{b.icon}</span>
                <span className="mt-1 text-xs text-parchment-100">{b.name}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Vision Board</SectionTitle>
        <p className="mb-2 text-sm text-parchment-300">Drop in a few images (saved from Pinterest or anywhere) and they'll collage together automatically.</p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleBoardDrop}
          onClick={() => boardInputRef.current?.click()}
          className={`mb-3 flex min-h-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-sm transition-colors ${
            dragOver ? 'border-ember-400 bg-ember-500/10 text-ember-400' : 'border-dungeon-500 text-parchment-300'
          }`}
        >
          {boardBusy ? 'Adding…' : 'Drop images here, or tap to choose'}
        </div>
        <input ref={boardInputRef} type="file" accept="image/*" multiple onChange={handleBoardInputChange} className="hidden" />
        {boardError && <p className="mb-2 text-sm text-hp-500">{boardError}</p>}
        {myBoard.length > 0 && (
          <div className="columns-2 gap-2 sm:columns-3">
            {myBoard.map((img) => (
              <div key={img.imageId} className="group relative mb-2 break-inside-avoid">
                <img src={img.imageUrl} alt="Vision board item" className="w-full rounded-lg" />
                <button
                  onClick={() => removeVisionBoardImage(img.imageId)}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-dungeon-900/80 text-base text-parchment-50"
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>14-Day History</SectionTitle>
        <div className="grid grid-cols-7 gap-1">
          {historyDays.map((d) => (
            <div key={d} className="text-center text-[10px] text-parchment-300">
              {d.slice(8)}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>My Habits</SectionTitle>
          <button onClick={() => setEditingHabits((v) => !v)} className="text-sm text-ember-400 underline">
            {editingHabits ? 'Done' : 'Edit targets'}
          </button>
        </div>
        <ul className="space-y-2">
          {baseHabits.map((habit) => {
            const mine = myHabits.find((h) => h.habitId === habit.habitId)!;
            return (
              <li key={habit.habitId} className="flex items-center justify-between gap-2 text-sm">
                <span className={mine.active ? 'text-parchment-100' : 'text-parchment-400 line-through'}>{habit.name}</span>
                {editingHabits ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      defaultValue={mine.target}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isNaN(n) && n > 0) setOverride(habit.habitId, 'target', n);
                      }}
                      className="min-h-9 w-20 rounded-md border border-dungeon-500 bg-dungeon-800 px-2 text-parchment-50"
                    />
                    <button
                      onClick={() => setOverride(habit.habitId, 'active', !mine.active)}
                      className={`min-h-9 rounded-md px-2 text-xs ${mine.active ? 'bg-good-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'}`}
                    >
                      {mine.active ? 'Active' : 'Off'}
                    </button>
                  </div>
                ) : (
                  <span className="text-parchment-300">
                    target {habit.type === 'time' ? minutesToHhmm(mine.target) : mine.target} {habit.unit}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {isDemoMode && (
        <Card>
          <p className="text-sm text-parchment-300">
            Demo mode: habit edits and logs here are kept only in memory for this preview and reset on reload.
          </p>
        </Card>
      )}
    </div>
  );
}
