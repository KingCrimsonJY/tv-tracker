import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createDemoDirectory } from './demoDirectory.ts';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true }); });
function setup() { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-test-')); roots.push(root); return root; }
test('ignores real DATA_DIR and preserves its contents', () => {
  const root = setup(); const real = path.join(root, 'production'); fs.mkdirSync(real);
  fs.writeFileSync(path.join(real, 'keep'), 'valuable');
  expect(createDemoDirectory(root, real)).toBe(path.join(root, 'data-demo'));
  expect(fs.readFileSync(path.join(real, 'keep'), 'utf8')).toBe('valuable');
});
test('refuses existing, protected and symlinked destinations without deleting anything', () => {
  const root = setup(); const demo = path.join(root, 'data-demo');
  expect(() => createDemoDirectory(root, demo)).toThrow('PROTECTED');
  expect(() => createDemoDirectory(root, root)).toThrow('PROTECTED');
  fs.mkdirSync(demo); fs.writeFileSync(path.join(demo, 'keep'), 'safe');
  expect(() => createDemoDirectory(root)).toThrow();
  expect(fs.readFileSync(path.join(demo, 'keep'), 'utf8')).toBe('safe');
  const other = setup(); fs.symlinkSync(demo, path.join(other, 'data-demo'));
  expect(() => createDemoDirectory(other)).toThrow();
  expect(fs.readFileSync(path.join(demo, 'keep'), 'utf8')).toBe('safe');
});
