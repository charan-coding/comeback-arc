import { get, set, del } from 'idb-keyval';

export interface QueuedWrite {
  id: string;
  date: string;
  habitId: string;
  value: number;
  queuedAt: string;
}

const QUEUE_KEY = 'comeback-arc:write-queue';

export async function getQueue(): Promise<QueuedWrite[]> {
  return (await get(QUEUE_KEY)) ?? [];
}

/** Queues a write, replacing any pending write for the same (date, habitId) so only the latest value survives. */
export async function enqueue(entry: Omit<QueuedWrite, 'id' | 'queuedAt'>): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((q) => !(q.date === entry.date && q.habitId === entry.habitId));
  filtered.push({ ...entry, id: `${entry.date}:${entry.habitId}:${Date.now()}`, queuedAt: new Date().toISOString() });
  await set(QUEUE_KEY, filtered);
}

export async function removeFromQueue(ids: string[]): Promise<void> {
  const queue = await getQueue();
  const idSet = new Set(ids);
  await set(QUEUE_KEY, queue.filter((q) => !idSet.has(q.id)));
}

export async function clearQueue(): Promise<void> {
  await del(QUEUE_KEY);
}
