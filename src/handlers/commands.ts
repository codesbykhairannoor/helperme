import { proto } from '@whiskeysockets/baileys'
import { sendMessage } from '../connection'
import { BotContext, CommandHandler } from '../types'
import { handleAIChat, handleClearAI } from '../features/ai-chat'
import { gameHandlers, checkTriviaAnswer, handleTriviaAnswer } from '../features/games'
import { updateSetting, getSettings } from '../database/settings'
import config from '../config'
import { logger } from '../utils/logger'

// Help text
const HELP_TEXT = `
*WhatsApp Bot Commands*

*General:*
${config.prefix}help - Show this help message
${config.prefix}ping - Check if bot is alive
${config.prefix}menu - Show command menu

*AI Chat:*
${config.prefix}ai <message> - Chat with AI
${config.prefix}clearai - Clear AI conversation history

*Features:*
${config.prefix}antidelete on/off - Toggle deleted message recovery
${config.prefix}viewonce on/off - Toggle view-once media saving
${config.prefix}autoview on/off - Toggle auto-view status
${config.prefix}autoreact on/off - Toggle auto-react to status
${config.prefix}settings - Show current settings

*Games:*
${config.prefix}ttt @user - Start Tic-Tac-Toe
${config.prefix}ttt <1-9> - Make a move
${config.prefix}trivia [rounds] - Start trivia game
${config.prefix}trivia end - End trivia game
${config.prefix}guess - Start word guess (hangman)
${config.prefix}guess <letter> - Guess a letter

*Status:*
${config.prefix}grabstatus - Info about status grabbing
`.trim()

// Command handlers map
const commands: Record<string, CommandHandler> = {
  // General
  help: async (ctx) => {
    await ctx.reply(HELP_TEXT)
  },
  
  menu: async (ctx) => {
    await ctx.reply(HELP_TEXT)
  },
  
  ping: async (ctx) => {
    const start = Date.now()
    await ctx.reply(`Pong! Latency: ${Date.now() - start}ms`)
  },
  
  // AI
  ai: handleAIChat,
  clearai: handleClearAI,
  
  // Feature toggles
  antidelete: async (ctx) => {
    const state = ctx.args[0]?.toLowerCase()
    if (state !== 'on' && state !== 'off') {
      await ctx.reply('Usage: .antidelete on/off')
      return
    }
    updateSetting(ctx.chatId, 'antiDelete', state === 'on')
    await ctx.reply(`Anti-delete is now ${state === 'on' ? 'enabled' : 'disabled'}`)
  },
  
  viewonce: async (ctx) => {
    const state = ctx.args[0]?.toLowerCase()
    if (state !== 'on' && state !== 'off') {
      await ctx.reply('Usage: .viewonce on/off')
      return
    }
    updateSetting(ctx.chatId, 'viewonceSave', state === 'on')
    await ctx.reply(`View-once saving is now ${state === 'on' ? 'enabled' : 'disabled'}`)
  },
  
  autoview: async (ctx) => {
    const state = ctx.args[0]?.toLowerCase()
    if (state !== 'on' && state !== 'off') {
      await ctx.reply('Usage: .autoview on/off')
      return
    }
    updateSetting(ctx.chatId, 'autoViewStatus', state === 'on')
    await ctx.reply(`Auto-view status is now ${state === 'on' ? 'enabled' : 'disabled'}`)
  },
  
  autoreact: async (ctx) => {
    const state = ctx.args[0]?.toLowerCase()
    if (state !== 'on' && state !== 'off') {
      await ctx.reply('Usage: .autoreact on/off')
      return
    }
    updateSetting(ctx.chatId, 'autoReactStatus', state === 'on')
    await ctx.reply(`Auto-react to status is now ${state === 'on' ? 'enabled' : 'disabled'}`)
  },
  
  settings: async (ctx) => {
    const settings = getSettings(ctx.chatId)
    const text = `
*Current Settings*

Anti-Delete: ${settings.antiDelete ? 'ON' : 'OFF'}
View-Once Save: ${settings.viewonceSave ? 'ON' : 'OFF'}
Auto-View Status: ${settings.autoViewStatus ? 'ON' : 'OFF'}
Auto-React Status: ${settings.autoReactStatus ? 'ON' : 'OFF'}
`.trim()
    await ctx.reply(text)
  },
  
  grabstatus: async (ctx) => {
    await ctx.reply(
      '*Status Grabber*\n\n' +
      'When someone posts a status, I will automatically save it if you have view-once saving enabled.\n\n' +
      'Use .autoview on to automatically view all statuses.\n' +
      'Use .autoreact on to automatically react to statuses.'
    )
  },
  
  // Games
  ...gameHandlers,
}

// Parse command from message text
export function parseCommand(text: string): { command: string | null; args: string[] } {
  if (!text.startsWith(config.prefix)) {
    return { command: null, args: [] }
  }
  
  const parts = text.slice(config.prefix.length).trim().split(/\s+/)
  const command = parts[0]?.toLowerCase() || null
  const args = parts.slice(1)
  
  return { command, args }
}

// Handle incoming command
export async function handleCommand(ctx: BotContext): Promise<boolean> {
  const { command, args } = parseCommand(ctx.text)
  
  if (!command) {
    // Check if it might be a trivia answer
    if (checkTriviaAnswer(ctx)) {
      await handleTriviaAnswer(ctx)
      return true
    }
    return false
  }
  
  ctx.command = command
  ctx.args = args
  
  const handler = commands[command]
  
  if (!handler) {
    // Unknown command - ignore silently
    return false
  }
  
  try {
    await handler(ctx)
    logger.info(`Command executed: ${command} by ${ctx.sender}`)
    return true
  } catch (error) {
    logger.error(`Command error (${command}):`, error)
    await ctx.reply('An error occurred while processing your command.')
    return true
  }
}

export default {
  parseCommand,
  handleCommand,
}
