import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  ConnectionState,
  proto,
  Browsers,
} from '@whiskeysockets/baileys'
import * as qrcode from 'qrcode-terminal'
import { Boom } from '@hapi/boom'
import config from './config'
import { baileysLogger, logger } from './utils/logger'
import { simulateTyping, simulateMediaUpload, sleep } from './utils/humanize'

let sock: WASocket | null = null
// Queue for messages to ensure we don't send concurrently to the same chat
const messageQueues = new Map<string, Promise<void>>()

export async function connectToWhatsApp(
  onMessage: (msg: proto.IWebMessageInfo) => void,
  onMessageUpdate: (updates: { key: proto.IMessageKey; update: Partial<proto.IWebMessageInfo> }[]) => void
): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    logger: baileysLogger,
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  })

  // Handle connection updates
  sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      logger.info('QR Code received, scan with WhatsApp:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = reason !== DisconnectReason.loggedOut

      logger.warn(`Connection closed. Reason: ${DisconnectReason[reason] || reason}`)

      if (shouldReconnect) {
        logger.info('Reconnecting...')
        setTimeout(() => connectToWhatsApp(onMessage, onMessageUpdate), 3000)
      } else {
        logger.error('Logged out. Please delete auth folder and restart.')
      }
    }

    if (connection === 'open') {
      logger.info('Connected to WhatsApp!')
    }
  })

  // Save credentials on update
  sock.ev.on('creds.update', saveCreds)

  // Handle incoming messages
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) {
        onMessage(msg)
      }
    }
  })

  // Handle message updates (for deleted messages detection)
  sock.ev.on('messages.update', (updates) => {
    onMessageUpdate(updates as any)
  })

  return sock
}

export function getSocket(): WASocket | null {
  return sock
}

/**
 * Queue a message sending task for a specific chat to prevent concurrent spam
 */
async function enqueueMessageTask<T>(chatId: string, task: () => Promise<T>): Promise<T> {
  const currentQueue = messageQueues.get(chatId) || Promise.resolve()
  
  const nextQueue = currentQueue.then(async () => {
    try {
      return await task()
    } catch (e) {
      logger.error(`Error in message queue for ${chatId}:`, e)
      throw e
    }
  }).catch(() => {
    // Catch so the next tasks in queue don't fail
  }) as Promise<T>
  
  messageQueues.set(chatId, nextQueue)
  return nextQueue
}

export async function sendMessage(chatId: string, content: any) {
  if (!sock) throw new Error('Not connected to WhatsApp')
  
  return enqueueMessageTask(chatId, async () => {
    // Ensure we are sending a read receipt before we "reply"
    try {
      // Small pause before anything
      await sleep(500)
    } catch (e) {}
    
    // Simulate typing if it's text
    if (content.text) {
      await simulateTyping(sock!, chatId, content.text)
    } 
    // Simulate media upload delay if it's media
    else if (content.image || content.video || content.document || content.audio) {
      await simulateMediaUpload(sock!, chatId)
    }
    
    return sock!.sendMessage(chatId, content)
  })
}

export async function sendTextMessage(chatId: string, text: string) {
  return sendMessage(chatId, { text })
}

export async function downloadMedia(message: proto.IWebMessageInfo): Promise<Buffer | null> {
  if (!sock) return null

  const { downloadMediaMessage } = await import('@whiskeysockets/baileys')
  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger: baileysLogger,
        reuploadRequest: sock.updateMediaMessage,
      }
    )
    return buffer as Buffer
  } catch (error: any) {
    logger.error('Failed to download media:', error)
    return null
  }
}

export async function readMessages(chatId: string, messageKeys: proto.IMessageKey[]) {
  if (!sock) return
  try {
    // Add realistic delay before marking as read
    await sleep(Math.floor(Math.random() * 1000) + 500)
    await sock.readMessages(messageKeys)
  } catch (e) {
    logger.warn('Failed to send read receipt:', e)
  }
}

export async function sendReaction(chatId: string, messageKey: proto.IMessageKey, emoji: string) {
  if (!sock) return
  
  return enqueueMessageTask(chatId, async () => {
    // Add realistic delay before reacting
    await sleep(Math.floor(Math.random() * 1000) + 800)
    await sock!.sendMessage(chatId, {
      react: {
        text: emoji,
        key: messageKey,
      },
    })
  })
}

export default {
  connectToWhatsApp,
  getSocket,
  sendMessage,
  sendTextMessage,
  downloadMedia,
  readMessages,
  sendReaction,
}
