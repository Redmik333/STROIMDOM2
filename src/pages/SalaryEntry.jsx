import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import QuickAddModal from '../components/QuickAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle } from 'lucide-react';
import { addToQueue } from '../lib/offlineQueue';
import { fmt } from '../utils/format';

const today = () => new Date().toISOString().split('T')[0];

export default function SalaryEntry() {
  const [houses, setHouses] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ date: today(), house_name: '', worker_name: '', payment_type: 'день', volume: '', rate: '', accrued: '', paid: '', comment: '' });

  useEffect(() => {
    // Load from cache first for instant display
    const ch = localStorage.getItem('cache_houses') || localStorage.getItem('foreman_houses');
    const cw = localStorage.getItem('cache_workers');
    if (ch) setHouses(JSON.parse(ch));
    if (cw) setWorkers(JSON.parse(cw));
    // Then try network
    base44.entities.House.list().then(h => { setHouses(h); localStorage.setItem('cache_houses', JSON.stringify(h)); }).catch(() => {});
    base44.entities.Worker.list().then(w => { setWorkers(w); localStorage.setItem('cache_workers', JSON.stringify(w)); }).catch(() => {});
  }, []);

  const accrued = form.volume && form.rate
    ? (parseFloat(form.volume) * parseFloat(form.rate)).toFixed(2)
    : (parseFloat(form.accrued) || 0).toFixed(2);
  const debt = parseFloat(accrued) - (parseFloat(form.paid) || 0);

  const handleSave = async () => {
    setLoading(true);
    const data = { ...form, volume: parseFloat(form.volume) || 0, rate: parseFloat(form.rate) || 0, accrued: parseFloat(accrued) || 0, paid: parseFloat(form.paid) || 0 };
    if (!navigator.onLine) {
      addToQueue({ entity: 'Salary', data, label: `${form.worker_name} — ${fmt(accrued)}, ${form.house_name}` });
      setLoading(false);
      setSaved(true);
      setTimeout(() => { setSaved(false); setForm({ date: today(), house_name: '', worker_name: '', payment_type: 'день', volume: '', rate: '', accrued: '', paid: '', comment: '' }); }, 2000);
      return;
    }
    try {
      await base44.entities.Salary.create(data);
      await base44.entities.Notification.create({ title: 'Выдана зарплата', message: `${form.worker_name} — ${fmt(accrued)}, дом: ${form.house_name}`, type: 'salary', house_name: form.house_name, is_read: false });
    } catch (e) {
      addToQueue({ entity: 'Salary', data, label: `${form.worker_name} — ${fmt(accrued)}, ${form.house_name}` });
    }
    setLoading(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm({ date: today(), house_name: '', worker_name: '', payment_type: 'день', volume: '', rate: '', accrued: '', paid: '', comment: '' });
    }, 2000);
  };

  return (
    <PageLayout title="Зарплата" subtitle="Запись выплаты работнику">
      {saved ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <p className="text-xl font-semibold">Записано!</p>
          <Button variant="outline" className="mt-2" onClick={() => setSaved(false)}>+ Добавить ещё</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Дата</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Дом</Label>
            <div className="flex gap-2">
              <Select value={form.house_name} onValueChange={v => setForm(f => ({ ...f, house_name: v }))}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Выберите дом" /></SelectTrigger>
                <SelectContent>
                  {houses.map(h => <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <QuickAddModal type="house" onAdd={h => { setHouses(prev => [...prev, h]); setForm(f => ({ ...f, house_name: h.name })); }} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Работник</Label>
            <div className="flex gap-2">
              <Select value={form.worker_name} onValueChange={v => setForm(f => ({ ...f, worker_name: v }))}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Выберите работника" /></SelectTrigger>
                <SelectContent>
                  {workers.map(w => <SelectItem key={w.id} value={w.name}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <QuickAddModal type="worker" onAdd={w => { setWorkers(prev => [...prev, w]); setForm(f => ({ ...f, worker_name: w.name })); }} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Тип оплаты</Label>
            <Select value={form.payment_type} onValueChange={v => setForm(f => ({ ...f, payment_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="день">За день</SelectItem>
                <SelectItem value="объем">По объёму</SelectItem>
                <SelectItem value="за дом">За дом (фикс)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.payment_type !== 'за дом' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">{form.payment_type === 'день' ? 'Кол-во дней' : 'Объём'}</Label>
                <Input type="number" placeholder="0" value={form.volume} onChange={e => setForm(f => ({ ...f, volume: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Ставка (₽) — редактируемая</Label>
                <Input type="number" placeholder="0" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Сумма за дом (₽)</Label>
              <Input type="number" placeholder="0" value={form.accrued} onChange={e => setForm(f => ({ ...f, accrued: e.target.value }))} />
            </div>
          )}

          {parseFloat(accrued) > 0 && (
            <div className="bg-muted rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Начислено</span>
              <span className="text-2xl font-bold">{fmt(accrued)}</span>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Выплачено сейчас (₽)</Label>
            <Input type="number" placeholder="0" value={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.value }))} />
          </div>

          {debt > 0 && parseFloat(accrued) > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex justify-between">
              <span className="text-sm text-orange-700 font-medium">Долг</span>
              <span className="text-sm font-bold text-orange-700">{fmt(debt)}</span>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Комментарий</Label>
            <Input placeholder="Необязательно" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
          </div>

          <Button className="w-full h-14 text-base font-semibold mt-2" onClick={handleSave} disabled={loading || !form.house_name || !form.worker_name}>
            {loading ? 'Сохранение...' : 'Записать'}
          </Button>
        </div>
      )}
    </PageLayout>
  );
}