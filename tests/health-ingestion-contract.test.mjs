// Static wiring checks, not a replacement for Swift compilation or live SQL/RLS tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = 'ios/ATLESConnector/ATLESConnector/';
const read = name => readFileSync(root + name, 'utf8');
const core = read('HealthIngestionCore.swift');
const catalog = read('HealthMetricCatalog.swift');
const reader = read('HealthKitSampleReader.swift');
const manager = read('HealthKitManager.swift');
const writer = read('SupabaseHealthSyncManager.swift');
const coordinator = read('HealthSampleIngestionCoordinator.swift');
const background = read('BackgroundSyncCoordinator.swift');
const migration = readFileSync('supabase/migrations/20260827060000_health_samples_ingestion.sql', 'utf8');
const project = readFileSync('ios/ATLESConnector/ATLESConnector.xcodeproj/project.pbxproj', 'utf8');
const types = ['resting_heart_rate_bpm', 'hrv_sdnn_ms', 'vo2_max_ml_kg_min',
  'body_mass_kg', 'body_fat_percent', 'lean_body_mass_kg', 'sleep_stage'];
for (const type of types) {
  assert.ok(core.includes(`"${type}"`));
  assert.ok(migration.includes(`'${type}'`));
}
assert.match(manager, /HealthMetricCatalog\.readTypes/);
assert.match(manager, /HealthMetricCatalog\.observed/);
assert.match(background, /onSamplesChanged:/);
assert.match(background, /maxPages: 4/);
assert.match(catalog, /HKCategoryType\(\.sleepAnalysis\)/);
assert.match(reader, /HKAnchoredObjectQuery/);
assert.doesNotMatch(reader, /await store\.getRequestStatusForAuthorization/);
assert.match(reader, /getRequestStatusForAuthorization\(toShare: \[\], read: read\) \{ status, error in/);
assert.match(reader, /predicate: nil, anchor: anchor/);
assert.match(reader, /kind == \.bodyFat \? raw \* 100 : raw/);
assert.match(reader, /HKMetadataKeyTimeZone/);
assert.match(reader, /map\(\\\.uuid\)/);
assert.match(reader, /requiringSecureCoding: true/);
assert.match(core, /page\.nextAnchor == anchor/);
assert.ok(core.indexOf('try await writer.write') < core.indexOf('try cursors.save'));
assert.match(writer, /ingest_health_sample_page/);
assert.match(writer, /decode\(Acknowledgement\.self/);
assert.match(coordinator, /writer\.ingestionBackendScope/);
assert.match(coordinator, /while let previous = running/);
assert.match(migration, /security invoker set search_path = ''/);
assert.match(migration, /v_user uuid := auth\.uid\(\)/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /where not exists/);
assert.match(migration, /health_sample_tombstones/);
assert.match(migration, /health_samples enable row level security/);
assert.match(migration, /health_sample_tombstones enable row level security/);
assert.doesNotMatch(migration, /alter table (?:public\.)?(?:weight_logs|health_daily_metrics|activity_logs)/);
assert.equal((project.match(/INFOPLIST_KEY_ATLESHealthIngestionV2Enabled = NO;/g) || []).length, 2);
console.log('PASS — static ingestion wiring (Swift and SQL execution still require native/DEV checks)');
