import { base44 } from '@/api/base44Client';

const LAST_SEEN_KEY = 'push_last_seen';
const PERMISSION_ASKED_KEY = 'push_permission_asked';

// ─── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  localStorage.setItem(PERMISSION_ASKED_KEY, '1');
  return result === 'granted';
}

export function getPermissionStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// ─── Service Worker ────────────────────────────────────────────────────────────

async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function showViaSW(title, body) {
  const reg = await getSwRegistration();
  if (reg) {
    // Use SW showNotification so it works when app is backgrounded
    await reg.showNotification(title, { body, icon: '/favicon.ico', badge: '/favicon.ico' });
  } else if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

// ─── LocalStorage timestamps ───────────────────────────────────────────────────

export function getLastSeen() {
  return localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString();
}

export function setLastSeen(ts) {
  localStorage.setItem(LAST_SEEN_KEY, ts);
}

// ─── Check & Notify ────────────────────────────────────────────────────────────

export async function checkAndNotify() {
  if (Notification.permission !== 'granted') return;
  const since = getLastSeen();
  const now = new Date().toISOString();

  try {
    const [salaries, purchases, stages] = await Promise.all([
      base44.entities.Salary.list('-created_date', 20),
      base44.entities.Purchase.list('-created_date', 20),
      base44.entities.Stage.list('-created_date', 20),
    ]);

    const newS = salaries.filter(s => s.created_date > since);
    const newP = purchases.filter(p => p.created_date > since);
    const newSt = stages.filter(s => s.created_date > since);

    for (const s of newS) {
      await showViaSW('💰 Новая зарплата', `${s.worker_name} — ${Number(s.accrued || 0).toLocaleString('ru-RU')} ₽ · ${s.house_name}`);
    }
    for (const p of newP) {
      await showViaSW('🛒 Новая закупка', `${p.material} — ${Number(p.total || 0).toLocaleString('ru-RU')} ₽ · ${p.house_name}`);
    }
    for (const s of newSt) {
      await showViaSW('🏗️ Обновлён этап', `${s.stage_name}: ${s.progress}% · ${s.house_name}`);
    }

    setLastSeen(now);
  } catch {
    // silent fail (offline)
  }
}

// ─── Polling ───────────────────────────────────────────────────────────────────

let pollInterval = null;

export function startPolling(intervalMs = 60000) {
  if (pollInterval) return;
  checkAndNotify(); // immediate first check
  pollInterval = setInterval(checkAndNotify, intervalMs);
}

export function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// ─── Init (call once on owner login) ──────────────────────────────────────────

export async function initOwnerNotifications() {
  const granted = await requestNotificationPermission();
  if (granted) startPolling(60000);
  return granted;
}