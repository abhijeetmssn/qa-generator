// Anonymous ID for this phone, sent with pack QR scans so scans of the same pack can be
// told apart by phone — no login or mobile number needed. Stored in this browser only.
const DEVICE_ID_KEY = 'apas_device_id';
let fallbackId: string | null = null;

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (e.g. some private modes) — the ID lasts for this page only
    fallbackId ??= newId();
    return fallbackId;
  }
}
