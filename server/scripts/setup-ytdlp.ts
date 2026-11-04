import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function getPlatformBinaryName(): string {
  if (process.platform === 'darwin') {
    return 'yt-dlp_macos';
  }
  return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
}

function getReleaseBaseUrl(version: string): string {
  const clean = version.trim() || 'latest';
  if (clean === 'latest') {
    return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';
  }
  return `https://github.com/yt-dlp/yt-dlp/releases/download/${encodeURIComponent(clean)}`;
}

export function parseExpectedSha256(sumsText: string, binaryName: string): string | null {
  for (const rawLine of sumsText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([0-9a-fA-F]{64})\s+\*?(\S+)$/);
    if (match && match[2] === binaryName) {
      return match[1]!.toLowerCase();
    }
  }
  return null;
}

async function main() {
  const version = process.env.YTDLP_VERSION?.trim() || 'latest';
  const targetPath =
    process.env.YTDLP_OUT?.trim() || path.resolve(process.cwd(), '.bin', 'yt-dlp');
  const binName = getPlatformBinaryName();
  const baseUrl = getReleaseBaseUrl(version);

  const sumsUrl = `${baseUrl}/SHA2-256SUMS`;
  const binUrl = `${baseUrl}/${binName}`;

  console.log(`[setup:ytdlp] Downloading ${binName} (version: ${version})...`);

  const [sumsRes, binRes] = await Promise.all([
    fetch(sumsUrl, { redirect: 'follow' }),
    fetch(binUrl, { redirect: 'follow' }),
  ]);

  if (!sumsRes.ok) {
    throw new Error(`Failed to fetch SHA2-256SUMS (${sumsUrl}): HTTP ${sumsRes.status}`);
  }
  if (!binRes.ok) {
    throw new Error(`Failed to fetch ${binName} (${binUrl}): HTTP ${binRes.status}`);
  }

  const [sumsText, binArrayBuffer] = await Promise.all([
    sumsRes.text(),
    binRes.arrayBuffer(),
  ]);

  const expectedHash = parseExpectedSha256(sumsText, binName);
  if (!expectedHash) {
    throw new Error(`Could not find SHA-256 entry for ${binName} in SHA2-256SUMS`);
  }

  const binBuffer = Buffer.from(binArrayBuffer);
  const actualHash = crypto.createHash('sha256').update(binBuffer).digest('hex').toLowerCase();

  if (actualHash !== expectedHash) {
    throw new Error(
      `SHA-256 checksum mismatch for ${binName}: expected ${expectedHash}, got ${actualHash}`
    );
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, binBuffer, { mode: 0o755 });
  fs.chmodSync(tmpPath, 0o755);
  fs.renameSync(tmpPath, targetPath);

  console.log(`[setup:ytdlp] Verified SHA-256 (${actualHash}) and installed to ${targetPath}`);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isDirectRun) {
  main().catch((err) => {
    console.error('[setup:ytdlp] Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
