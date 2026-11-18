import React, { useEffect, useState } from 'react';

interface MedsChecklistProps {
  playerId: string;
  date: string;
  yesterday: string;
  value: number | undefined;
  onSet: (value: number) => void;
}

const itemsKey = (playerId: string) => `comeback-arc:meds-items:${playerId}`;
const checkedKey = (playerId: string, date: string) => `comeback-arc:meds-checked:${playerId}:${date}`;

function loadList(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/** Self-defined daily meds/supplements checklist, stored per-player in localStorage (the Habits/Logs sheets have no per-player item list). */
export function MedsChecklist({ playerId, date, yesterday, value, onSet }: MedsChecklistProps) {
  const [items, setItems] = useState<string[]>(() => loadList(itemsKey(playerId)) ?? []);
  const [checked, setChecked] = useState<Set<string>>(() => {
    const todayChecked = loadList(checkedKey(playerId, date));
    if (todayChecked) return new Set(todayChecked);
    if (value === undefined) {
      const yesterdayChecked = loadList(checkedKey(playerId, yesterday));
      if (yesterdayChecked) return new Set(yesterdayChecked);
    }
    return new Set();
  });
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    localStorage.setItem(checkedKey(playerId, date), JSON.stringify(Array.from(checked)));
    const allChecked = items.length > 0 && items.every((i) => checked.has(i));
    onSet(allChecked ? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, items, playerId, date]);

  const toggle = (item: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const addItem = () => {
    const name = newItem.trim();
    if (!name || items.includes(name)) return;
    const next = [...items, name];
    setItems(next);
    localStorage.setItem(itemsKey(playerId), JSON.stringify(next));
    setNewItem('');
  };

  const removeItem = (item: string) => {
    const next = items.filter((i) => i !== item);
    setItems(next);
    localStorage.setItem(itemsKey(playerId), JSON.stringify(next));
  };

  return (
    <div>
      {items.length === 0 && <p className="mb-2 text-sm text-parchment-200">Add the meds/supplements you take daily.</p>}
      <ul className="mb-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggle(item)}
              className={`min-h-11 flex-1 rounded-md px-3 py-2 text-left text-sm ${
                checked.has(item) ? 'bg-good-500 text-dungeon-900' : 'bg-dungeon-500 text-parchment-50'
              }`}
            >
              {checked.has(item) ? '☑' : '☐'} {item}
            </button>
            <button type="button" onClick={() => removeItem(item)} className="text-xs text-parchment-300">
              remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="e.g. Vitamin D"
          className="min-h-11 flex-1 rounded-md border border-dungeon-500 bg-dungeon-800 px-2 text-sm text-parchment-50"
        />
        <button type="button" onClick={addItem} className="min-h-11 rounded-md bg-dungeon-500 px-3 text-sm text-parchment-50">
          Add
        </button>
      </div>
    </div>
  );
}
