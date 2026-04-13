import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { getPermissionStatus, initOwnerNotifications } from '../lib/pushNotifications';

export default function NotificationBanner() {
  const [status, setStatus] = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [dismissed, setDismissed] = useState(!!localStorage.getItem('push_banner_dismissed'));

  useEffect(() => {
    const update = () => setStatus(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed || status === 'granted' || status === 'unsupported') return null;
  if (status === 'denied') return (
    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3 mb-4">
      <BellOff className="w-4 h-4 text-red-500 flex-shrink-0" />
      <p className="text-xs text-red-700 flex-1">Уведомления заблокированы. Разрешите в настройках браузера.</p>
      <button onClick={() => { setDismissed(true); localStorage.setItem('push_banner_dismissed', '1'); }}>
        <X className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3 mb-4">
      <Bell className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <p className="text-xs text-amber-800 flex-1">
        Включите уведомления, чтобы сразу узнавать о закупках и зарплатах
      </p>
      <button
        onClick={async () => {
          const granted = await initOwnerNotifications();
          setStatus(granted ? 'granted' : 'denied');
        }}
        className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
      >
        Включить
      </button>
      <button onClick={() => { setDismissed(true); localStorage.setItem('push_banner_dismissed', '1'); }}>
        <X className="w-4 h-4 text-amber-400" />
      </button>
    </div>
  );
}