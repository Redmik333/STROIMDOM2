import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import { Wallet, ShoppingCart, Camera, Download } from 'lucide-react';
import { fmt } from '../utils/format';
import { Button } from '@/components/ui/button';

export default function HouseHistory() {
  const houseName = decodeURIComponent(window.location.pathname.split('/history/')[1] || '');
  const [salaries, setSalaries] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [lightbox, setLightbox] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Salary.filter({ house_name: houseName }),
      base44.entities.Purchase.filter({ house_name: houseName }),
      base44.entities.Stage.filter({ house_name: houseName }),
    ]).then(([s, p, st]) => {
      setSalaries(s);
      setPurchases(p);
      setStages(st);
      setLoading(false);
    });
  }, [houseName]);

  const downloadPDF = async () => {
    setPdfLoading(true);
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Report: ${houseName}`, 14, y); y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('ru-RU')}`, 14, y); y += 12;

    // Totals
    const totalSal = salaries.reduce((a, s) => a + (s.accrued || 0), 0);
    const totalPur = purchases.reduce((a, p) => a + (p.total || 0), 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY', 14, y); y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Salaries: ${totalSal.toLocaleString('ru-RU')} RUB`, 14, y); y += 6;
    doc.text(`Purchases: ${totalPur.toLocaleString('ru-RU')} RUB`, 14, y); y += 6;
    doc.text(`Total: ${(totalSal + totalPur).toLocaleString('ru-RU')} RUB`, 14, y); y += 12;

    // Stages
    if (stages.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('STAGES', 14, y); y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      // Latest per stage
      const stageMap = {};
      stages.forEach(s => { if (!stageMap[s.stage_name] || s.date > stageMap[s.stage_name].date) stageMap[s.stage_name] = s; });
      Object.values(stageMap).forEach(s => {
        doc.text(`${s.stage_name}: ${s.progress}%  (${s.date})`, 14, y); y += 5;
        if (y > 270) { doc.addPage(); y = 20; }
      });
      y += 5;
    }

    // Purchases
    if (purchases.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PURCHASES', 14, y); y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      purchases.sort((a, b) => (b.date > a.date ? 1 : -1)).forEach(p => {
        const line = `${p.date}  ${p.material}  ${p.quantity} ${p.unit || ''}  ${(p.total || 0).toLocaleString('ru-RU')} RUB  ${p.supplier || ''}`;
        doc.text(line.substring(0, 90), 14, y); y += 5;
        if (y > 270) { doc.addPage(); y = 20; }
      });
      y += 5;
    }

    // Salaries
    if (salaries.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('SALARIES', 14, y); y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      salaries.sort((a, b) => (b.date > a.date ? 1 : -1)).forEach(s => {
        const line = `${s.date}  ${s.worker_name}  ${s.payment_type || ''}  Accrued: ${(s.accrued || 0).toLocaleString('ru-RU')}  Paid: ${(s.paid || 0).toLocaleString('ru-RU')}`;
        doc.text(line.substring(0, 90), 14, y); y += 5;
        if (y > 270) { doc.addPage(); y = 20; }
      });
    }

    doc.save(`${houseName}_report.pdf`);
    setPdfLoading(false);
  };

  const salaryItems = salaries.map(s => ({ ...s, _type: 'salary', _date: s.date }));
  const purchaseItems = purchases.map(p => ({ ...p, _type: 'purchase', _date: p.date }));
  const allItems = [...salaryItems, ...purchaseItems].sort((a, b) => (b._date > a._date ? 1 : -1));
  const displayed = tab === 'all' ? allItems : tab === 'salary' ? salaryItems.sort((a, b) => (b._date > a._date ? 1 : -1)) : purchaseItems.sort((a, b) => (b._date > a._date ? 1 : -1));

  return (
    <PageLayout title={`История: ${houseName}`} subtitle="Все операции по дому" backTo="/dashboard">
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={downloadPDF} disabled={pdfLoading} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          {pdfLoading ? 'Генерация...' : 'Скачать отчёт PDF'}
        </Button>
      </div>
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Чек" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {[['all', 'Все'], ['salary', 'ЗП'], ['purchase', 'Закупки']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Нет записей</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item._type === 'salary' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                  {item._type === 'salary'
                    ? <Wallet className="w-4 h-4 text-orange-500" />
                    : <ShoppingCart className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {item._type === 'salary' ? item.worker_name : item.material}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item._date}
                    {item._type === 'salary' && item.payment_type ? ` · ${item.payment_type}` : ''}
                    {item._type === 'purchase' && item.supplier ? ` · ${item.supplier}` : ''}
                    {item._type === 'purchase' && item.unit ? ` · ${item.quantity} ${item.unit}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-foreground">
                    {item._type === 'salary' ? fmt(item.accrued) : fmt(item.total)}
                  </p>
                  {item._type === 'salary' && (item.accrued - item.paid) > 0 && (
                    <p className="text-xs text-orange-500">долг {fmt(item.accrued - item.paid)}</p>
                  )}
                </div>
              </div>

              {/* Receipt photo preview */}
              {item._type === 'purchase' && item.receipt_url && (
                <button
                  onClick={() => setLightbox(item.receipt_url)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Camera className="w-3 h-3" />
                  Фото чека
                  <img src={item.receipt_url} alt="чек" className="w-10 h-8 object-cover rounded-md border border-border ml-1" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}