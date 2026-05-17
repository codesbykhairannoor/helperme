import { proto, WASocket } from '@whiskeysockets/baileys'
import { handleMessage } from './messages'
import { handleDeletedMessage } from '../features/anti-delete'
import { logger } from '../utils/logger'

export function setupHandlers(sock: WASocket): void {
  logger.info('Event handlers are set up via connection.ts')
}

export { handleMessage, handleDeletedMessage }

export default {
  setupHandlers,
  handleMessage,
  handleDeletedMessage,
}
