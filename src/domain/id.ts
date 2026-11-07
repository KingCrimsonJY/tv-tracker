function formatBytesAsUuidV4(bytes: Uint8Array): string {
  const b = new Uint8Array(bytes);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function generateUuid(options: { forceFallback?: boolean } = {}): string {
  const cryptoObj = globalThis.crypto;
  if (!options.forceFallback && cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return formatBytesAsUuidV4(bytes);
  }
  const fallbackBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    fallbackBytes[i] = Math.floor(Math.random() * 256);
  }
  return formatBytesAsUuidV4(fallbackBytes);
}

export function createRandomId(prefix?: string, options: { forceFallback?: boolean } = {}): string {
  const uuid = generateUuid(options);
  return prefix ? `${prefix}_${uuid}` : uuid;
}
