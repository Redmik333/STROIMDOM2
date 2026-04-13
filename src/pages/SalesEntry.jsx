import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

const STATUS_LABELS = { 'строится': '🏗️ Строится', 'продается': '🏠 Продаётся', 'продан': '✅ Продан' };

export default function SalesEntry() {
  const [houses, setHouses] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    house_name: '',
    status: 'строится',
    sale_price: '',
    sale_date: today(),
    buyer: '',
    comment: '',
  });

  useEffect(() => {
    base44.entities.House.list().then(setHouses);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    await base44.entities.Sale.create({
      ...form,
      sale_price: parseFloat(form.sale_price) || 0,
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm({ house_name: '', status: 'строится', sale_price: '', sale_date: today(), buyer: '', comment: '' });
    }, 2000);
  };

  return (
    <PageLayout title="Продажи" subtitle="Статус и цена дома">
      {saved ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <p className="text-xl font-semibold text-foreground">Записано!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Дом</Label>
            <Select value={form.house_name} onValueChange={v => setForm(f => ({ ...f, house_name: v }))}>
              <SelectTrigger><SelectValue placeholder="Выберите дом" /></SelectTrigger>
              <SelectContent>
                {houses.map(h => <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Статус</Label>
            <div className="grid grid-cols-3 gap-2">
              {['строится', 'продается', 'продан'].map(s => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`p-3 rounded-xl text-sm font-medium border transition-all ${form.status === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-muted'}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Цена (₽)</Label>
            <Input type="number" placeholder="0" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))} />
          </div>

          {form.status === 'продан' && (
            <>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Дата продажи</Label>
                <Input type="date" value={form.sale_date} onChange={e => setForm(f => ({ ...f, sale_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Покупатель</Label>
                <Input placeholder="Имя покупателя" value={form.buyer} onChange={e => setForm(f => ({ ...f, buyer: e.target.value }))} />
              </div>
            </>
          )}

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Комментарий</Label>
            <Input placeholder="Необязательно" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
          </div>

          <Button
            className="w-full h-14 text-base font-semibold mt-2"
            onClick={handleSave}
            disabled={loading || !form.house_name}
          >
            {loading ? 'Сохранение...' : 'Записать'}
          </Button>
        </div>
      )}
    </PageLayout>
  );
}