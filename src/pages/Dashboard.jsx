import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageLayout from '../components/PageLayout';
import { TrendingUp, TrendingDown, AlertCircle, Download, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fmt, fmtNum } from '../utils/format';
import { Link } from 'react-router-dom';

const PIE_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e'];

function ProgressBar({ value }) {
  return (
    <div className="w-full bg-border rounded-full h-2.5">
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-xs">
        <p className="font-semibold">{payload[0].name}</p>
        <p className="text-muted-foreground">{fmtNum(payload[0].value)} ₽</p>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const isOwner = user?.role === 'admin';

  const [houses, setHouses] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [stages, setStages] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.House.list(),
      base44.entities.Salary.list(),
      base44.entities.Purchase.list(),
      base44.entities.Stage.list(),
      base44.entities.Sale.list(),
    ]).then(([h, s, p, st, sa]) => {
      // Foreman sees only their houses
      const filteredHouses = isOwner ? h : h.filter(house => house.foreman_email === user?.email);
      const houseNames = new Set(filteredHouses.map(x => x.name));
      setHouses(filteredHouses);
      setSalaries(isOwner ? s : s.filter(x => houseNames.has(x.house_name)));
      setPurchases(isOwner ? p : p.filter(x => houseNames.has(x.house_name)));
      setStages(st);
      setSales(sa);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <PageLayout title="Отчёт" subtitle="Финансы и прогресс">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  const houseStats = houses.map(house => {
    const name = house.name;
    const salaryTotal = salaries.filter(s => s.house_name === name).reduce((a, s) => a + (s.accrued || 0), 0);
    const salaryPaid = salaries.filter(s => s.house_name === name).reduce((a, s) => a + (s.paid || 0), 0);
    const salaryDebt = salaryTotal - salaryPaid;
    const purchaseTotal = purchases.filter(p => p.house_name === name).reduce((a, p) => a + (p.total || 0), 0);
    const totalCost = salaryTotal + purchaseTotal;
    const budget = house.budget || 0;
    const deviation = budget > 0 ? totalCost - budget : null;

    const STAGE_ORDER = ['Фундамент', 'Стены', 'Крыша', 'Инженерия', 'Отделка'];
    const stageMap = {};
    stages.filter(s => s.house_name === name).forEach(s => {
      if (!stageMap[s.stage_name] || s.date > stageMap[s.stage_name].date) stageMap[s.stage_name] = s;
    });
    const totalProgress = STAGE_ORDER.reduce((sum, s) => sum + (stageMap[s]?.progress || 0), 0) / STAGE_ORDER.length;

    const latestSale = sales.filter(s => s.house_name === name).sort((a, b) => (b.created_date > a.created_date ? 1 : -1))[0];
    const salePrice = latestSale?.sale_price || house.sale_price || 0;
    const profit = salePrice - totalCost;

    return { name, salaryTotal, salaryDebt, purchaseTotal, totalCost, totalProgress, salePrice, profit, budget, deviation, latestSale, id: house.id };
  });

  const workerDebtMap = {};
  salaries.forEach(s => {
    const debt = (s.accrued || 0) - (s.paid || 0);
    if (!workerDebtMap[s.worker_name]) workerDebtMap[s.worker_name] = 0;
    workerDebtMap[s.worker_name] += debt;
  });
  const workerDebts = Object.entries(workerDebtMap).filter(([, d]) => d > 0);

  const totalSold = sales.filter(s => s.status === 'продан').length;
  const totalBuilding = houses.length - totalSold;

  // Pie charts data
  const totalSalaryAll = salaries.reduce((a, s) => a + (s.accrued || 0), 0);
  const totalPurchaseAll = purchases.reduce((a, p) => a + (p.total || 0), 0);
  const overallPieData = [
    { name: 'Зарплата', value: Math.round(totalSalaryAll) },
    { name: 'Материалы', value: Math.round(totalPurchaseAll) },
  ].filter(d => d.value > 0);

  const housesPieData = houseStats.map((h, i) => ({
    name: h.name,
    value: Math.round(h.totalCost),
    color: PIE_COLORS[i % PIE_COLORS.length],
  })).filter(d => d.value > 0);

  const exportCSV = () => {
    const headers = ['Дом', 'ЗП (₽)', 'Материалы (₽)', 'Итого (₽)', 'Бюджет (₽)', 'Отклонение (₽)', 'Цена (₽)', 'Прибыль (₽)', 'Готовность (%)'];
    const rows = houseStats.map(h => [h.name, h.salaryTotal.toFixed(2), h.purchaseTotal.toFixed(2), h.totalCost.toFixed(2), (h.budget || 0).toFixed(2), h.deviation !== null ? h.deviation.toFixed(2) : '', h.salePrice.toFixed(2), h.profit.toFixed(2), Math.round(h.totalProgress)]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `отчет_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <PageLayout title="Отчёт" subtitle="Финансы и прогресс">
      {isOwner && (
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Выгрузить Excel
          </Button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Строится</p>
          <p className="text-3xl font-bold">{totalBuilding}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Продано</p>
          <p className="text-3xl font-bold text-green-600">{totalSold}</p>
        </div>
      </div>

      {/* Pie charts */}
      {overallPieData.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Структура затрат</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={overallPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {overallPieData.map((_, i) => <Cell key={i} fill={['#f97316', '#3b82f6'][i]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {housesPieData.length > 1 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">По объектам</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={housesPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {housesPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Per house */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">По домам</h2>
      <div className="space-y-4 mb-6">
        {houseStats.map(h => (
          <div key={h.name} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-bold text-foreground text-lg">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.latestSale?.status || 'строится'}</p>
              </div>
              {isOwner && (
                <div className={`flex items-center gap-1 ${h.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {h.profit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="font-bold text-sm">{fmt(h.profit)}</span>
                </div>
              )}
            </div>

            <div className={`grid gap-2 mb-4 text-center ${isOwner ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="bg-muted rounded-xl p-2">
                <p className="text-xs text-muted-foreground">ЗП</p>
                <p className="text-sm font-semibold">{fmt(h.salaryTotal)}</p>
              </div>
              <div className="bg-muted rounded-xl p-2">
                <p className="text-xs text-muted-foreground">Материалы</p>
                <p className="text-sm font-semibold">{fmt(h.purchaseTotal)}</p>
              </div>
              {isOwner && (
                <div className="bg-muted rounded-xl p-2">
                  <p className="text-xs text-muted-foreground">Цена</p>
                  <p className="text-sm font-semibold">{fmt(h.salePrice)}</p>
                </div>
              )}
            </div>

            {isOwner && h.budget > 0 && (
              <div className={`flex items-center justify-between rounded-xl px-3 py-2 mb-3 ${h.deviation > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                <span className="text-xs font-medium text-muted-foreground">Бюджет {fmt(h.budget)}</span>
                <span className={`text-xs font-bold ${h.deviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {h.deviation > 0 ? '+' : ''}{fmt(h.deviation)}
                </span>
              </div>
            )}

            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Готовность</span>
                <span className="font-medium text-foreground">{Math.round(h.totalProgress)}%</span>
              </div>
              <ProgressBar value={h.totalProgress} />
            </div>

            <div className="flex items-center justify-between">
              {h.salaryDebt > 0 ? (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 flex-1 mr-2">
                  <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <p className="text-xs text-orange-700">Долг: <span className="font-bold">{fmt(h.salaryDebt)}</span></p>
                </div>
              ) : <div />}
              <Link to={`/history/${encodeURIComponent(h.name)}`}>
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  <History className="w-3 h-3" />
                  История
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {workerDebts.length > 0 && isOwner && (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Долги рабочим</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
            {workerDebts.map(([name, debt], i) => (
              <div key={name} className={`flex justify-between items-center px-5 py-3.5 ${i < workerDebts.length - 1 ? 'border-b border-border' : ''}`}>
                <span className="font-medium">{name}</span>
                <span className="font-bold text-orange-600">{fmt(debt)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {houseStats.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Пока нет данных</p>
        </div>
      )}
    </PageLayout>
  );
}