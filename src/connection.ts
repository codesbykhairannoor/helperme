import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  ConnectionState,
  proto,
} from '@whiskeysockets/baileys'
import * as qrcode from 'qrcode-terminal'
import { Boom } from '@hapi/boom'
import config from './config'
import { baileysLogger, logger } from './utils/logger'

let sock: WASocket | null = null

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
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
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

export async function sendMessage(chatId: string, content: any) {
  if (!sock) throw new Error('Not connected to WhatsApp')
  return sock.sendMessage(chatId, content)
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
  } catch (error) {
    logger.error('Failed to download media:', error)
    return null
  }
}

export async function readMessages(chatId: string, messageKeys: proto.IMessageKey[]) {
  if (!sock) return
  await sock.readMessages(messageKeys)
}

export async function sendReaction(chatId: string, messageKey: proto.IMessageKey, emoji: string) {
  if (!sock) return
  await sock.sendMessage(chatId, {
    react: {
      text: emoji,
      key: messageKey,
    },
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
