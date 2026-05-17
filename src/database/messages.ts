import { getDatabase } from './index'
import { StoredMessage } from '../types'
import { logger } from '../utils/logger'

export function saveMessage(message: StoredMessage): void {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO messages 
    (id, chat_id, sender, content, media_type, media_path, timestamp, is_deleted, push_name, raw_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    message.id,
    message.chatId,
    message.sender,
    message.content,
    message.mediaType,
    message.mediaPath,
    message.timestamp,
    message.isDeleted,
    message.pushName,
    null
  )
}

export function saveMessageWithRaw(message: StoredMessage, rawMessage: string): void {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO messages 
    (id, chat_id, sender, content, media_type, media_path, timestamp, is_deleted, push_name, raw_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    message.id,
    message.chatId,
    message.sender,
    message.content,
    message.mediaType,
    message.mediaPath,
    message.timestamp,
    message.isDeleted,
    message.pushName,
    rawMessage
  )
}

export function getMessage(id: string): StoredMessage | null {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT id, chat_id as chatId, sender, content, media_type as mediaType, 
           media_path as mediaPath, timestamp, is_deleted as isDeleted, push_name as pushName
    FROM messages WHERE id = ?
  `)
  
  return stmt.get(id) as StoredMessage | null
}

export function getMessageWithRaw(id: string): (StoredMessage & { rawMessage: string | null }) | null {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT id, chat_id as chatId, sender, content, media_type as mediaType, 
           media_path as mediaPath, timestamp, is_deleted as isDeleted, push_name as pushName,
           raw_message as rawMessage
    FROM messages WHERE id = ?
  `)
  
  return stmt.get(id) as (StoredMessage & { rawMessage: string | null }) | null
}

export function markMessageDeleted(id: string): void {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    UPDATE messages SET is_deleted = 1 WHERE id = ?
  `)
  
  stmt.run(id)
}

export function getRecentMessages(chatId: string, limit: number = 50): StoredMessage[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT id, chat_id as chatId, sender, content, media_type as mediaType, 
           media_path as mediaPath, timestamp, is_deleted as isDeleted, push_name as pushName
    FROM messages 
    WHERE chat_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `)
  
  return stmt.all(chatId, limit) as StoredMessage[]
}

export function cleanOldMessages(olderThanDays: number = 7): number {
  const db = getDatabase()
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
  
  const stmt = db.prepare(`
    DELETE FROM messages WHERE timestamp < ? AND is_deleted = 0
  `)
  
  const result = stmt.run(cutoff)
  
  if (result.changes > 0) {
    logger.info(`Cleaned ${result.changes} old messages`)
  }
  
  return result.changes
}

export default {
  saveMessage,
  saveMessageWithRaw,
  getMessage,
  getMessageWithRaw,
  markMessageDeleted,
  getRecentMessages,
  cleanOldMessages,
}
