import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync('sw.js', 'utf8');

assert.doesNotThrow(
  () => new Function(source),
  'El service worker ha de tenir sintaxi JavaScript vàlida'
);

const assetBlock = source.match(
  /const ASSETS = \[([\s\S]*?)\];/
);

assert.ok(
  assetBlock,
  'El service worker ha de declarar els recursos de la PWA'
);

const assets = [
  ...assetBlock[1].matchAll(/'([^']+)'/g)
].map(match => match[1]);

assert.ok(
  assets.length > 0,
  'La llista de recursos no pot estar buida'
);

assets
  .filter(asset => asset !== './')
  .forEach(asset => {
    assert.ok(
      existsSync(resolve(asset.replace(/^\.\//, ''))),
      `No existeix el recurs de la PWA: ${asset}`
    );
  });

console.log('PASS — service worker vàlid i recursos disponibles');
