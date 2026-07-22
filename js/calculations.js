export function parseNumber(value) {
  const number = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function latestWeight(days) {
  return [...days].reverse().find(day => day.weight)?.weight ?? null;
}

export function bmr(settings, weight) {
  if (!weight || !settings.age || !settings.height) return null;
  const sexAdjustment = settings.sex === 'male' ? 5 : -161;
  return 10 * weight + 6.25 * settings.height - 5 * settings.age + sexAdjustment;
}

export function totalBurn(state, day) {
  const basal = bmr(state.settings, day.weight || latestWeight(state.days));
  return basal ? Math.round(basal + (day.active || 0)) : null;
}

export function averageWeight(days, count = 7, offset = 0) {
  const weighted = days.filter(day => day.weight);
  const end = offset ? -offset : undefined;
  const start = -(count + offset);
  const values = weighted.slice(start, end).map(day => day.weight);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function weightTrend(days) {
  const current = averageWeight(days, 7, 0);
  const previous = averageWeight(days, 7, 7);
  return current != null && previous != null ? current - previous : null;
}

export function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T12:00:00`);
  const now = new Date();
  return Math.max(0, Math.ceil((target - now) / 86400000));
}

export function formatKg(value) {
  return value != null ? `${value.toFixed(1).replace('.', ',')} kg` : '—';
}

export function formatDateShort(dateString) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' }).format(new Date(`${dateString}T12:00:00`));
}
