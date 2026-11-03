import fs from 'node:fs';
import path from 'node:path';
import type { ZhenjiExportV2 } from '../../src/domain/types.ts';
import type { DbContext } from './types.ts';

export function todayDateStr(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function formatTimeHHmmss(now = new Date()): string {
  return now.toISOString().slice(11, 19).replace(/:/g, '');
}

const DAILY_BACKUP_REGEX = /^tracker-\d{4}-\d{2}-\d{2}\.db$/;
const SAFETY_BACKUP_REGEX =
  /^tracker-\d{4}-\d{2}-\d{2}-\d{6}-pre-(?:import|migration)(?:-\d+)?\.db$/;
const DAILY_EXPORT_REGEX = /^zhenji-\d{4}-\d{2}-\d{2}\.json$/;

export function pruneMatchingFilesKeepingNewest(
  dirPath: string,
  pattern: RegExp,
  keepCount: number
): void {
  if (!fs.existsSync(dirPath)) return;
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => pattern.test(f))
    .sort();
  if (files.length <= keepCount) return;
  const toDelete = files.slice(0, files.length - keepCount);
  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(dirPath, file));
    } catch (err) {
      console.error(`Failed to prune old file ${file}:`, err);
    }
  }
}

export function createSafetyBackup(
  ctx: DbContext,
  kind: 'pre-migration' | 'pre-import',
  now = new Date()
): string | null {
  if (ctx.isMemory || !ctx.dataDir) return null;
  const backupsDir = path.join(ctx.dataDir, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const dateStr = todayDateStr(now);
  const timeStr = formatTimeHHmmss(now);
  let baseName = `tracker-${dateStr}-${timeStr}-${kind}.db`;
  let targetPath = path.join(backupsDir, baseName);
  let suffix = 1;
  while (fs.existsSync(targetPath)) {
    baseName = `tracker-${dateStr}-${timeStr}-${kind}-${suffix}.db`;
    targetPath = path.join(backupsDir, baseName);
    suffix++;
  }

  const tempPath = path.join(backupsDir, `.${baseName}.tmp-${process.pid}-${Date.now()}`);
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    const escapedPath = tempPath.replace(/'/g, "''");
    ctx.db.exec(`VACUUM INTO '${escapedPath}';`);
    fs.renameSync(tempPath, targetPath);
    pruneMatchingFilesKeepingNewest(backupsDir, SAFETY_BACKUP_REGEX, 10);
    return targetPath;
  } catch (err) {
    console.error(`Failed to create ${kind} safety backup:`, err);
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
    return null;
  }
}

export function backupDatabase(ctx: DbContext, dateStr = todayDateStr()): string | null {
  if (ctx.isMemory || !ctx.dataDir) return null;
  const backupsDir = path.join(ctx.dataDir, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const targetPath = path.join(backupsDir, `tracker-${dateStr}.db`);
  const tempPath = path.join(backupsDir, `.tracker-${dateStr}.tmp-${process.pid}-${Date.now()}.db`);

  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    const escapedPath = tempPath.replace(/'/g, "''");
    ctx.db.exec(`VACUUM INTO '${escapedPath}';`);
    fs.renameSync(tempPath, targetPath);
    pruneMatchingFilesKeepingNewest(backupsDir, DAILY_BACKUP_REGEX, 14);
    return targetPath;
  } catch (err) {
    console.error(`Failed to create daily database backup for ${dateStr}:`, err);
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
    return null;
  }
}

export function writeDailyExport(
  ctx: DbContext,
  exportDataFn: () => ZhenjiExportV2,
  dateStr = todayDateStr()
): string | null {
  if (ctx.isMemory || !ctx.dataDir) return null;
  const exportsDir = path.join(ctx.dataDir, 'exports');
  fs.mkdirSync(exportsDir, { recursive: true });
  const targetPath = path.join(exportsDir, `zhenji-${dateStr}.json`);
  const tempPath = path.join(
    exportsDir,
    `.zhenji-${dateStr}.tmp-${process.pid}-${Date.now()}.json`
  );

  try {
    const exported = exportDataFn();
    fs.writeFileSync(tempPath, JSON.stringify(exported, null, 2), 'utf-8');
    fs.renameSync(tempPath, targetPath);
    pruneMatchingFilesKeepingNewest(exportsDir, DAILY_EXPORT_REGEX, 14);
    return targetPath;
  } catch (err) {
    console.error(`Failed to write daily JSON export for ${dateStr}:`, err);
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
    return null;
  }
}
