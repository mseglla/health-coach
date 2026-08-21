export function parseNumber(value) {
  const number = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function localDateISO(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return localDateISO();
}

export function nowLocalDateTime(date = new Date()) {
  return `${localDateISO(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createId(prefix = 'record') {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

export function recordDate(dateTime) {
  return String(dateTime || '').slice(0, 10);
}

export function activeWeightRecords(weights = []) {
  return weights.filter(record => !record.deletedAt);
}

export function latestWeightRecord(weights = []) {
  return activeWeightRecords(weights).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0] || null;
}

export function latestWeight(weights = []) {
  return latestWeightRecord(weights)?.value ?? null;
}

export function weightForDate(weights = [], date) {
  return activeWeightRecords(weights)
    .filter(record => recordDate(record.measuredAt) === date)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0] || null;
}

export function dailyWeightSeries(weights = []) {
  const byDate = new Map();
  activeWeightRecords(weights)
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .forEach(record => byDate.set(recordDate(record.measuredAt), record));
  return [...byDate.values()].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
}

export function ageFromBirthDate(birthDate, today = new Date()) {
  if (!birthDate) return null;

  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return null;

  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!birthdayPassed) age -= 1;

  return age > 0 ? age : null;
}

export function bmr(settings, weight) {
  if (!weight || !settings.age || !settings.height) return null;
  const sexAdjustment = settings.sex === 'male' ? 5 : -161;
  return 10 * weight + 6.25 * settings.height - 5 * settings.age + sexAdjustment;
}

export function totalBurn(state, day) {
  if (day?.total != null) return Math.round(day.total);

  const profile = state.profile;
  const metabolicSettings = {
    age: ageFromBirthDate(profile?.birthDate),
    height: profile?.heightCm,
    sex: profile?.metabolicSex
  };

  const basal = bmr(metabolicSettings, latestWeight(state.weights));
  return basal ? Math.round(basal + (day?.active || 0)) : null;
}

export function burnSource(day) {
  return day?.total != null ? 'Apple Watch' : day?.active != null ? 'estimades' : '';
}

export function totalIntake(_state, day) {
  return day?.intake != null ? Math.round(day.intake) : null;
}

export function averageWeight(weights, count = 7, offset = 0) {
  const series = dailyWeightSeries(weights);
  const end = offset ? -offset : undefined;
  const start = -(count + offset);
  const values = series.slice(start, end).map(record => record.value);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function weightTrend(weights) {
  const current = averageWeight(weights, 7, 0);
  const previous = averageWeight(weights, 7, 7);
  return current != null && previous != null ? current - previous : null;
}

export function inferEnergyBalance(state) {
  const series = dailyWeightSeries(state.weights || []);

  if (series.length < 8) {
    return {
      available: false,
      reason: 'insufficient_weight_data',
      confidence: 'none'
    };
  }

  const latestDate = recordDate(series.at(-1).measuredAt);
  const anchor = new Date(`${latestDate}T12:00:00`);

  const dateOffset = days => {
    const date = new Date(anchor);
    date.setDate(date.getDate() - days);
    return localDateISO(date);
  };

  const currentStart = dateOffset(6);
  const previousStart = dateOffset(13);
  const previousEnd = dateOffset(7);

  const inRange = (record, start, end) => {
    const date = recordDate(record.measuredAt);
    return date >= start && date <= end;
  };

  const current = series.filter(record =>
    inRange(record, currentStart, latestDate)
  );

  const previous = series.filter(record =>
    inRange(record, previousStart, previousEnd)
  );

  if (current.length < 4 || previous.length < 4) {
    return {
      available: false,
      reason: 'insufficient_window_coverage',
      confidence: 'none',
      currentSamples: current.length,
      previousSamples: previous.length
    };
  }

  const mean = records =>
    records.reduce((sum, record) => sum + record.value, 0) /
    records.length;

  const currentAverage = mean(current);
  const previousAverage = mean(previous);
  const weeklyWeightChangeKg = currentAverage - previousAverage;

  // Approximation for first-pass inference only.
  // Positive = estimated deficit; negative = estimated surplus.
  const estimatedDailyBalanceKcal =
    -(weeklyWeightChangeKg * 7700 / 7);

  const absoluteBalance = Math.abs(estimatedDailyBalanceKcal);

  let status = 'maintenance';
  if (estimatedDailyBalanceKcal > 150) status = 'deficit';
  if (estimatedDailyBalanceKcal < -150) status = 'surplus';

  const confidence =
    current.length >= 5 &&
    previous.length >= 5 &&
    Math.abs(weeklyWeightChangeKg) <= 1.2
      ? 'medium'
      : 'low';

  return {
    available: true,
    status,
    confidence,
    currentSamples: current.length,
    previousSamples: previous.length,
    currentAverage,
    previousAverage,
    weeklyWeightChangeKg,
    estimatedDailyBalanceKcal: Math.round(estimatedDailyBalanceKcal),
    absoluteBalanceKcal: Math.round(absoluteBalance),
    periodStart: previousStart,
    periodEnd: latestDate
  };
}

export function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T12:00:00`);
  const now = new Date();
  return Math.max(0, Math.ceil((target - now) / 86400000));
}

export function formatKg(value) {
  return value != null ? `${Number(value).toFixed(1).replace('.', ',')} kg` : '—';
}

export function formatDateShort(dateString) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' }).format(new Date(`${dateString}T12:00:00`));
}

export function formatDateTime(dateTime) {
  if (!dateTime) return '—';
  return new Intl.DateTimeFormat('ca-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateTime));
}
