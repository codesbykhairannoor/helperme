import { proto } from '@whiskeysockets/baileys'

// Extract text content from a message
export function getMessageText(message: proto.IMessage | null | undefined): string {
  if (!message) return ''
  
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ''
  )
}

// Get media type from message
export function getMediaType(message: proto.IMessage | null | undefined): string | null {
  if (!message) return null
  
  if (message.imageMessage) return 'image'
  if (message.videoMessage) return 'video'
  if (message.audioMessage) return 'audio'
  if (message.documentMessage) return 'document'
  if (message.stickerMessage) return 'sticker'
  if (message.contactMessage) return 'contact'
  if (message.locationMessage) return 'location'
  
  return null
}

// Check if message is view once
export function isViewOnce(message: proto.IMessage | null | undefined): boolean {
  if (!message) return false
  
  return !!(
    message.viewOnceMessage ||
    message.viewOnceMessageV2 ||
    message.viewOnceMessageV2Extension ||
    message.imageMessage?.viewOnce ||
    message.videoMessage?.viewOnce
  )
}

// Get the actual message content (unwrap view once, etc.)
export function unwrapMessage(message: proto.IMessage | null | undefined): proto.IMessage | null {
  if (!message) return null
  
  // Unwrap view once messages
  if (message.viewOnceMessage?.message) {
    return message.viewOnceMessage.message
  }
  if (message.viewOnceMessageV2?.message) {
    return message.viewOnceMessageV2.message
  }
  if (message.viewOnceMessageV2Extension?.message) {
    return message.viewOnceMessageV2Extension.message
  }
  
  // Unwrap ephemeral messages
  if (message.ephemeralMessage?.message) {
    return message.ephemeralMessage.message
  }
  
  // Unwrap document with caption messages
  if (message.documentWithCaptionMessage?.message) {
    return message.documentWithCaptionMessage.message
  }
  
  return message
}

// Get mime type from message
export function getMimeType(message: proto.IMessage | null | undefined): string | null {
  if (!message) return null
  
  return (
    message.imageMessage?.mimetype ||
    message.videoMessage?.mimetype ||
    message.audioMessage?.mimetype ||
    message.documentMessage?.mimetype ||
    message.stickerMessage?.mimetype ||
    null
  )
}

// Get filename from message
export function getFilename(message: proto.IMessage | null | undefined): string | null {
  if (!message) return null
  
  return message.documentMessage?.fileName || null
}

// Format timestamp
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Get sender ID from message key
export function getSenderId(key: proto.IMessageKey, isGroup: boolean): string {
  if (isGroup && key.participant) {
    return key.participant
  }
  return key.remoteJid || ''
}

// Format phone number for display
export function formatPhoneNumber(jid: string): string {
  const number = jid.split('@')[0]
  return `+${number}`
}

// Generate unique message ID
export function generateMessageId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
