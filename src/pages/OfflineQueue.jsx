import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import { getQueue, removeFromQueue, clearQueue } from '../lib/offlineQueue';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Trash2, Send, ShoppingCart, Wallet, HardHat } from 'lucide-react';

const TYPE_ICONS = { Salary: Wallet, Purchase: ShoppingCart, Stage: HardHat };
const TYPE_LABELS = { Salary: 'Зарплата', Purchase: 'Закупка', Stage: 'Этап' };

export default function OfflineQueue() {
  const [queue, setQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState([]);

  useEffect(() => {
    setQueue(getQueue());
    const on = () => { setIsOnline(true); setQueue(getQueue()); };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const syncAll = async () => {
    if (!isOnline) return;
    setSyncing(true);
    const items = getQueue();
    const log = [];
    for (const item of items) {
      try {
        await base44.entities[item.entity].create(item.data);
        removeFromQueue(item.id);
        log.push({ id: item.id, status: 'ok', label: `${TYPE_LABELS[item.entity] || item.entity}: ${item.label}` });
      } catch (e) {
        log.push({ id: item.id, status: 'error', label: `${TYPE_LABELS[item.entity] || item.entity}: ${item.label}` });
      }
    }
    setSyncLog(log);
    setQueue(getQueue());
    setSyncing(false);
  };

  const deleteItem = (id) => {
    removeFromQueue(id);
    setQueue(getQueue());
  };

  return (
    <PageLayout title="Ожидают отправки" subtitle="Операции без интернета">
      <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm font-medium ${isOnline ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        {isOnline ? 'Интернет доступен — можно синхронизировать' : 'Нет интернета — синхронизация недоступна'}
      </div>

      {queue.length > 0 && isOnline && (
        <Button className="w-full mb-4 gap-2" onClick={syncAll} disabled={syncing}>
          <Send className="w-4 h-4" />
          {syncing ? 'Отправка...' : `Отправить всё (${queue.length})`}
        </Button>
      )}

      {syncLog.length > 0 && (
        <div className="mb-4 space-y-1">
          {syncLog.map((l, i) => (
            <div key={i} className={`text-xs px-3 py-2 rounded-lg ${l.status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {l.status === 'ok' ? '✓' : '✗'} {l.label}
            </div>
          ))}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Очередь пуста</p>
          <p className="text-sm mt-1">Все данные синхронизированы</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map(item => {
            const Icon = TYPE_ICONS[item.entity] || Send;
            return (
              <div key={item.id} className="bg-card border border-border rounded-2xl flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[item.entity] || item.entity} · {new Date(item.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}