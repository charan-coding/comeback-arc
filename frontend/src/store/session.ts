/**
 * Local session storage. The passphrase is kept in plaintext in localStorage and re-sent
 * with every write, because the backend is a stateless Apps Script endpoint with no secure
 * session mechanism — see the README's "Auth is not real security" note. This is an accepted
 * tradeoff for a small trusted-friend-group app, not a security boundary.
 */
export interface Session {
  playerId: string;
  name: string;
  class: string;
  passphrase: string;
}

const SESSION_KEY = 'comeback-arc:session';

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
