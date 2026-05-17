import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load environment variables
dotenv.config()

// Determine data directory (use /data on Render for persistence)
const dataDir = fs.existsSync('/data') ? '/data' : path.join(__dirname, '..')

export const config = {
  // Bot settings
  prefix: process.env.BOT_PREFIX || '.',
  ownerNumber: process.env.OWNER_NUMBER || '',
  
  // Paths
  authDir: path.join(dataDir, 'auth'),
  mediaDir: path.join(dataDir, 'media'),
  dbPath: path.join(dataDir, 'bot.db'),
  
  // API Keys
  groqApiKey: process.env.GROQ_API_KEY || '',
  
  // Default feature states
  defaults: {
    antiDelete: process.env.DEFAULT_ANTI_DELETE !== '0',
    viewonceSave: process.env.DEFAULT_VIEWONCE_SAVE !== '0',
    autoViewStatus: process.env.DEFAULT_AUTO_VIEW_STATUS === '1',
    autoReactStatus: process.env.DEFAULT_AUTO_REACT_STATUS === '1',
  },
  
  // AI settings
  ai: {
    model: 'llama-3.3-70b-versatile',
    maxTokens: 1024,
    contextTimeout: 30 * 60 * 1000, // 30 minutes
  },
  
  // Status reactions pool
  statusReactions: ['👍', '❤️', '😍', '🔥', '👏', '😂', '😮', '🎉', '💯', '✨'],
}

// Ensure directories exist
;[config.authDir, config.mediaDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

export default config
