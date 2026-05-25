import { proto } from '@whiskeysockets/baileys'
import { connectToWhatsApp, getSocket } from './connection'
import { initDatabase, closeDatabase } from './database'
import { handleMessage, handleDeletedMessage } from './handlers'
import { cleanOldMessages } from './database/messages'
import { cleanOldMedia } from './database/media'
import { logger } from './utils/logger'
import config from './config'

// Graceful shutdown handler
async function shutdown() {
  logger.info('Shutting down...')
  
  const sock = getSocket()
  if (sock) {
    sock.end(undefined)
  }
  
  closeDatabase()
  
  logger.info('Goodbye!')
  process.exit(0)
}

// Cleanup old data periodically
function startCleanupScheduler() {
  // Run cleanup every 6 hours
  const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000
  
  setInterval(() => {
    logger.info('Running scheduled cleanup...')
    try {
      cleanOldMessages(7) // Keep messages for 7 days
      cleanOldMedia(7) // Keep media for 7 days
    } catch (error: any) {
      logger.error('Cleanup error:', error)
    }
  }, CLEANUP_INTERVAL)
}

// Main function
async function main() {
  logger.info('Starting WhatsApp Bot...')
  logger.info(`Bot prefix: ${config.prefix}`)
  logger.info(`Owner number: ${config.ownerNumber || 'Not set'}`)
  
  // Initialize database
  initDatabase()
  
  // Connect to WhatsApp
  const sock = await connectToWhatsApp(
    // Message handler
    async (msg: proto.IWebMessageInfo) => {
      await handleMessage(sock, msg)
    },
    // Message update handler (for deletions)
    async (updates) => {
      for (const { key, update } of updates) {
        await handleDeletedMessage(key, update)
      }
    }
  )
  
  // Start cleanup scheduler
  startCleanupScheduler()
  
  // Handle graceful shutdown
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  
  logger.info('Bot is ready!')
}

// Run the bot
main().catch((error) => {
  logger.error('Fatal error:', error)
  process.exit(1)
})
