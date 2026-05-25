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

// Get the actual message content (unwrap view once, ephemeral, etc. recursively)
export function unwrapMessage(message: proto.IMessage | null | undefined): proto.IMessage | null {
  if (!message) return null
  
  let current: proto.IMessage = message
  let unwrapped = true
  
  while (unwrapped) {
    unwrapped = false
    
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message
      unwrapped = true
    } else if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message
      unwrapped = true
    } else if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message
      unwrapped = true
    } else if (current.viewOnceMessageV2Extension?.message) {
      current = current.viewOnceMessageV2Extension.message
      unwrapped = true
    } else if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message
      unwrapped = true
    }
  }
  
  return current
}

// Check if message is view once by inspecting all layers
export function isViewOnce(message: proto.IMessage | null | undefined): boolean {
  if (!message) return false
  
  // Check root level
  if (
    message.viewOnceMessage ||
    message.viewOnceMessageV2 ||
    message.viewOnceMessageV2Extension ||
    message.imageMessage?.viewOnce ||
    message.videoMessage?.viewOnce
  ) {
    return true
  }
  
  // Check if it's wrapped in an ephemeral message
  if (message.ephemeralMessage?.message) {
    return isViewOnce(message.ephemeralMessage.message)
  }
  
  return false
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
  if ((isGroup || key.remoteJid === 'status@broadcast') && key.participant) {
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
