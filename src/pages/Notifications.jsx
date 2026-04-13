import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import { Bell, Check, ShoppingCart, Wallet, HardHat, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TYPE_ICONS = {
  salary: Wallet,
  purchase: ShoppingCart,
  stage: HardHat,
  comment: MessageCircle,
  system: Bell,
};

const TYPE_COLORS = {
  salary: 'bg-orange-100 text-orange-500',
  purchase: 'bg-blue-100 text-blue-500',
  stage: 'bg-green-100 text-green-500',
  comment: 'bg-purple-100 text-purple-500',
  system: 'bg-gray-100 text-gray-500',
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Notification.list('-created_date', 100).then(n => {
      setNotifications(n);
      setLoading(false);
    });
  }, []);

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <PageLayout title="Уведомления" subtitle={`${unreadCount} непрочитанных`} backTo="/">
      {unreadCount > 0 && (
        <Button variant="outline" size="sm" className="w-full mb-4 gap-2" onClick={markAllRead}>
          <Check className="w-4 h-4" />
          Отметить все прочитанными
        </Button>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Нет уведомлений</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.system;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${n.is_read ? 'bg-card border-border opacity-60' : 'bg-card border-primary/30 shadow-sm'}`}
                onClick={() => !n.is_read && markRead(n.id)}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${n.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>{n.title}</p>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  {n.house_name && <p className="text-xs text-primary mt-0.5">{n.house_name}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}