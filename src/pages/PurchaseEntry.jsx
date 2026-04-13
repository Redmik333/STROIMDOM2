import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import QuickAddModal from '../components/QuickAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Plus, Trash2, Camera, X } from 'lucide-react';
import { addToQueue } from '../lib/offlineQueue';
import { fmt } from '../utils/format';

const today = () => new Date().toISOString().split('T')[0];
const UNITS = ['шт', 'м²', 'м³', 'пог.м', 'кг', 'тонна', 'упаковка', 'мешок', 'лист'];
const emptyRow = () => ({ material: '', quantity: '', unit: 'шт', price: '', supplier: '', buyer: '', comment: '', receipt_url: '', uploading: false });

export default function PurchaseEntry() {
  const [houses, setHouses] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(today());
  const [houseName, setHouseName] = useState('');
  const [rows, setRows] = useState([emptyRow()]);

  useEffect(() => {
    // Try all known cache keys
    const ch = localStorage.getItem('cache_houses') || localStorage.getItem('foreman_houses');
    if (ch) setHouses(JSON.parse(ch));
    base44.entities.House.list()
      .then(h => { setHouses(h); localStorage.setItem('cache_houses', JSON.stringify(h)); })
      .catch(() => {
        // Already loaded from cache above
      });
  }, []);

  const updateRow = (i, field, value) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const rowTotal = (r) => (parseFloat(r.quantity) || 0) * (parseFloat(r.price) || 0);
  const grandTotal = rows.reduce((sum, r) => sum + rowTotal(r), 0);

  const handlePhotoUpload = async (i, file) => {
    if (!file) return;
    updateRow(i, 'uploading', true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateRow(i, 'receipt_url', file_url);
    updateRow(i, 'uploading', false);
  };

  const handleSave = async () => {
    setLoading(true);
    const validRows = rows.filter(r => r.material && r.quantity && r.price);
    const records = validRows.map(r => ({
      date, house_name: houseName,
      material: r.material, quantity: parseFloat(r.quantity), unit: r.unit,
      price: parseFloat(r.price), total: rowTotal(r),
      supplier: r.supplier, buyer: r.buyer, comment: r.comment, receipt_url: r.receipt_url || '',
    }));
    if (!navigator.onLine) {
      records.forEach(r => addToQueue({ entity: 'Purchase', data: r, label: `${r.material} — ${fmt(r.total)}, ${houseName}` }));
      setLoading(false);
      setSaved(true);
      setTimeout(() => { setSaved(false); setRows([emptyRow()]); setHouseName(''); setDate(today()); }, 2000);
      return;
    }
    try {
      await Promise.all(records.map(r => base44.entities.Purchase.create(r)));
      await base44.entities.Notification.create({ title: 'Внесена закупка', message: `${validRows.length} позиций на ${fmt(grandTotal)}, дом: ${houseName}`, type: 'purchase', house_name: houseName, is_read: false });
    } catch (e) {
      records.forEach(r => addToQueue({ entity: 'Purchase', data: r, label: `${r.material} — ${fmt(r.total)}, ${houseName}` }));
    }
    setLoading(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setRows([emptyRow()]); setHouseName(''); setDate(today()); }, 2000);
  };

  const canSave = houseName && rows.some(r => r.material && r.quantity && r.price);

  return (
    <PageLayout title="Закупка" subtitle="Материалы и расходы">
      {saved ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <p className="text-xl font-semibold">Записано!</p>
          <Button variant="outline" className="mt-2" onClick={() => setSaved(false)}>+ Добавить ещё</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Дата</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Дом</Label>
              <div className="flex gap-2">
                <Select value={houseName} onValueChange={setHouseName}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Дом" /></SelectTrigger>
                  <SelectContent>
                    {houses.map(h => <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <QuickAddModal type="house" onAdd={h => { setHouses(prev => [...prev, h]); setHouseName(h.name); }} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Позиция {i + 1}</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Материал</Label>
                  <Input placeholder="Напр. Кирпич, цемент, доска..." value={row.material} onChange={e => updateRow(i, 'material', e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Кол-во</Label>
                    <Input type="number" placeholder="0" value={row.quantity} onChange={e => updateRow(i, 'quantity', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Ед. изм.</Label>
                    <Select value={row.unit} onValueChange={v => updateRow(i, 'unit', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Цена (₽)</Label>
                    <Input type="number" placeholder="0" value={row.price} onChange={e => updateRow(i, 'price', e.target.value)} />
                    {row.price && parseFloat(row.price) > 0 && (
                      <p className="text-xs text-primary font-medium mt-1">{Number(row.price).toLocaleString('ru-RU')} ₽</p>
                    )}
                  </div>
                </div>
                {rowTotal(row) > 0 && (
                  <div className="flex justify-between items-center bg-muted rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground">Сумма</span>
                    <span className="font-bold text-sm">{fmt(rowTotal(row))}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Поставщик</Label>
                    <Input placeholder="Магазин / Поставщик" value={row.supplier} onChange={e => updateRow(i, 'supplier', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Кто купил</Label>
                    <Input placeholder="Имя" value={row.buyer} onChange={e => updateRow(i, 'buyer', e.target.value)} />
                  </div>
                </div>

                {/* Photo receipt */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Фото чека</Label>
                  {row.receipt_url ? (
                    <div className="relative">
                      <img src={row.receipt_url} alt="Чек" className="w-full h-32 object-cover rounded-xl border border-border" />
                      <button
                        onClick={() => updateRow(i, 'receipt_url', '')}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                      <Camera className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {row.uploading ? 'Загрузка...' : 'Прикрепить фото чека'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={row.uploading}
                        onChange={e => e.target.files?.[0] && handlePhotoUpload(i, e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={addRow} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-2xl text-muted-foreground hover:border-primary hover:text-primary transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" />
            Добавить позицию
          </button>

          {grandTotal > 0 && (
            <div className="bg-foreground rounded-2xl p-4 flex justify-between items-center">
              <span className="text-white/70 text-sm">Итого по всем позициям</span>
              <span className="text-white font-bold text-xl">{fmt(grandTotal)}</span>
            </div>
          )}

          <Button className="w-full h-14 text-base font-semibold" onClick={handleSave} disabled={loading || !canSave}>
            {loading ? 'Сохранение...' : `Записать${rows.filter(r => r.material).length > 1 ? ` (${rows.filter(r => r.material).length} поз.)` : ''}`}
          </Button>
        </div>
      )}
    </PageLayout>
  );
}