import { getDatabase } from './index'
import { StoredMedia } from '../types'
import * as fs from 'fs'
import * as path from 'path'
import config from '../config'
import { logger } from '../utils/logger'

export function saveMedia(media: StoredMedia): void {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO media 
    (id, message_id, type, file_path, original_filename, mime_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    media.id,
    media.messageId,
    media.type,
    media.filePath,
    media.originalFilename,
    media.mimeType,
    media.createdAt
  )
}

export function getMedia(id: string): StoredMedia | null {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT id, message_id as messageId, type, file_path as filePath, 
           original_filename as originalFilename, mime_type as mimeType, created_at as createdAt
    FROM media WHERE id = ?
  `)
  
  return stmt.get(id) as StoredMedia | null
}

export function getMediaByMessageId(messageId: string): StoredMedia | null {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT id, message_id as messageId, type, file_path as filePath, 
           original_filename as originalFilename, mime_type as mimeType, created_at as createdAt
    FROM media WHERE message_id = ?
  `)
  
  return stmt.get(messageId) as StoredMedia | null
}

export async function saveMediaFile(
  buffer: Buffer,
  messageId: string,
  mediaType: string,
  mimeType: string | null,
  filename: string | null
): Promise<StoredMedia> {
  // Generate unique ID
  const id = `media_${Date.now()}_${Math.random().toString(36).substring(7)}`
  
  // Determine file extension
  let ext = '.bin'
  if (mimeType) {
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'audio/mpeg': '.mp3',
      'application/pdf': '.pdf',
    }
    ext = extMap[mimeType] || ext
  } else if (filename) {
    ext = path.extname(filename) || ext
  }
  
  // Create subdirectory for media type
  const subDir = path.join(config.mediaDir, mediaType)
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true })
  }
  
  // Save file
  const filePath = path.join(subDir, `${id}${ext}`)
  fs.writeFileSync(filePath, buffer)
  
  const media: StoredMedia = {
    id,
    messageId,
    type: mediaType,
    filePath,
    originalFilename: filename,
    mimeType,
    createdAt: Date.now(),
  }
  
  saveMedia(media)
  logger.info(`Saved media: ${id} (${mediaType})`)
  
  return media
}

export function deleteMedia(id: string): boolean {
  const db = getDatabase()
  const media = getMedia(id)
  
  if (!media) return false
  
  // Delete file
  if (fs.existsSync(media.filePath)) {
    fs.unlinkSync(media.filePath)
  }
  
  // Delete from database
  const stmt = db.prepare('DELETE FROM media WHERE id = ?')
  stmt.run(id)
  
  return true
}

export function cleanOldMedia(olderThanDays: number = 7): number {
  const db = getDatabase()
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
  
  // Get old media entries
  const stmt = db.prepare('SELECT * FROM media WHERE created_at < ?')
  const oldMedia = stmt.all(cutoff) as StoredMedia[]
  
  let deleted = 0
  for (const media of oldMedia) {
    if (deleteMedia(media.id)) {
      deleted++
    }
  }
  
  if (deleted > 0) {
    logger.info(`Cleaned ${deleted} old media files`)
  }
  
  return deleted
}

export default {
  saveMedia,
  getMedia,
  getMediaByMessageId,
  saveMediaFile,
  deleteMedia,
  cleanOldMedia,
}
