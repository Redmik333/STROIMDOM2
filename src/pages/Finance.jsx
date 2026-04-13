import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '../components/PageLayout';
import { fmt } from '../utils/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

export default function Finance() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSalary, setTotalSalary] = useState(0);
  const [totalPurchase, setTotalPurchase] = useState(0);
  const [forecasts, setForecasts] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.House.list(),
      base44.entities.Salary.list(),
      base44.entities.Purchase.list(),
      base44.entities.Stage.list(),
    ]).then(([houses, salaries, purchases, stages]) => {
      const rows = houses.map(h => {
        const sal = salaries.filter(s => s.house_name === h.name).reduce((a, s) => a + (s.accrued || 0), 0);
        const pur = purchases.filter(p => p.house_name === h.name).reduce((a, p) => a + (p.total || 0), 0);
        return { name: h.name, salary: sal, purchase: pur, total: sal + pur };
      }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);

      setData(rows);
      setTotalSalary(salaries.reduce((a, s) => a + (s.accrued || 0), 0));
      setTotalPurchase(purchases.reduce((a, p) => a + (p.total || 0), 0));

      // Forecasts per house
      const STAGE_NAMES = ['Фундамент', 'Стены', 'Крыша', 'Инженерия', 'Отделка'];
      const fc = houses.filter(h => h.budget).map(h => {
        const sal = salaries.filter(s => s.house_name === h.name).reduce((a, s) => a + (s.accrued || 0), 0);
        const pur = purchases.filter(p => p.house_name === h.name).reduce((a, p) => a + (p.total || 0), 0);
        const spent = sal + pur;
        const budget = h.budget || 0;
        const remaining = budget - spent;
        const overBudget = remaining < 0;

        // Daily spend rate from all dated records
        const allDates = [
          ...salaries.filter(s => s.house_name === h.name && s.date).map(s => s.date),
          ...purchases.filter(p => p.house_name === h.name && p.date).map(p => p.date),
        ].sort();
        let daysToEmpty = null;
        let forecastDate = null;
        if (allDates.length >= 2 && spent > 0) {
          const firstDate = new Date(allDates[0]);
          const lastDate = new Date(allDates[allDates.length - 1]);
          const days = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
          const dailyRate = spent / days;
          if (dailyRate > 0 && remaining > 0) {
            daysToEmpty = Math.round(remaining / dailyRate);
            const fd = new Date();
            fd.setDate(fd.getDate() + daysToEmpty);
            forecastDate = fd.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
          }
        }

        // Overall progress
        const stageMap = {};
        stages.filter(s => s.house_name === h.name).forEach(s => {
          if (!stageMap[s.stage_name] || s.date > stageMap[s.stage_name].date) stageMap[s.stage_name] = s;
        });
        const progress = Math.round(STAGE_NAMES.reduce((sum, s) => sum + (stageMap[s]?.progress || 0), 0) / STAGE_NAMES.length);
        const remainingWork = 100 - progress;
        // Cost per 1% of progress
        const costPerPercent = progress > 0 ? spent / progress : 0;
        const projectedTotal = spent + costPerPercent * remainingWork;
        const projectedOverrun = projectedTotal - budget;

        return { name: h.name, budget, spent, remaining, overBudget, forecastDate, daysToEmpty, progress, projectedTotal, projectedOverrun };
      }).filter(f => f.budget > 0);

      setForecasts(fc);
      setLoading(false);
    });
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
        ))}
        <p className="font-semibold mt-1 border-t border-border pt-1">
          Итого: {fmt(payload.reduce((a, p) => a + p.value, 0))}
        </p>
      </div>
    );
  };

  return (
    <PageLayout title="Финансы" subtitle="Затраты по объектам" backTo="/">
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Всего</p>
              <p className="text-lg font-bold">{fmt(totalSalary + totalPurchase)}</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Зарплаты</p>
              <p className="text-lg font-bold text-orange-600">{fmt(totalSalary)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Закупки</p>
              <p className="text-lg font-bold text-blue-600">{fmt(totalPurchase)}</p>
            </div>
          </div>

          {/* Bar Chart */}
          {data.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">График по объектам</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}М` : v >= 1000 ? `${(v/1000).toFixed(0)}К` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={28} />
                  <Bar dataKey="salary" name="Зарплата" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="purchase" name="Закупки" stackId="a" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Budget Forecasts */}
          {forecasts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Прогноз бюджета</h3>
              {forecasts.map(f => (
                <div key={f.name} className={`rounded-2xl border p-4 space-y-3 ${f.overBudget || f.projectedOverrun > 0 ? 'bg-red-50 border-red-200' : 'bg-card border-border'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{f.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Бюджет: {fmt(f.budget)}</p>
                    </div>
                    {(f.overBudget || f.projectedOverrun > 0) && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Превышение
                      </span>
                    )}
                  </div>

                  {/* Budget bar */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Потрачено: {fmt(f.spent)}</span>
                      <span className={f.overBudget ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                        {f.overBudget ? `Перерасход: ${fmt(Math.abs(f.remaining))}` : `Остаток: ${fmt(f.remaining)}`}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${f.overBudget ? 'bg-red-500' : f.spent / f.budget > 0.8 ? 'bg-orange-400' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (f.spent / f.budget) * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-right text-muted-foreground mt-0.5">{Math.round((f.spent / f.budget) * 100)}% бюджета</div>
                  </div>

                  {/* Forecast row */}
                  <div className="grid grid-cols-2 gap-2">
                    {f.forecastDate && (
                      <div className="bg-background rounded-xl p-2.5 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Бюджет кончится</p>
                          <p className="text-xs font-semibold">{f.forecastDate} (~{f.daysToEmpty} дн.)</p>
                        </div>
                      </div>
                    )}
                    {f.progress > 0 && (
                      <div className={`rounded-xl p-2.5 flex items-center gap-2 ${f.projectedOverrun > 0 ? 'bg-red-100' : 'bg-background'}`}>
                        <TrendingUp className={`w-4 h-4 flex-shrink-0 ${f.projectedOverrun > 0 ? 'text-red-500' : 'text-green-500'}`} />
                        <div>
                          <p className="text-xs text-muted-foreground">Прогноз итога</p>
                          <p className={`text-xs font-semibold ${f.projectedOverrun > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {fmt(f.projectedTotal)}
                            {f.projectedOverrun > 0 && ` (+${fmt(f.projectedOverrun)})`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Таблица по объектам</h3>
            </div>
            <div className="divide-y divide-border">
              {data.map(row => (
                <div key={row.name} className="px-4 py-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="font-semibold text-sm">{row.name}</p>
                    <p className="font-bold text-sm">{fmt(row.total)}</p>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                    <span className="text-orange-500">ЗП: {fmt(row.salary)}</span>
                    <span className="text-blue-500">Закупки: {fmt(row.purchase)}</span>
                  </div>
                  {/* Stacked bar */}
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                    {row.total > 0 && (
                      <>
                        <div className="h-full bg-orange-400" style={{ width: `${(row.salary / row.total) * 100}%` }} />
                        <div className="h-full bg-blue-400" style={{ width: `${(row.purchase / row.total) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>
              ))}
              {data.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">Нет данных</div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}