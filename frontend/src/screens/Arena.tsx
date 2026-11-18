import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppProvider';
import { Player } from '../api/types';
import { today, addDays } from '../lib/day';
import { totalXp, levelFromXp } from '../lib/rpg';
import { getDailyLoadout, toFighter, simulateBossFight, computeBossFightHistory, BossFightResult, Fighter } from '../lib/combat';
import { computeCampaignState, CampaignState } from '../lib/autobattle';
import { dailyRng } from '../lib/rng';
import { Card, SectionTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

const CAMPAIGN_COPY: Record<CampaignState['outcome'], (c: CampaignState) => string> = {
  victory: (c) => `⚔️ Defeated the ${c.enemy.name}! The path presses on.`,
  consolation: (c) => `🍀 Wounded the ${c.enemy.name} but it slipped away — a lucky scrap of loot either way.`,
  defeat: (c) => `💀 The ${c.enemy.name} was too strong today. Try again tomorrow.`,
  'no-data': () => "You haven't logged anything today yet — the fight hasn't started.",
};

function finalHpByPlayer(result: BossFightResult, fighters: Fighter[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const f of fighters) map[f.playerId] = f.hp;
  for (const round of result.rounds) {
    for (const id of Object.keys(round.hpAfter)) map[id] = round.hpAfter[id];
  }
  return map;
}

function Sprite({ player, size = 56 }: { player: Player; size?: number }) {
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-xl border-2 border-dungeon-500 bg-dungeon-800"
      style={{ width: size, height: size }}
    >
      {player.spriteUrl ? (
        <img src={player.spriteUrl} alt={`${player.name}'s sprite`} className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.5 }}>🧙</span>
      )}
    </div>
  );
}

