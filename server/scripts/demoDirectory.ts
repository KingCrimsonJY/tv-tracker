import fs from 'node:fs';
import path from 'node:path';

// Never reset a directory, even one with a plausible-looking marker file.
export function createDemoDirectory(cwd = process.cwd(), dataDir = process.env.DATA_DIR): string {
  const target = path.join(fs.realpathSync(cwd), 'data-demo');
  const realData = dataDir ? path.resolve(dataDir) : path.resolve(cwd, 'data');
  const protectedPath = fs.existsSync(realData) ? fs.realpathSync(realData) : realData;
  if (target === protectedPath || target.startsWith(protectedPath + path.sep)) {
    throw new Error('DEMO_DIRECTORY_PROTECTED');
  }
  // mkdir without recursive refuses existing directories and symlinks atomically.
  fs.mkdirSync(target);
  return target;
}
