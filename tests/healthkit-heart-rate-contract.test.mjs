import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = readFileSync(
  'ios/ATLESConnector/ATLESConnector/HealthKitManager.swift',
  'utf8'
);

const migration = readFileSync(
  'supabase/migrations/20260822210000_add_daily_heart_rate_metrics.sql',
  'utf8'
);

const backgroundCoordinator = readFileSync(
  'ios/ATLESConnector/ATLESConnector/BackgroundSyncCoordinator.swift',
  'utf8'
);

for (const metricType of [
  'heart_rate_avg_bpm',
  'heart_rate_min_bpm',
  'heart_rate_max_bpm'
]) {
  assert.match(swift, new RegExp(`"${metricType}"`));
  assert.match(migration, new RegExp(`'${metricType}'`));
}

assert.match(
  swift,
  /result \+= try await loadHeartRateHistory\(/
);

assert.match(swift, /\.discreteAverage/);
assert.match(swift, /\.discreteMin/);
assert.match(swift, /\.discreteMax/);
assert.match(swift, /unit: "bpm"/);
assert.match(
  swift,
  /onHeartRateChanged: @escaping \(\) async -> Void/
);
assert.match(
  swift,
  /quantityType\(forIdentifier: \.heartRate\),\s*\.hourly/
);
assert.match(
  swift,
  /await onHeartRateChanged\(\)/
);
assert.match(
  backgroundCoordinator,
  /onHeartRateChanged:/
);
assert.match(
  backgroundCoordinator,
  /await self\?\.syncDailyMetrics\(\)/
);

console.log(
  'PASS — contracte diari de freqüència cardíaca coherent'
);