export function Arena() {
  const { session, players, logs, habitsForPlayerId, config } = useApp();
  const todayStr = today(config.rolloverHour);
  const fightDate = addDays(todayStr, -1);
  const [expandedRounds, setExpandedRounds] = useState(false);

  const logsByPlayer = useMemo(() => {
    const map: Record<string, typeof logs> = {};
    for (const p of players) map[p.playerId] = logs.filter((l) => l.playerId === p.playerId);
    return map;
  }, [logs, players]);

  const habitsByPlayer = useMemo(() => {
    const map: Record<string, ReturnType<typeof habitsForPlayerId>> = {};
    for (const p of players) map[p.playerId] = habitsForPlayerId(p.playerId);
    return map;
  }, [players, habitsForPlayerId]);

  const levelByPlayer = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of players) {
      const xp = totalXp(p.playerId, logsByPlayer[p.playerId] ?? [], habitsByPlayer[p.playerId] ?? [], config, p.createdAt, todayStr);
      map[p.playerId] = levelFromXp(xp).level;
    }
    return map;
  }, [players, logsByPlayer, habitsByPlayer, config, todayStr]);

  const participants = players.filter((p) => p.createdAt <= fightDate);
  const fighters = useMemo(
    () =>
      participants.map((p) =>
        toFighter(
          p.playerId,
          p.name,
          getDailyLoadout(fightDate, p.playerId, logsByPlayer[p.playerId] ?? [], habitsByPlayer[p.playerId] ?? [], config),
          levelByPlayer[p.playerId] ?? 1
        )
      ),
    [participants, fightDate, logsByPlayer, habitsByPlayer, config, levelByPlayer]
  );

  // Seeded by the date + the exact set of fighters, so reloading the page shows the same
  // crits/dodges for that night's fight instead of re-rolling every time.
  const fightRng = useMemo(
    () => dailyRng(fightDate, participants.map((p) => p.playerId).sort().join(',')),
    [fightDate, participants]
  );
  const result = useMemo(() => simulateBossFight(fighters, fightRng), [fighters, fightRng]);
  const finalHp = useMemo(() => finalHpByPlayer(result, fighters), [result, fighters]);

  const myCampaign = useMemo<CampaignState | null>(() => {
    if (!session) return null;
    const player = players.find((p) => p.playerId === session.playerId);
    if (!player) return null;
    return computeCampaignState(
      todayStr,
      session.playerId,
      logsByPlayer[session.playerId] ?? [],
      habitsByPlayer[session.playerId] ?? [],
      config,
      player.createdAt,
      dailyRng(todayStr, `campaign:${session.playerId}`)
    );
  }, [session, players, todayStr, logsByPlayer, habitsByPlayer, config]);

  const earliestStart = players.reduce((min, p) => (p.createdAt < min ? p.createdAt : min), todayStr);
  const record = useMemo(
    () => computeBossFightHistory(players, logsByPlayer, habitsByPlayer, levelByPlayer, config, earliestStart, fightDate),
    [players, logsByPlayer, habitsByPlayer, levelByPlayer, config, earliestStart, fightDate]
  );

  const playerById = new Map(players.map((p) => [p.playerId, p]));

  return (
    <div className="space-y-4 pb-24">
      {myCampaign && (
        <Card>
          <div className="flex items-center justify-between">
            <SectionTitle>Your Campaign</SectionTitle>
            <span className="text-sm text-parchment-300">Floor {myCampaign.floorIndex + 1}</span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold text-parchment-50">
            <span>{myCampaign.enemy.name}</span>
            <span className="text-sm font-normal text-parchment-300">
              {myCampaign.enemy.hp} HP · {myCampaign.enemy.attack} ATK
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar
              fraction={myCampaign.loadout.attack / Math.max(1, myCampaign.enemy.hp)}
              colorClass={myCampaign.outcome === 'defeat' ? 'bg-hp-500' : 'bg-good-500'}
              label={<span>Your attack today: {myCampaign.loadout.attack.toFixed(1)}</span>}
            />
          </div>
          <p
            className={`mt-3 text-sm ${
              myCampaign.outcome === 'victory' ? 'text-good-500' : myCampaign.outcome === 'defeat' ? 'text-hp-500' : 'text-parchment-200'
            }`}
          >
            {CAMPAIGN_COPY[myCampaign.outcome](myCampaign)}
          </p>
          <div className="mt-2 flex justify-between text-sm text-parchment-300">
            <span>🔥 Streak: {myCampaign.streakAfter}</span>
            <span>🏆 Best floor reached: {myCampaign.bestStreak}</span>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Boss Fight — {fightDate}</SectionTitle>
        {participants.length < 2 ? (
          <p className="text-sm text-parchment-300">Need at least 2 party members with an account to fight.</p>
        ) : (
          <>
            <div className="space-y-3">
              {fighters.map((f) => {
                const p = playerById.get(f.playerId)!;
                const rawHp = finalHp[f.playerId] ?? f.hp;
                const alive = rawHp > 0;
                const isWinner = result.winnerId === f.playerId;
                const hpLabel = alive ? `${Math.round(rawHp)} / ${f.maxHp} HP` : `${Math.round(rawHp)} HP (overkill)`;
                return (
                  <div key={f.playerId} className={`rounded-xl p-3 ${isWinner ? 'bg-ember-500/15' : 'bg-dungeon-800'}`}>
                    <div className="flex items-center gap-3">
                      <Sprite player={p} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-base font-semibold ${alive ? 'text-parchment-50' : 'text-parchment-400 line-through'}`}>
                            {p.name}
                          </span>
                          {isWinner && (
                            <span className="text-sm font-semibold text-ember-400" title={alive ? 'Last one standing' : 'Closest to surviving a mutual KO'}>
                              🏆 Winner
                            </span>
                          )}
                        </div>
                        <ProgressBar fraction={Math.max(0, rawHp) / f.maxHp} colorClass={alive ? 'bg-good-500' : 'bg-hp-500'} label={<span>{hpLabel}</span>} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {f.relics.map((r) => (
                        <span key={r.habitId} className="rounded-full bg-good-500/20 px-2 py-1 text-good-500" title={`+${r.damage} dmg`}>
                          ✨ {r.name}
                        </span>
                      ))}
                      {f.curses.map((c) => (
                        <span key={c.habitId} className="rounded-full bg-hp-500/20 px-2 py-1 text-hp-500" title={`${c.type} +${c.percent}%`}>
                          ☠ {c.name}
                        </span>
                      ))}
                      {f.relics.length === 0 && f.curses.length === 0 && <span className="text-parchment-400">No habits logged that day</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {result.winnerId === null && result.rounds.length > 0 && (
              <p className="mt-3 text-center text-sm text-parchment-300">⚖️ Draw — nobody could land the final blow.</p>
            )}

            {result.rounds.length > 0 && (
              <button onClick={() => setExpandedRounds((v) => !v)} className="mt-3 min-h-11 w-full rounded-xl bg-dungeon-600 px-3 py-2 text-sm text-parchment-100">
                {expandedRounds ? 'Hide' : 'Show'} round-by-round log
              </button>
            )}
            {expandedRounds && (
              <ul className="mt-2 space-y-1 text-xs text-parchment-300">
                {result.rounds.map((r) => (
                  <li key={r.round} className="rounded bg-dungeon-800 px-2 py-1">
                    Round {r.round}: {Object.entries(r.hpAfter).map(([id, hp]) => `${playerById.get(id)?.name ?? id} ${Math.round(hp)}hp`).join(' · ')}
                    {r.eliminated.length > 0 && ` — ${r.eliminated.map((id) => playerById.get(id)?.name ?? id).join(', ')} fell`}
                    {r.events.length > 0 && (
                      <div className="mt-0.5 text-ember-400">{r.events.join(' ')}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Record</SectionTitle>
        <ul className="space-y-1">
          {players
            .slice()
            .sort((a, b) => (record[b.playerId]?.wins ?? 0) - (record[a.playerId]?.wins ?? 0))
            .map((p) => {
              const r = record[p.playerId] ?? { wins: 0, losses: 0, draws: 0 };
              return (
                <li key={p.playerId} className="flex items-center justify-between rounded bg-dungeon-800 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Sprite player={p} size={28} />
                    {p.name}
                  </span>
                  <span className="font-mono text-parchment-100">
                    {r.wins}W – {r.losses}L{r.draws > 0 ? ` – ${r.draws}D` : ''}
                  </span>
                </li>
              );
            })}
        </ul>
      </Card>
    </div>
  );
}
