import { proto } from '@whiskeysockets/baileys'
import { sendMessage, downloadMedia } from '../connection'
import { getMessage, getMessageWithRaw, markMessageDeleted } from '../database/messages'
import { getMediaByMessageId } from '../database/media'
import { isFeatureEnabled } from '../database/settings'
import { readFileBuffer, prepareMediaForSend } from '../utils/media'
import { formatTimestamp, formatPhoneNumber } from '../utils/formatter'
import { logger } from '../utils/logger'
import config from '../config'

// Get the owner's chat ID (for sending recovered messages)
function getOwnerChatId(): string {
  if (config.ownerNumber) {
    return `${config.ownerNumber}@s.whatsapp.net`
  }
  return ''
}

// Handle deleted message detection and recovery
export async function handleDeletedMessage(
  key: proto.IMessageKey,
  update: Partial<proto.IWebMessageInfo>
): Promise<void> {
  // Check if this is a deletion
  if (!update.messageStubType) return
  
  const deletionTypes = [
    proto.WebMessageInfo.StubType.REVOKE,
    1, // Message deleted by sender
  ]
  
  if (!deletionTypes.includes(update.messageStubType)) return
  
  const messageId = key.id
  if (!messageId) return
  
  const chatId = key.remoteJid
  if (!chatId) return
  
  // Check if anti-delete is enabled for this chat
  if (!isFeatureEnabled(chatId, 'antiDelete')) {
    // Check global/owner setting
    const ownerChat = getOwnerChatId()
    if (!ownerChat || !isFeatureEnabled(ownerChat, 'antiDelete')) {
      return
    }
  }
  
  logger.info(`Detected deleted message: ${messageId}`)
  
  // Get the stored message
  const storedMessage = getMessageWithRaw(messageId)
  if (!storedMessage) {
    logger.warn(`No stored message found for deleted message: ${messageId}`)
    return
  }
  
  // Mark as deleted in database
  markMessageDeleted(messageId)
  
  // Prepare recovery message
  const senderNumber = formatPhoneNumber(storedMessage.sender)
  const senderName = storedMessage.pushName || senderNumber
  const timestamp = formatTimestamp(storedMessage.timestamp)
  
  let recoveryText = `*[Deleted Message Recovered]*\n\n`
  recoveryText += `*From:* ${senderName} (${senderNumber})\n`
  recoveryText += `*Time:* ${timestamp}\n`
  let chatType = 'Private'
  let chatName = chatId

  if (chatId.includes('@g.us')) {
    chatType = 'Group'
    try {
      // Try to get actual group name
      const { getSocket } = require('../connection')
      const sock = getSocket()
      if (sock) {
        const metadata = await sock.groupMetadata(chatId)
        if (metadata && metadata.subject) {
          chatName = metadata.subject
        }
      }
    } catch (e) {
      // Fallback if metadata fails
    }
    recoveryText += `*Chat:* ${chatType} (${chatName})\n\n`
  } else if (chatId === 'status@broadcast') {
    chatType = 'Status'
    recoveryText += `*Chat:* ${chatType}\n\n`
  } else {
    recoveryText += `*Chat:* ${chatType}\n\n`
  }
  
  if (storedMessage.content) {
    recoveryText += `*Message:*\n${storedMessage.content}`
  } else if (storedMessage.mediaType) {
    recoveryText += `*Media Type:* ${storedMessage.mediaType}`
  }
  
  // Determine where to send the recovered message
  const ownerChat = getOwnerChatId()
  let targetChat = ownerChat

  // Fallback if owner is not set
  if (!targetChat) {
    if (chatId.includes('@g.us')) {
      targetChat = chatId // In groups, it's okay to send it to the group
    } else {
      logger.warn('Owner number not set! Skipping anti-delete for private chat to avoid sending back to sender.')
      return // Don't send it back to the person who deleted it
    }
  }
  
  try {
    // Send text notification
    await sendMessage(targetChat, { text: recoveryText })
    
    // If there was media, try to resend it
    if (storedMessage.mediaPath && storedMessage.mediaType) {
      const media = getMediaByMessageId(messageId)
      if (media) {
        const buffer = readFileBuffer(media.filePath)
        if (buffer) {
          const mediaContent = await prepareMediaForSend(
            buffer,
            storedMessage.mediaType,
            media.mimeType,
            '[Recovered Media]'
          )
          await sendMessage(targetChat, mediaContent)
        }
      }
    }
    
    logger.info(`Recovered deleted message sent to ${targetChat}`)
  } catch (error: any) {
    logger.error('Failed to send recovered message:', error)
  }
}

export default {
  handleDeletedMessage,
}
