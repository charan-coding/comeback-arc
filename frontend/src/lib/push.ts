/**
 * Browser-side Web Push subscribe/unsubscribe. The actual VAPID signing happens on the
 * backend (backend/Code.gs) when a reminder is sent — this file never touches private
 * keys, it only asks the browser to create a subscription against the public key.
 */

export const pushSupported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  if (!pushSupported) throw new Error('Push notifications are not supported in this browser');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    // TS's DOM lib types Uint8Array as generic over the buffer kind in a way that doesn't
    // quite line up with BufferSource here even though this is a perfectly ordinary
    // Uint8Array at runtime; cast rather than fight the type checker over it.
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getExistingSubscription();
  if (sub) await sub.unsubscribe();
}

export function subscriptionToJson(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const json = sub.toJSON();
  return { endpoint: json.endpoint!, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } };
}
