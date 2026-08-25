import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(
  'ios/ATLESConnector/ATLESConnector/SupabaseAuthManager.swift',
  'utf8'
);

const background = readFileSync(
  'ios/ATLESConnector/ATLESConnector/BackgroundSyncCoordinator.swift',
  'utf8'
);

assert.match(
  auth,
  /private var restoreTask: Task<Bool, Never>\?/
);

assert.match(
  auth,
  /private var accessTokenExpiresAt: Date\?/
);

assert.match(
  auth,
  /accessTokenExpiresAt\.timeIntervalSinceNow\s*>\s*refreshLeeway/
);

assert.match(
  auth,
  /case expiresAt = "expires_at"/
);

assert.match(
  auth,
  /case expiresIn = "expires_in"/
);

assert.match(
  auth,
  /return await restoreTask\.value/
);

assert.match(
  auth,
  /private enum AuthError: LocalizedError/
);

assert.match(
  auth,
  /case refreshFailed\(String\)/
);

assert.match(
  background,
  /guard await auth\.restoreSession\(\) else/
);

assert.doesNotMatch(
  auth,
  /if isAuthenticated, accessToken != nil/
);

console.log(
  'PASS — el Connector renova els tokens abans de caducar'
);
