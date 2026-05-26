import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const DB_PATH = path.join(DATA_DIR, 'appointments.db');

declare global {
  // eslint-disable-next-line no-var
  var _db: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!global._db) {
    global._db = new Database(DB_PATH);
    global._db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        service TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        open_hour INTEGER NOT NULL DEFAULT 9,
        close_hour INTEGER NOT NULL DEFAULT 18,
        working_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5]'
      );

      INSERT OR IGNORE INTO settings (id, open_hour, close_hour, working_days)
      VALUES (1, 9, 18, '[0,1,2,3,4,5]');

      CREATE TABLE IF NOT EXISTS days_off (
        date TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS blocked_ranges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        date TEXT
      );

      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        price INTEGER,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `);
    try {
      global._db.exec(`ALTER TABLE appointments ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'`);
    } catch {}
    try {
      global._db.exec(`ALTER TABLE appointments ADD COLUMN note TEXT`);
    } catch {}
    try {
      global._db.exec(`ALTER TABLE appointments ADD COLUMN token TEXT`);
    } catch {}
    try {
      global._db.exec(`ALTER TABLE appointments ADD COLUMN cancel_reason TEXT`);
    } catch {}
    try {
      global._db.exec(`ALTER TABLE settings ADD COLUMN admin_password_hash TEXT`);
    } catch {}

    // Backfill tokens for any appointments that don't have one
    const needsToken = global._db.prepare('SELECT id FROM appointments WHERE token IS NULL').all() as { id: number }[];
    if (needsToken.length > 0) {
      const setToken = global._db.prepare('UPDATE appointments SET token = ? WHERE id = ?');
      for (const row of needsToken) {
        setToken.run(crypto.randomBytes(16).toString('hex'), row.id);
      }
    }
    const { cnt } = global._db.prepare('SELECT COUNT(*) as cnt FROM services').get() as { cnt: number };
    if (cnt === 0) {
      const ins = global._db.prepare('INSERT INTO services (name, duration, active, sort_order) VALUES (?, ?, 1, ?)');
      ins.run('תספורת', 30, 0);
      ins.run('עיצוב זקן', 20, 1);
      ins.run('תספורת + זקן', 50, 2);
    }
  }
  return global._db;
}
