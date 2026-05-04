import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
    `);
  }
  return global._db;
}
