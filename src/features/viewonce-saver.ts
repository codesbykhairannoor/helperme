import { proto } from '@whiskeysockets/baileys'
import { sendMessage, downloadMedia } from '../connection'
import { saveMediaFile } from '../database/media'
import { isFeatureEnabled } from '../database/settings'
import { prepareMediaForSend } from '../utils/media'
import { 
  isViewOnce, 
  unwrapMessage, 
  getMediaType, 
  getMimeType, 
  getMessageText,
  formatPhoneNumber
} from '../utils/formatter'
import { logger } from '../utils/logger'
import config from '../config'

// Get the owner's chat ID
function getOwnerChatId(): string {
  if (config.ownerNumber) {
    return `${config.ownerNumber}@s.whatsapp.net`
  }
  return ''
}

// Handle view-once messages
export async function handleViewOnceMessage(
  message: proto.IWebMessageInfo,
  chatId: string,
  sender: string,
  pushName: string
): Promise<boolean> {
  const rawMessage = message.message
  if (!rawMessage) return false
  
  // Check if this is a view-once message
  if (!isViewOnce(rawMessage)) return false
  
  // Check if view-once saving is enabled
  const ownerChat = getOwnerChatId()
  if (!isFeatureEnabled(chatId, 'viewonceSave') && 
      (!ownerChat || !isFeatureEnabled(ownerChat, 'viewonceSave'))) {
    return false
  }
  
  logger.info(`Detected view-once message from ${sender}`)
  
  // Unwrap the actual message content
  const innerMessage = unwrapMessage(rawMessage)
  if (!innerMessage) {
    logger.warn('Could not unwrap view-once message')
    return false
  }
  
  // Get media type
  const mediaType = getMediaType(innerMessage)
  if (!mediaType) {
    logger.warn('No media found in view-once message')
    return false
  }
  
  try {
    // Download the media
    const buffer = await downloadMedia(message)
    if (!buffer) {
      logger.error('Failed to download view-once media')
      return false
    }
    
    const mimeType = getMimeType(innerMessage)
    const caption = getMessageText(innerMessage)
    const messageId = message.key.id || `viewonce_${Date.now()}`
    
    // Save media to database and file system
    const savedMedia = await saveMediaFile(
      buffer,
      messageId,
      mediaType,
      mimeType,
      null
    )
    
    // Prepare notification message
    const senderNumber = formatPhoneNumber(sender)
    const senderName = pushName || senderNumber
    
    let notificationText = `*[View-Once Media Saved]*\n\n`
    notificationText += `*From:* ${senderName} (${senderNumber})\n`
    notificationText += `*Type:* ${mediaType}\n`
    if (caption) {
      notificationText += `*Caption:* ${caption}\n`
    }
    
    // Determine where to send
    const targetChat = ownerChat || chatId
    
    // Send notification
    await sendMessage(targetChat, { text: notificationText })
    
    // Resend media as normal message (not view-once)
    const mediaContent = await prepareMediaForSend(
      buffer,
      mediaType,
      mimeType,
      caption || '[View-Once Media]'
    )
    await sendMessage(targetChat, mediaContent)
    
    logger.info(`View-once media saved and forwarded to ${targetChat}`)
    return true
  } catch (error) {
    logger.error('Failed to handle view-once message:', error)
    return false
  }
}

export default {
  handleViewOnceMessage,
}
