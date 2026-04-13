import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { fmt } from '../utils/format';

function AddRow({ placeholder, onAdd }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-2">
      <Input placeholder={placeholder} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && value.trim()) { onAdd(value.trim()); setValue(''); } }} />
      <Button variant="outline" onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(''); } }} disabled={!value.trim()}>
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

function HouseEditor({ house, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState(house.budget || '');
  const [salePrice, setSalePrice] = useState(house.sale_price || '');
  const [foremanEmail, setForemanEmail] = useState(house.foreman_email || '');
  const [address, setAddress] = useState(house.address || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await base44.entities.House.update(house.id, {
      budget: parseFloat(budget) || 0,
      sale_price: parseFloat(salePrice) || 0,
      foreman_email: foremanEmail.trim(),
      address: address.trim(),
    });
    setSaving(false);
    setOpen(false);
    onUpdate();
  };

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? 'Свернуть' : 'Настройки дома'}
      </button>
      {open && (
        <div className="bg-muted rounded-xl p-3 mt-2 space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Адрес</Label>
            <Input type="text" placeholder="Ул. Ленина, 5" value={address} onChange={e => setAddress(e.target.value)} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Бюджет (₽)</Label>
              <Input type="number" placeholder="0" value={budget} onChange={e => setBudget(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Цена продажи (₽)</Label>
              <Input type="number" placeholder="0" value={salePrice} onChange={e => setSalePrice(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Email прораба</Label>
            <Input type="email" placeholder="foreman@email.com" value={foremanEmail} onChange={e => setForemanEmail(e.target.value)} className="text-sm" />
          </div>
          <Button size="sm" className="w-full" onClick={save} disabled={saving}>{saving ? '...' : 'Сохранить'}</Button>
        </div>
      )}
    </div>
  );
}

function DangerZone() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const categories = [
    { key: 'salary', label: 'Зарплаты', entity: 'Salary' },
    { key: 'purchase', label: 'Закупки', entity: 'Purchase' },
    { key: 'stage', label: 'Этапы', entity: 'Stage' },
    { key: 'sales', label: 'Продажи', entity: 'Sale' },
  ];

  const clearCategory = async (cat) => {
    if (!window.confirm(`Удалить ВСЕ записи «${cat.label}»? Нельзя отменить.`)) return;
    setDeleting(cat.key);
    const items = await base44.entities[cat.entity].list();
    await Promise.all(items.map(i => base44.entities[cat.entity].delete(i.id)));
    setDeleting(null);
    alert(`«${cat.label}» очищены.`);
  };

  const clearAll = async () => {
    if (!window.confirm('Удалить ВСЕ данные (зарплаты, закупки, этапы, продажи, уведомления)?')) return;
    if (!window.confirm('Подтвердите ещё раз.')) return;
    setDeleting('all');
    for (const cat of [...categories, { entity: 'Notification' }]) {
      const items = await base44.entities[cat.entity].list();
      await Promise.all(items.map(i => base44.entities[cat.entity].delete(i.id)));
    }
    setDeleting(null);
    alert('Все данные очищены.');
  };

  return (
    <div className="mt-8">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-sm text-destructive font-semibold mb-3">
        <AlertTriangle className="w-4 h-4" />
        Очистка данных
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-red-600 mb-3">Удалённые данные восстановить нельзя!</p>
          {categories.map(cat => (
            <button key={cat.key} onClick={() => clearCategory(cat)} disabled={deleting !== null}
              className="w-full flex justify-between items-center px-4 py-3 bg-white border border-red-200 rounded-xl text-sm font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50">
              <span>Очистить «{cat.label}»</span>
              {deleting === cat.key && <span className="text-xs">...</span>}
            </button>
          ))}
          <button onClick={clearAll} disabled={deleting !== null}
            className="w-full px-4 py-3 bg-red-600 rounded-xl text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50 mt-2">
            {deleting === 'all' ? 'Удаление...' : 'Очистить ВСЁ (кроме домов/работников)'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [houses, setHouses] = useState([]);
  const [workers, setWorkers] = useState([]);

  const reload = () => {
    base44.entities.House.list().then(setHouses);
    base44.entities.Worker.list().then(setWorkers);
  };

  useEffect(() => { reload(); }, []);

  const addHouse = async (name) => {
    const h = await base44.entities.House.create({ name, status: 'строится' });
    setHouses(prev => [...prev, h]);
  };

  const deleteHouse = async (id) => {
    if (!window.confirm('Удалить этот дом?')) return;
    await base44.entities.House.delete(id);
    setHouses(prev => prev.filter(h => h.id !== id));
  };

  const addWorker = async (name) => {
    const w = await base44.entities.Worker.create({ name });
    setWorkers(prev => [...prev, w]);
  };

  const deleteWorker = async (id) => {
    await base44.entities.Worker.delete(id);
    setWorkers(prev => prev.filter(w => w.id !== id));
  };

  return (
    <PageLayout title="Настройки" subtitle="Справочники">
      <div className="mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Дома</h3>
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3">
          {houses.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Пусто</p>}
          {houses.map((house, i) => (
            <div key={house.id} className={`px-4 py-3 ${i < houses.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground">{house.name}</span>
                <button onClick={() => deleteHouse(house.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <HouseEditor house={house} onUpdate={reload} />
            </div>
          ))}
        </div>
        <AddRow placeholder="Напр. Дом №1, Иванова 15..." onAdd={addHouse} />
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Работники</h3>
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3">
          {workers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Пусто</p>}
          {workers.map((w, i) => (
            <div key={w.id} className={`flex justify-between items-center px-4 py-3.5 ${i < workers.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="font-medium text-foreground">{w.name}</span>
              <button onClick={() => deleteWorker(w.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <AddRow placeholder="Имя работника" onAdd={addWorker} />
      </div>

      <DangerZone />
    </PageLayout>
  );
}