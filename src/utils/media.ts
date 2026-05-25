import { proto } from '@whiskeysockets/baileys'
import { downloadMedia, sendMessage, getSocket } from '../connection'
import * as fs from 'fs'
import * as path from 'path'
import config from '../config'
import { logger } from './logger'

// Download media from a message and return the buffer
export async function downloadMessageMedia(message: proto.IWebMessageInfo): Promise<Buffer | null> {
  return downloadMedia(message)
}

// Save buffer to file
export function saveBufferToFile(buffer: Buffer, filePath: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, buffer)
}

// Get media message content for re-sending
export async function prepareMediaForSend(
  buffer: Buffer,
  mediaType: string,
  mimeType: string | null,
  caption?: string
): Promise<any> {
  switch (mediaType) {
    case 'image':
      return {
        image: buffer,
        mimetype: mimeType || 'image/jpeg',
        caption,
      }
    case 'video':
      return {
        video: buffer,
        mimetype: mimeType || 'video/mp4',
        caption,
      }
    case 'audio':
      return {
        audio: buffer,
        mimetype: mimeType || 'audio/mp4',
        ptt: false,
      }
    case 'sticker':
      return {
        sticker: buffer,
        mimetype: mimeType || 'image/webp',
      }
    case 'document':
      return {
        document: buffer,
        mimetype: mimeType || 'application/octet-stream',
        fileName: 'document',
        caption,
      }
    default:
      return {
        document: buffer,
        mimetype: mimeType || 'application/octet-stream',
      }
  }
}

// Read file and return buffer
export function readFileBuffer(filePath: string): Buffer | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath)
    }
  } catch (error: any) {
    logger.error(`Failed to read file: ${filePath}`, error)
  }
  return null
}

// Delete file
export function deleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
  } catch (error: any) {
    logger.error(`Failed to delete file: ${filePath}`, error)
  }
  return false
}

// Get file extension from mime type
export function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
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
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  }
  return map[mimeType] || '.bin'
}

// Cleanup old media files
export function cleanupMediaFolder(olderThanDays: number = 7): number {
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
  let deleted = 0

  function cleanDir(dir: string) {
    if (!fs.existsSync(dir)) return

    const items = fs.readdirSync(dir)
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        cleanDir(fullPath)
      } else if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath)
        deleted++
      }
    }
  }

  cleanDir(config.mediaDir)
  return deleted
}

export default {
  downloadMessageMedia,
  saveBufferToFile,
  prepareMediaForSend,
  readFileBuffer,
  deleteFile,
  getExtensionFromMime,
  cleanupMediaFolder,
}
