import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Active, Over } from '@dnd-kit/core';
import { expect, test } from 'vitest';
import { en } from '../i18n/messages/en';
import { zhCN } from '../i18n/messages/zh-CN';
import { sortableAccessibility } from './sortableAccessibility';

const labels: Record<string, string> = { entry_4a4f: 'Severance', entry_9c1d: 'Iron Man' };
const node = (id: string) => ({ id }) as unknown as Active & Over;

test('reorder announcements name items by their label, never by internal id', () => {
  for (const catalog of [en, zhCN]) {
    const { announcements, screenReaderInstructions } = sortableAccessibility(catalog, (id) => labels[String(id)]);
    const messages = [
      announcements?.onDragStart({ active: node('entry_4a4f') }),
      announcements?.onDragOver({ active: node('entry_4a4f'), over: node('entry_9c1d') }),
      announcements?.onDragEnd({ active: node('entry_4a4f'), over: node('entry_9c1d') }),
      announcements?.onDragEnd({ active: node('entry_4a4f'), over: node('entry_4a4f') }),
      announcements?.onDragCancel({ active: node('entry_4a4f'), over: null }),
      screenReaderInstructions?.draggable,
    ];
    for (const message of messages) {
      expect(message).toBeTruthy();
      expect(message).not.toMatch(/entry_/);
    }
    expect(messages[2]).toContain('Severance');
    expect(messages[2]).toContain('Iron Man');
  }
});

test('every DndContext passes localized accessibility messages', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.tsx')) files.push(full);
    }
  };
  walk(path.resolve(import.meta.dirname, '..'));
  const contexts = files.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/<DndContext\b[^>]*>/g)].map((match) => ({ file, tag: match[0] })),
  );
  expect(contexts.length).toBeGreaterThan(0);
  for (const { file, tag } of contexts) expect(tag, file).toContain('accessibility=');
});
