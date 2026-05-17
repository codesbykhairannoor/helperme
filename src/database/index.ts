import Database from 'better-sqlite3'
import config from '../config'
import { logger } from '../utils/logger'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (db) return db

  db = new Database(config.dbPath)
  
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')
  
  // Create tables
  db.exec(`
    -- Messages table for anti-delete feature
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      content TEXT,
      media_type TEXT,
      media_path TEXT,
      timestamp INTEGER NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      push_name TEXT,
      raw_message TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    
    -- Media storage
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT,
      mime_type TEXT,
      created_at INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_media_message_id ON media(message_id);
    
    -- Bot settings per chat
    CREATE TABLE IF NOT EXISTS settings (
      chat_id TEXT PRIMARY KEY,
      anti_delete INTEGER DEFAULT 1,
      viewonce_save INTEGER DEFAULT 1,
      auto_view_status INTEGER DEFAULT 0,
      auto_react_status INTEGER DEFAULT 0
    );
    
    -- Game states
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      state TEXT NOT NULL,
      players TEXT,
      created_at INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_games_chat_id ON games(chat_id);
  `)
  
  logger.info('Database initialized')
  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
    logger.info('Database closed')
  }
}

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
}
