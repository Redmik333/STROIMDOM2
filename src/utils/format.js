export function fmt(n, withKopecks = false) {
  const num = Number(n || 0);
  if (withKopecks && num % 1 !== 0) {
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
  }
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}