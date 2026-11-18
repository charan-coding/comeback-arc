import React, { useState } from 'react';
import { useApp } from '../store/AppProvider';

const CLASSES = ['Fighter', 'Paladin', 'Rogue', 'Wizard', 'Ranger', 'Cleric', 'Barbarian', 'Bard'];

export function Login() {
  const { players, login, createPlayer } = useApp();
  const [mode, setMode] = useState<'login' | 'create'>(players.length > 0 ? 'login' : 'create');
  const [playerId, setPlayerId] = useState('');
  const [name, setName] = useState('');
  const [playerClass, setPlayerClass] = useState(CLASSES[0]);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        if (!playerId) throw new Error('Choose your character');
        await login(playerId, passphrase);
      } else {
        if (!name.trim()) throw new Error('Give your character a name');
        await createPlayer(name.trim(), playerClass, passphrase);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-lg border border-dungeon-500 bg-dungeon-700 p-5">
        <h1 className="text-center text-xl font-bold text-ember-400">Comeback Arc</h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm ${mode === 'login' ? 'bg-ember-500 text-dungeon-900' : 'bg-dungeon-600 text-parchment-100'}`}
          >
            Join Party
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm ${mode === 'create' ? 'bg-ember-500 text-dungeon-900' : 'bg-dungeon-600 text-parchment-100'}`}
          >
            New Character
          </button>
        </div>

        {mode === 'login' ? (
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="min-h-11 w-full rounded-md border border-dungeon-500 bg-dungeon-800 px-3 py-2 text-parchment-50"
            required
          >
            <option value="">Choose your character…</option>
            {players.map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.name} — {p.class}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              className="min-h-11 w-full rounded-md border border-dungeon-500 bg-dungeon-800 px-3 py-2 text-parchment-50"
              required
            />
            <select
              value={playerClass}
              onChange={(e) => setPlayerClass(e.target.value)}
              className="min-h-11 w-full rounded-md border border-dungeon-500 bg-dungeon-800 px-3 py-2 text-parchment-50"
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}

        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Passphrase"
          minLength={4}
          className="min-h-11 w-full rounded-md border border-dungeon-500 bg-dungeon-800 px-3 py-2 text-parchment-50"
          required
        />

        {error && <p className="text-sm text-hp-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-md bg-ember-500 px-3 py-2 font-semibold text-dungeon-900 disabled:opacity-50"
        >
          {busy ? 'Entering…' : mode === 'login' ? 'Enter the Dungeon' : 'Begin Your Arc'}
        </button>
      </form>
    </div>
  );
}
