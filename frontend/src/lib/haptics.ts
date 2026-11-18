/** Fires a short vibration on devices/browsers that support it; a silent no-op everywhere else. */
export function tap(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(12);
  }
}

export function success(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([10, 40, 18]);
  }
}
