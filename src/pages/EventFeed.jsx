import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import { Wallet, ShoppingCart, HardHat, TrendingUp, Camera } from 'lucide-react';

const TYPE_CONFIG = {
  salary:   { icon: Wallet,       color: 'bg-orange-100 text-orange-500', label: 'Зарплата' },
  purchase: { icon: ShoppingCart, color: 'bg-blue-100 text-blue-500',     label: 'Закупка'  },
  stage:    { icon: HardHat,      color: 'bg-green-100 text-green-500',   label: 'Этап'     },
  sale:     { icon: TrendingUp,   color: 'bg-purple-100 text-purple-500', label: 'Продажа'  },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин. назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч. назад`;
  const d = Math.floor(h / 24);
  return `${d} дн. назад`;
}

export default function EventFeed() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Salary.list('-created_date', 30),
      base44.entities.Purchase.list('-created_date', 30),
      base44.entities.Stage.list('-created_date', 20),
      base44.entities.Sale.list('-created_date', 20),
    ]).then(([salaries, purchases, stages, sales]) => {
      const all = [
        ...salaries.map(s => ({ type: 'salary', date: s.created_date, house: s.house_name, who: s.created_by, text: `${s.worker_name} — ${Number(s.accrued || 0).toLocaleString('ru-RU')} ₽` })),
        ...purchases.map(p => ({ type: 'purchase', date: p.created_date, house: p.house_name, who: p.created_by, text: `${p.material} — ${Number(p.total || 0).toLocaleString('ru-RU')} ₽`, receipt_url: p.receipt_url || null })),
        ...stages.map(s => ({ type: 'stage', date: s.created_date, house: s.house_name, who: s.created_by, text: `${s.stage_name}: ${s.progress}%` })),
        ...sales.map(s => ({ type: 'sale', date: s.created_date, house: s.house_name, who: s.created_by, text: `Статус: ${s.status}` })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 60);
      setEvents(all);
      setLoading(false);
    });
  }, []);

  return (
    <PageLayout title="Лента событий" subtitle="Последние действия">
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Чек" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Пока нет событий</div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, i) => {
            const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.salary;
            const Icon = cfg.icon;
            return (
              <div key={i} className="bg-card border border-border rounded-xl flex items-start gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">{cfg.label}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(ev.date)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">{ev.text}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ev.house && <span className="text-xs text-muted-foreground">🏠 {ev.house}</span>}
                    {ev.who && <span className="text-xs text-muted-foreground">· {ev.who}</span>}
                  </div>
                  {ev.receipt_url && (
                    <button onClick={() => setLightbox(ev.receipt_url)} className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <Camera className="w-3 h-3" />
                      Фото чека
                      <img src={ev.receipt_url} alt="чек" className="w-10 h-8 object-cover rounded-md border border-border ml-1" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}