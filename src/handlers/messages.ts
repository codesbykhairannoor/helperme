import { proto, WASocket } from '@whiskeysockets/baileys'
import { sendMessage, readMessages } from '../connection'
import { saveMessageWithRaw } from '../database/messages'
import { saveMediaFile } from '../database/media'
import { handleViewOnceMessage } from '../features/viewonce-saver'
import { handleStatusMessage, isStatusMessage } from '../features/status-handler'
import { handleCommand } from './commands'
import { downloadMedia } from '../connection'
import { 
  getMessageText, 
  getMediaType, 
  getMimeType, 
  getSenderId,
  unwrapMessage,
  isViewOnce
} from '../utils/formatter'
import { BotContext, StoredMessage } from '../types'
import config from '../config'
import { logger } from '../utils/logger'

// Create bot context from message
function createContext(
  sock: WASocket,
  message: proto.IWebMessageInfo
): BotContext | null {
  const key = message.key
  const chatId = key.remoteJid
  
  if (!chatId) return null
  
  const isGroup = chatId.endsWith('@g.us')
  const sender = getSenderId(key, isGroup)
  const pushName = message.pushName || ''
  
  // Get text content
  const rawMessage = message.message
  const innerMessage = unwrapMessage(rawMessage)
  const text = getMessageText(innerMessage)
  
  // Check if sender is owner
  const ownerJid = config.ownerNumber ? `${config.ownerNumber}@s.whatsapp.net` : ''
  const isOwner = sender === ownerJid
  
  return {
    sock,
    message,
    chatId,
    sender,
    pushName,
    isGroup,
    isOwner,
    text,
    command: null,
    args: [],
    reply: async (text: string) => {
      await sendMessage(chatId, { text })
    },
    sendMessage: async (targetChatId: string, content: any) => {
      await sendMessage(targetChatId, content)
    },
  }
}

// Handle incoming message
export async function handleMessage(
  sock: WASocket,
  message: proto.IWebMessageInfo
): Promise<void> {
  try {
    const key = message.key
    const chatId = key.remoteJid
    
    if (!chatId) return
    
    // Handle status messages separately
    if (isStatusMessage(chatId)) {
      await handleStatusMessage(message)
      // We don't return here so the status message can be saved to DB for anti-delete
    }
    
    // Skip messages from self
    if (key.fromMe) return
    
    // Get message content
    const rawMessage = message.message
    if (!rawMessage) return
    
    const innerMessage = unwrapMessage(rawMessage)
    const text = getMessageText(innerMessage)
    const mediaType = getMediaType(innerMessage)
    const isGroup = chatId.endsWith('@g.us')
    const sender = getSenderId(key, isGroup)
    const pushName = message.pushName || ''
    
    // Store message for anti-delete feature
    const storedMessage: StoredMessage = {
      id: key.id || `msg_${Date.now()}`,
      chatId,
      sender,
      content: text || null,
      mediaType,
      mediaPath: null,
      timestamp: Date.now(),
      isDeleted: 0,
      pushName,
    }
    
    // If has media, download and store
    if (mediaType) {
      try {
        const buffer = await downloadMedia(message)
        if (buffer) {
          const mimeType = getMimeType(innerMessage)
          const media = await saveMediaFile(buffer, storedMessage.id, mediaType, mimeType, null)
          storedMessage.mediaPath = media.filePath
        }
      } catch (error: any) {
        logger.warn('Failed to download/store message media:', error)
      }
    }
    
    // Save message to database
    saveMessageWithRaw(storedMessage, JSON.stringify(rawMessage))
    
    // Handle view-once messages
    if (isViewOnce(rawMessage)) {
      await handleViewOnceMessage(message, chatId, sender, pushName)
    }
    
    // Create context and handle commands (skip for statuses)
    if (!isStatusMessage(chatId)) {
      const ctx = createContext(sock, message)
      if (ctx && text) {
        // Read message before processing commands to simulate human reading
        if (text.startsWith(config.prefix)) {
          await readMessages(chatId, [key])
        }
        await handleCommand(ctx)
      }
    }
    
  } catch (error: any) {
    logger.error('Error handling message:', error)
  }
}

export default {
  handleMessage,
}
