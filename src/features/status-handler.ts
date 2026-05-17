import { proto } from '@whiskeysockets/baileys'
import { downloadMedia, sendMessage, readMessages, sendReaction, getSocket } from '../connection'
import { saveMediaFile } from '../database/media'
import { isFeatureEnabled } from '../database/settings'
import { getMediaType, getMimeType, formatPhoneNumber, formatTimestamp } from '../utils/formatter'
import { prepareMediaForSend } from '../utils/media'
import { logger } from '../utils/logger'
import config from '../config'

const STATUS_BROADCAST = 'status@broadcast'

// Track recently viewed statuses to avoid duplicates
const recentlyViewed = new Set<string>()

// Get the owner's chat ID
function getOwnerChatId(): string {
  if (config.ownerNumber) {
    return `${config.ownerNumber}@s.whatsapp.net`
  }
  return ''
}

// Check if a message is a status update
export function isStatusMessage(chatId: string): boolean {
  return chatId === STATUS_BROADCAST
}

// Handle incoming status message
export async function handleStatusMessage(
  message: proto.IWebMessageInfo
): Promise<void> {
  const key = message.key
  if (!key.remoteJid || key.remoteJid !== STATUS_BROADCAST) return
  
  const statusId = key.id
  if (!statusId || recentlyViewed.has(statusId)) return
  
  // Mark as viewed
  recentlyViewed.add(statusId)
  
  // Clean up old entries (keep last 100)
  if (recentlyViewed.size > 100) {
    const entries = Array.from(recentlyViewed)
    entries.slice(0, entries.length - 100).forEach(id => recentlyViewed.delete(id))
  }
  
  const ownerChat = getOwnerChatId()
  const sender = key.participant || ''
  
  // Auto-view status
  if (isFeatureEnabled(ownerChat || STATUS_BROADCAST, 'autoViewStatus')) {
    await autoViewStatus(message)
  }
  
  // Auto-react to status
  if (isFeatureEnabled(ownerChat || STATUS_BROADCAST, 'autoReactStatus')) {
    await autoReactToStatus(message)
  }
}

// Auto-view a status
async function autoViewStatus(message: proto.IWebMessageInfo): Promise<void> {
  try {
    const sock = getSocket()
    if (!sock) return
    
    const key = message.key
    if (!key.id || !key.remoteJid) return
    
    // Read/view the status
    await readMessages(key.remoteJid, [key])
    logger.info(`Auto-viewed status from ${key.participant}`)
  } catch (error) {
    logger.error('Failed to auto-view status:', error)
  }
}

// Auto-react to a status
async function autoReactToStatus(message: proto.IWebMessageInfo): Promise<void> {
  try {
    const key = message.key
    if (!key.id || !key.remoteJid || !key.participant) return
    
    // Random delay (1-5 seconds) to seem more natural
    const delay = 1000 + Math.random() * 4000
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // Pick a random reaction
    const reaction = config.statusReactions[
      Math.floor(Math.random() * config.statusReactions.length)
    ]
    
    await sendReaction(key.participant, key, reaction)
    logger.info(`Auto-reacted to status from ${key.participant} with ${reaction}`)
  } catch (error) {
    logger.error('Failed to auto-react to status:', error)
  }
}

// Download and save status media
export async function grabStatus(
  message: proto.IWebMessageInfo,
  targetChat?: string
): Promise<boolean> {
  try {
    const key = message.key
    if (!key.participant) {
      logger.warn('No participant in status message')
      return false
    }
    
    const rawMessage = message.message
    if (!rawMessage) {
      logger.warn('No message content in status')
      return false
    }
    
    // Get media type
    const mediaType = getMediaType(rawMessage)
    if (!mediaType) {
      // Might be a text status
      const text = rawMessage.extendedTextMessage?.text || rawMessage.conversation
      if (text) {
        const senderNumber = formatPhoneNumber(key.participant)
        const notification = `*[Status Grabbed]*\n\n*From:* ${senderNumber}\n*Text:*\n${text}`
        
        const destination = targetChat || getOwnerChatId()
        if (destination) {
          await sendMessage(destination, { text: notification })
        }
        return true
      }
      return false
    }
    
    // Download media
    const buffer = await downloadMedia(message)
    if (!buffer) {
      logger.error('Failed to download status media')
      return false
    }
    
    const mimeType = getMimeType(rawMessage)
    const statusId = key.id || `status_${Date.now()}`
    
    // Save to database
    await saveMediaFile(buffer, statusId, mediaType, mimeType, null)
    
    // Prepare notification
    const senderNumber = formatPhoneNumber(key.participant)
    const notification = `*[Status Media Grabbed]*\n\n*From:* ${senderNumber}\n*Type:* ${mediaType}`
    
    // Send to target
    const destination = targetChat || getOwnerChatId()
    if (destination) {
      await sendMessage(destination, { text: notification })
      
      // Send the media
      const mediaContent = await prepareMediaForSend(buffer, mediaType, mimeType)
      await sendMessage(destination, mediaContent)
    }
    
    logger.info(`Grabbed status from ${senderNumber}`)
    return true
  } catch (error) {
    logger.error('Failed to grab status:', error)
    return false
  }
}

// Grab all recent statuses (used with .grabstatus command)
export async function grabAllRecentStatuses(targetChat: string): Promise<number> {
  // Note: This would require implementing status list fetching
  // Baileys doesn't directly expose a way to fetch status list
  // This would need socket event handling for status updates
  logger.info('Grab all statuses requested - individual status grabbing available')
  return 0
}

export default {
  isStatusMessage,
  handleStatusMessage,
  grabStatus,
  grabAllRecentStatuses,
}
