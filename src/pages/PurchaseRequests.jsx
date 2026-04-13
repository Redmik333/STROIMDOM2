import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageLayout from '../components/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, ShoppingCart, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { fmt } from '../utils/format';

const UNITS = ['шт', 'м²', 'м³', 'пог.м', 'кг', 'тонна', 'упаковка', 'мешок', 'лист'];
const STATUS_CFG = {
  'ожидает':   { label: 'Ожидает',   color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  'одобрено':  { label: 'Одобрено',  color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  'отклонено': { label: 'Отклонено', color: 'bg-red-100 text-red-700',        icon: XCircle },
  'куплено':   { label: 'Куплено',   color: 'bg-blue-100 text-blue-700',      icon: ShoppingCart },
};

const emptyForm = { house_name: '', material: '', quantity: '', unit: 'шт', estimated_price: '', supplier: '', comment: '' };

export default function PurchaseRequests() {
  const { user } = useAuth();
  const isOwner = user?.role === 'admin';
  const [requests, setRequests] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [convertingId, setConvertingId] = useState(null);
  const [filter, setFilter] = useState('все');

  const load = async () => {
    const [reqs, hs] = await Promise.all([
      base44.entities.PurchaseRequest.list('-created_date', 100),
      base44.entities.House.list(),
    ]);
    setRequests(reqs);
    setHouses(hs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.house_name || !form.material || !form.quantity || !form.unit) return;
    setSaving(true);
    await base44.entities.PurchaseRequest.create({
      ...form,
      quantity: parseFloat(form.quantity),
      estimated_price: parseFloat(form.estimated_price) || 0,
      status: 'ожидает',
    });
    await base44.entities.Notification.create({
      title: 'Новая заявка на закупку',
      message: `${form.material} · ${form.house_name}`,
      type: 'purchase',
      house_name: form.house_name,
      is_read: false,
    });
    setSaving(false);
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const handleApprove = async (req) => {
    await base44.entities.PurchaseRequest.update(req.id, { status: 'одобрено' });
    load();
  };

  const handleReject = async (req) => {
    await base44.entities.PurchaseRequest.update(req.id, { status: 'отклонено', rejection_reason: rejectReason });
    setRejectId(null);
    setRejectReason('');
    load();
  };

  const handleConvert = async (req) => {
    setConvertingId(req.id);
    const today = new Date().toISOString().split('T')[0];
    await base44.entities.Purchase.create({
      date: today,
      house_name: req.house_name,
      material: req.material,
      quantity: req.quantity,
      unit: req.unit,
      price: req.estimated_price || 0,
      total: (req.quantity || 0) * (req.estimated_price || 0),
      supplier: req.supplier || '',
      comment: req.comment || '',
    });
    await base44.entities.PurchaseRequest.update(req.id, { status: 'куплено' });
    await base44.entities.Notification.create({
      title: 'Закупка выполнена',
      message: `${req.material} · ${req.house_name}`,
      type: 'purchase',
      house_name: req.house_name,
      is_read: false,
    });
    setConvertingId(null);
    load();
  };

  const FILTERS = ['все', 'ожидает', 'одобрено', 'отклонено', 'куплено'];
  const displayed = filter === 'все' ? requests : requests.filter(r => r.status === filter);

  return (
    <PageLayout title="План закупок" subtitle="Заявки на материалы" backTo="/">
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}>
            {f === 'все' ? 'Все' : STATUS_CFG[f]?.label}
            {f === 'ожидает' && requests.filter(r => r.status === 'ожидает').length > 0 && (
              <span className="ml-1 bg-yellow-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">
                {requests.filter(r => r.status === 'ожидает').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* New request form (foreman) */}
      {!isOwner && (
        <div className="mb-4">
          <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(s => !s)}>
            <Plus className="w-4 h-4" />
            {showForm ? 'Свернуть' : 'Создать заявку'}
            {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          {showForm && (
            <div className="mt-3 bg-card border border-border rounded-2xl p-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Дом</Label>
                <Select value={form.house_name} onValueChange={v => setForm(p => ({ ...p, house_name: v }))}>
                  <SelectTrigger><SelectValue placeholder="Выберите дом" /></SelectTrigger>
                  <SelectContent>{houses.map(h => <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Материал</Label>
                <Input placeholder="Напр. Кирпич, арматура..." value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Кол-во</Label>
                  <Input type="number" placeholder="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Ед. изм.</Label>
                  <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Цена (₽)</Label>
                  <Input type="number" placeholder="0" value={form.estimated_price} onChange={e => setForm(p => ({ ...p, estimated_price: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Поставщик (необяз.)</Label>
                <Input placeholder="Магазин / поставщик" value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Комментарий</Label>
                <Input placeholder="Доп. информация" value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={saving || !form.house_name || !form.material || !form.quantity}>
                {saving ? 'Отправка...' : 'Отправить заявку'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Нет заявок</div>
      ) : (
        <div className="space-y-3">
          {displayed.map(req => {
            const cfg = STATUS_CFG[req.status] || STATUS_CFG['ожидает'];
            const StatusIcon = cfg.icon;
            return (
              <div key={req.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{req.material}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">🏠 {req.house_name} · {req.quantity} {req.unit}</p>
                    {req.estimated_price > 0 && (
                      <p className="text-xs text-muted-foreground">~{fmt(req.quantity * req.estimated_price)}</p>
                    )}
                    {req.supplier && <p className="text-xs text-muted-foreground">Поставщик: {req.supplier}</p>}
                    {req.comment && <p className="text-xs text-muted-foreground italic mt-1">{req.comment}</p>}
                    {req.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">Причина: {req.rejection_reason}</p>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${cfg.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>

                {/* Owner actions */}
                {isOwner && req.status === 'ожидает' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req)}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Одобрить
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => setRejectId(req.id)}>
                      <XCircle className="w-3 h-3 mr-1" /> Отклонить
                    </Button>
                  </div>
                )}

                {/* Reject reason input */}
                {rejectId === req.id && (
                  <div className="space-y-2">
                    <Input placeholder="Причина отклонения (необяз.)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReject(req)}>Подтвердить</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejectId(null)}>Отмена</Button>
                    </div>
                  </div>
                )}

                {/* Convert to purchase (foreman after approved) */}
                {req.status === 'одобрено' && (
                  <Button size="sm" className="w-full" variant="outline" onClick={() => handleConvert(req)} disabled={convertingId === req.id}>
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    {convertingId === req.id ? 'Сохранение...' : 'Отметить как куплено → создать закупку'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}