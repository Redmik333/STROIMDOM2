import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Wallet, ShoppingCart, HardHat, Settings, ChevronRight, WifiOff, ClipboardList } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addToQueue, getQueue, removeFromQueue, getQueueCount } from '../lib/offlineQueue';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

const STAGES = ['Фундамент', 'Стены', 'Крыша', 'Инженерия', 'Отделка'];
const today = () => new Date().toISOString().split('T')[0];

const menuItems = [
  { label: 'Внести зарплату', icon: Wallet, to: '/salary', color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50', border: 'border-orange-100' },
  { label: 'Внести закупку', icon: ShoppingCart, to: '/purchase', color: 'from-blue-500 to-sky-500', bg: 'bg-blue-50', border: 'border-blue-100' },
  { label: 'Отметить этап', icon: HardHat, to: '/stage', color: 'from-green-500 to-emerald-500', bg: 'bg-green-50', border: 'border-green-100' },
  { label: 'План закупок', icon: ClipboardList, to: '/purchase-requests', color: 'from-amber-500 to-yellow-500', bg: 'bg-amber-50', border: 'border-amber-100' },
];

function HouseStageCard({ house, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(50);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!stage) return;
    setSaving(true);
    const data = { house_name: house.name, stage_name: stage, progress, date: today() };
    if (!navigator.onLine) {
      addToQueue({ entity: 'Stage', data, label: `${house.name}: ${stage} — ${progress}%` });
      setSaving(false);
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); setStage(''); setProgress(50); }, 1500);
      return;
    }
    try {
      await base44.entities.Stage.create(data);
      await base44.entities.Notification.create({
        title: 'Обновлён этап',
        message: `${house.name}: ${stage} — ${progress}%`,
        type: 'stage',
        house_name: house.name,
        is_read: false,
      });
    } catch (e) {
      addToQueue({ entity: 'Stage', data, label: `${house.name}: ${stage} — ${progress}%` });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); setStage(''); setProgress(50); onUpdate(); }, 1500);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-4 text-left" onClick={() => setOpen(o => !o)}>
        <div>
          <p className="font-semibold text-foreground">{house.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{house.status || 'строится'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary font-medium">Обновить этап</span>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {saved ? (
            <p className="text-center text-green-600 font-semibold py-2">✓ Сохранено!</p>
          ) : (
            <>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue placeholder="Выберите этап" /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Готовность</span>
                  <span className="font-bold text-primary">{progress}%</span>
                </div>
                <Slider value={[progress]} onValueChange={([v]) => setProgress(v)} min={0} max={100} step={5} />
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-gradient-to-r from-orange-500 to-amber-400 h-2 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <Button className="w-full" size="sm" onClick={handleSave} disabled={saving || !stage}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ForemanHome() {
  const { user, isLoadingAuth } = useAuth();
  const [houses, setHouses] = useState([]);
  const [workersByHouse, setWorkersByHouse] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(getQueueCount());
  const [syncing, setSyncing] = useState(false);

  const autoSync = async () => {
    const items = getQueue();
    if (items.length === 0) return;
    setSyncing(true);
    for (const item of items) {
      try {
        await base44.entities[item.entity].create(item.data);
        removeFromQueue(item.id);
      } catch (e) {}
    }
    setQueueCount(getQueueCount());
    setSyncing(false);
  };

  useEffect(() => {
    const on = () => { setIsOnline(true); autoSync(); };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const loadHouses = async () => {
    try {
      const [all, salaries] = await Promise.all([
        base44.entities.House.list(),
        base44.entities.Salary.list(),
      ]);
      const mine = user?.email ? all.filter(h => h.foreman_email === user.email) : all;
      const filtered = mine.length > 0 ? mine : all;
      setHouses(filtered);
      const map = {};
      filtered.forEach(h => {
        const names = [...new Set(salaries.filter(s => s.house_name === h.name && s.worker_name).map(s => s.worker_name))];
        map[h.name] = names;
      });
      setWorkersByHouse(map);
      localStorage.setItem('foreman_houses', JSON.stringify(filtered));
      localStorage.setItem('foreman_workers', JSON.stringify(map));
    } catch (e) {
      const cachedHouses = localStorage.getItem('foreman_houses');
      const cachedWorkers = localStorage.getItem('foreman_workers');
      if (cachedHouses) setHouses(JSON.parse(cachedHouses));
      if (cachedWorkers) setWorkersByHouse(JSON.parse(cachedWorkers));
    }
  };

  useEffect(() => { loadHouses(); }, [user]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

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
            <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Прораб</p>
            <Link to="/settings" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <Settings className="w-4 h-4 text-white/70" />
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white">Что делаем?</h1>
          <p className="text-white/50 mt-1 text-sm">{user?.full_name || user?.email}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="space-y-3 pt-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={`flex items-center gap-4 p-5 rounded-2xl bg-card border ${item.border} shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-150`}>
                <div className={`w-14 h-14 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                  <div className={`bg-gradient-to-br ${item.color} w-10 h-10 rounded-lg flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-foreground">{item.label}</p>
                </div>
                <div className="text-muted-foreground/40">›</div>
              </Link>
            );
          })}
        </div>

        {houses.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Мои объекты</h2>
            <div className="space-y-3">
              {houses.map(h => (
                <div key={h.id}>
                  <HouseStageCard house={h} onUpdate={loadHouses} />
                  {workersByHouse[h.name]?.length > 0 && (
                    <div className="mt-2 ml-2 flex flex-wrap gap-1.5">
                      {workersByHouse[h.name].map(name => (
                        <span key={name} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full border border-border font-medium">
                          👷 {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}