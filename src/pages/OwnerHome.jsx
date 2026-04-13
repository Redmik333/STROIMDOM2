import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { BarChart3, Settings, Bell, TrendingUp, ShoppingCart, WifiOff, Clock, HardHat, Wallet, PieChart, ClipboardList, HelpCircle } from 'lucide-react';
import { initOwnerNotifications, startPolling, stopPolling, getPermissionStatus } from '../lib/pushNotifications';

import NotificationBanner from '../components/NotificationBanner';
import { fmt } from '../utils/format';
import { getQueueCount } from '../lib/offlineQueue';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин. назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч. назад`;
  return `${Math.floor(h / 24)} дн. назад`;
}

export default function OwnerHome() {
  const [houses, setHouses] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [stages, setStages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount] = useState(getQueueCount());
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    // If already granted — start polling immediately without re-asking
    if (getPermissionStatus() === 'granted') {
      startPolling(60000);
    } else {
      initOwnerNotifications();
    }
    return () => stopPolling();
  }, []);

  useEffect(() => {
    // Instant render from localStorage cache
    const cached = localStorage.getItem('owner_home_cache');
    if (cached) {
      try {
        const { h, s, p, st, unread, feed } = JSON.parse(cached);
        setHouses(h); setSalaries(s); setPurchases(p); setStages(st);
        setUnreadCount(unread); setEvents(feed);
      } catch(e) {}
    }
    // Background refresh
    const load = async () => {
      try {
        const [h, s, p, st, n, recentS, recentP, recentSt] = await Promise.all([
          base44.entities.House.list(),
          base44.entities.Salary.list(),
          base44.entities.Purchase.list(),
          base44.entities.Stage.list(),
          base44.entities.Notification.filter({ is_read: false }),
          base44.entities.Salary.list('-created_date', 10),
          base44.entities.Purchase.list('-created_date', 10),
          base44.entities.Stage.list('-created_date', 10),
        ]);
        setHouses(h); setSalaries(s); setPurchases(p); setStages(st);
        setUnreadCount(n.length);
        const feed = [
          ...recentS.map(x => ({ type: 'salary', date: x.created_date, house: x.house_name, who: x.created_by, text: `${x.worker_name} — ${Number(x.accrued || 0).toLocaleString('ru-RU')} ₽` })),
          ...recentP.map(x => ({ type: 'purchase', date: x.created_date, house: x.house_name, who: x.created_by, text: `${x.material} — ${Number(x.total || 0).toLocaleString('ru-RU')} ₽` })),
          ...recentSt.map(x => ({ type: 'stage', date: x.created_date, house: x.house_name, who: x.created_by, text: `${x.stage_name}: ${x.progress}%` })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
        setEvents(feed);
        try { localStorage.setItem('owner_home_cache', JSON.stringify({ h, s, p, st, unread: n.length, feed })); } catch(e) {}
      } catch(e) {
        // Network error — cached data remains visible
      }
    };
    load();
    // Reload when user returns to the page (e.g. after going to Salary and back)
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const totalSpent = [...salaries.map(s => s.accrued || 0), ...purchases.map(p => p.total || 0)].reduce((a, b) => a + b, 0);
  const totalDebt = salaries.reduce((a, s) => a + ((s.accrued || 0) - (s.paid || 0)), 0);

  const houseProgress = (name) => {
    const STAGES = ['Фундамент', 'Стены', 'Крыша', 'Инженерия', 'Отделка'];
    const map = {};
    stages.filter(s => s.house_name === name).forEach(s => {
      if (!map[s.stage_name] || s.date > map[s.stage_name].date) map[s.stage_name] = s;
    });
    return Math.round(STAGES.reduce((sum, s) => sum + (map[s]?.progress || 0), 0) / STAGES.length);
  };

  const houseSpent = (name) => {
    const sal = salaries.filter(s => s.house_name === name).reduce((a, s) => a + (s.accrued || 0), 0);
    const pur = purchases.filter(p => p.house_name === name).reduce((a, p) => a + (p.total || 0), 0);
    return sal + pur;
  };

  const EVENT_COLORS = { salary: 'bg-orange-100 text-orange-600', purchase: 'bg-blue-100 text-blue-600', stage: 'bg-green-100 text-green-600' };
  const EVENT_LABELS = { salary: 'ЗП', purchase: 'Закупка', stage: 'Этап' };

  return (
    <div className="min-h-screen bg-background font-inter">
      {!isOnline && (
        <div className="bg-yellow-400 text-yellow-900 text-xs font-medium px-4 py-2 flex items-center gap-2">
          <WifiOff className="w-3 h-3" />
          Нет интернета — данные сохраняются локально
        </div>
      )}

      <div className="bg-foreground text-white px-6 pt-10 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Владелец</p>
            <div className="flex items-center gap-2">
              {queueCount > 0 && (
                <Link to="/offline-queue" className="relative p-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors">
                  <WifiOff className="w-4 h-4 text-yellow-300" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full text-[10px] font-bold text-yellow-900 flex items-center justify-center">{queueCount}</span>
                </Link>
              )}
              <Link to="/notifications" className="relative p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                <Bell className="w-4 h-4 text-white/70" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/help" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                <HelpCircle className="w-4 h-4 text-white/70" />
              </Link>
              <Link to="/settings" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                <Settings className="w-4 h-4 text-white/70" />
              </Link>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Стройка</h1>
          <p className="text-white/50 mt-1 text-sm">{houses.length} объектов</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="pt-4">
          <NotificationBanner />
        </div>
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mt-6 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Всего потрачено</p>
            <p className="text-xl font-bold">{fmt(totalSpent)}</p>
          </div>
          <div className={`border rounded-2xl p-4 ${totalDebt > 0 ? 'bg-orange-50 border-orange-200' : 'bg-card border-border'}`}>
            <p className="text-xs text-muted-foreground mb-1">Долг рабочим</p>
            <p className={`text-xl font-bold ${totalDebt > 0 ? 'text-orange-600' : 'text-foreground'}`}>{fmt(totalDebt)}</p>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link to="/dashboard" className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-rose-500" />
            </div>
            <span className="font-semibold text-sm">Отчёт</span>
          </Link>
          <Link to="/salary" className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-500" />
            </div>
            <span className="font-semibold text-sm">Зарплата</span>
          </Link>
          <Link to="/purchase" className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
            </div>
            <span className="font-semibold text-sm">Закупка</span>
          </Link>
          <Link to="/events" className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="font-semibold text-sm">Лента</span>
          </Link>
          <Link to="/finance" className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <PieChart className="w-5 h-5 text-teal-500" />
            </div>
            <span className="font-semibold text-sm">Финансы</span>
          </Link>
          <Link to="/purchase-requests" className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-amber-500" />
            </div>
            <span className="font-semibold text-sm">План закупок</span>
          </Link>
          <Link to="/stage" className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-green-500" />
            </div>
            <span className="font-semibold text-sm">Этапы</span>
          </Link>
          <Link to="/sales" className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <span className="font-semibold text-sm">Продажи</span>
          </Link>
        </div>

        {/* Event feed mini */}
        {events.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Последние события</h2>
              <Link to="/events" className="text-xs text-primary">Все →</Link>
            </div>
            <div className="space-y-2">
              {events.map((ev, i) => (
                <div key={i} className="bg-card border border-border rounded-xl flex items-center gap-3 px-3 py-2.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${EVENT_COLORS[ev.type] || 'bg-gray-100 text-gray-600'}`}>
                    {EVENT_LABELS[ev.type] || ev.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ev.text}</p>
                    {ev.house && <p className="text-xs text-muted-foreground truncate">🏠 {ev.house}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(ev.date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Houses */}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Объекты</h2>
        <div className="space-y-3">
          {houses.map(h => {
            const prog = houseProgress(h.name);
            const spent = houseSpent(h.name);
            return (
              <Link key={h.id} to={`/history/${encodeURIComponent(h.name)}`} className="block bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-foreground">{h.name}</p>
                    {h.address && <p className="text-xs text-muted-foreground">{h.address}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${h.status === 'продан' ? 'bg-green-100 text-green-700' : h.status === 'продается' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {h.status || 'строится'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Затрачено: <span className="font-semibold text-foreground">{fmt(spent)}</span></span>
                  <span className="font-semibold text-primary">{prog}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-orange-500 to-amber-400 h-1.5 rounded-full" style={{ width: `${prog}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}