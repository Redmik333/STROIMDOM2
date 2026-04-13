import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CheckCircle } from 'lucide-react';
import { addToQueue } from '../lib/offlineQueue';

const STAGES = [
  'Котлован / Земляные работы',
  'Фундамент',
  'Стены / Кладка',
  'Перекрытия',
  'Крыша / Кровля',
  'Окна и двери',
  'Инженерия (водопровод)',
  'Инженерия (канализация)',
  'Инженерия (электрика)',
  'Инженерия (отопление)',
  'Утепление / Изоляция',
  'Фасад / Наружная отделка',
  'Внутренняя отделка',
  'Стяжка / Полы',
  'Потолки',
  'Покраска / Обои',
  'Благоустройство территории',
  'Сдача объекта',
  'Свой вариант...',
];
const today = () => new Date().toISOString().split('T')[0];

export default function StageEntry() {
  const [houses, setHouses] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const [customStage, setCustomStage] = useState('');
  const [form, setForm] = useState({
    date: today(),
    house_name: '',
    stage_name: '',
    progress: 50,
    comment: '',
  });

  useEffect(() => {
    const ch = localStorage.getItem('cache_houses') || localStorage.getItem('foreman_houses');
    if (ch) setHouses(JSON.parse(ch));
    base44.entities.House.list().then(h => { setHouses(h); localStorage.setItem('cache_houses', JSON.stringify(h)); }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    if (!navigator.onLine) {
      addToQueue({ entity: 'Stage', data: form, label: `${form.house_name}: ${form.stage_name} — ${form.progress}%` });
      setLoading(false);
      setSaved(true);
      setTimeout(() => { setSaved(false); setForm({ date: today(), house_name: '', stage_name: '', progress: 50, comment: '' }); }, 2000);
      return;
    }
    try {
      await base44.entities.Stage.create(form);
      await base44.entities.Notification.create({ title: 'Обновлён этап', message: `${form.house_name}: ${form.stage_name} — ${form.progress}%`, type: 'stage', house_name: form.house_name, is_read: false });
    } catch (e) {
      addToQueue({ entity: 'Stage', data: form, label: `${form.house_name}: ${form.stage_name} — ${form.progress}%` });
    }
    setLoading(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm({ date: today(), house_name: '', stage_name: '', progress: 50, comment: '' });
    }, 2000);
  };

  return (
    <PageLayout title="Этап" subtitle="Прогресс строительства">
      {saved ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <p className="text-xl font-semibold text-foreground">Записано!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Дата</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>

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
            <Label className="text-sm font-medium mb-1.5 block">Этап</Label>
            <Select value={form.stage_name === customStage && customStage ? 'Свой вариант...' : form.stage_name} onValueChange={v => {
              if (v === 'Свой вариант...') {
                setForm(f => ({ ...f, stage_name: '' }));
              } else {
                setCustomStage('');
                setForm(f => ({ ...f, stage_name: v }));
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Выберите этап" /></SelectTrigger>
              <SelectContent>
                {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {(form.stage_name === '' && customStage !== undefined) || form.stage_name === 'Свой вариант...' ? (
              <Input
                className="mt-2"
                placeholder="Введите название этапа"
                value={customStage}
                onChange={e => { setCustomStage(e.target.value); setForm(f => ({ ...f, stage_name: e.target.value })); }}
              />
            ) : null}
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">
              Готовность — <span className="text-primary font-bold">{form.progress}%</span>
            </Label>
            <Slider
              value={[form.progress]}
              onValueChange={([v]) => setForm(f => ({ ...f, progress: v }))}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-4">
            <div className="w-full bg-border rounded-full h-3">
              <div
                className="bg-gradient-to-r from-orange-500 to-amber-400 h-3 rounded-full transition-all"
                style={{ width: `${form.progress}%` }}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Комментарий</Label>
            <Input placeholder="Необязательно" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
          </div>

          <Button
            className="w-full h-14 text-base font-semibold mt-2"
            onClick={handleSave}
            disabled={loading || !form.house_name || !form.stage_name || form.stage_name === 'Свой вариант...'}
          >
            {loading ? 'Сохранение...' : 'Записать'}
          </Button>
        </div>
      )}
    </PageLayout>
  );
}