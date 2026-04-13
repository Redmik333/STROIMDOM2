import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Plus } from 'lucide-react';

export default function QuickAddModal({ type, onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const isWorker = type === 'worker';
  const label = isWorker ? 'работника' : 'дом';
  const placeholder = isWorker ? 'Напр. Иван Петров' : 'Напр. Дом №3';

  const handleAdd = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const record = isWorker
        ? await base44.entities.Worker.create({ name: name.trim() })
        : await base44.entities.House.create({ name: name.trim(), status: 'строится' });
      onAdd(record);
      setName('');
      setOpen(false);
    } catch (e) {
      alert('Нет прав для создания. Попросите владельца добавить дом.');
    }
    setLoading(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
        title={`Добавить ${label}`}
      >
        <Plus className="w-4 h-4 text-primary" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Добавить {label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                {isWorker ? 'Имя работника' : 'Название дома'}
              </Label>
              <Input
                autoFocus
                placeholder={placeholder}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={loading || !name.trim()}>
              {loading ? 'Добавление...' : 'Добавить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}