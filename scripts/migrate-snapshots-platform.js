/**
 * One-shot migration: move all PNG baselines under __snapshots__/<spec>/<name>/
 * into __snapshots__/<spec>/<name>/<platform>/. Default platform is 'win32'
 * (override with PLATFORM env var).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '__snapshots__');
const PLATFORM = process.env.PLATFORM || 'win32';

if (!fs.existsSync(ROOT)) {
  console.log(`No __snapshots__ directory at ${ROOT}, nothing to migrate.`);
  process.exit(0);
}

let moved = 0;

function migrateDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const pngs = entries.filter((e) => e.isFile() && e.name.endsWith('.png'));

  if (pngs.length > 0) {
    // This is a snapshot leaf with baselines that need migrating
    const platformDir = path.join(dir, PLATFORM);
    if (!fs.existsSync(platformDir)) fs.mkdirSync(platformDir, { recursive: true });
    for (const png of pngs) {
      const from = path.join(dir, png.name);
      const to = path.join(platformDir, png.name);
      fs.renameSync(from, to);
      moved++;
      console.log(`  ${path.relative(ROOT, from)} -> ${path.relative(ROOT, to)}`);
    }
    return;
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== PLATFORM && entry.name !== 'linux' && entry.name !== 'darwin') {
      migrateDir(path.join(dir, entry.name));
    }
  }
}

console.log(`Migrating __snapshots__/* into per-platform folders (platform=${PLATFORM})`);
migrateDir(ROOT);
console.log(`Done. Moved ${moved} baseline file(s).`);
