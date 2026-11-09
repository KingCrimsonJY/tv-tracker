import type { Request } from 'express';
import { expect, test } from 'vitest';
import { getClientIp, isSameOriginRequest } from './auth.ts';

const request = (headers: Record<string, string>) =>
  ({ headers, socket: { remoteAddress: '10.0.0.2' } }) as unknown as Request;

test('the client IP comes from the entry the trusted proxy appended, not a spoofed first entry', () => {
  const req = request({ 'x-forwarded-for': '1.2.3.4, 198.51.100.7' });
  expect(getClientIp(req, true)).toBe('198.51.100.7');
  expect(getClientIp(req, false)).toBe('10.0.0.2');
});

test('X-Forwarded-Host only overrides Host behind a trusted proxy', () => {
  const req = request({
    origin: 'https://evil.example',
    host: 'zhenji.example',
    'x-forwarded-host': 'evil.example',
  });
  expect(isSameOriginRequest(req, false)).toBe(false);
  expect(isSameOriginRequest(req, true)).toBe(true);
  expect(isSameOriginRequest(request({ origin: 'https://zhenji.example', host: 'zhenji.example' }))).toBe(true);
});
