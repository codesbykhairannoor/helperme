import { proto, WASocket } from '@whiskeysockets/baileys'

// Message types
export interface StoredMessage {
  id: string
  chatId: string
  sender: string
  content: string | null
  mediaType: string | null
  mediaPath: string | null
  timestamp: number
  isDeleted: number
  pushName: string | null
}

export interface StoredMedia {
  id: string
  messageId: string | null
  type: string
  filePath: string
  originalFilename: string | null
  mimeType: string | null
  createdAt: number
}

export interface ChatSettings {
  chatId: string
  antiDelete: number
  viewonceSave: number
  autoViewStatus: number
  autoReactStatus: number
}

export interface GameState {
  id: string
  chatId: string
  gameType: 'tictactoe' | 'trivia' | 'wordguess'
  state: string
  players: string | null
  createdAt: number
}

// Game specific types
export interface TicTacToeState {
  board: (string | null)[]
  currentPlayer: 'X' | 'O'
  players: { X: string; O: string }
  winner: string | null
  isOver: boolean
}

export interface TriviaState {
  question: string
  answer: string
  options: string[]
  scores: Record<string, number>
  currentRound: number
  totalRounds: number
  answered: boolean
}

export interface WordGuessState {
  word: string
  guessed: string[]
  attempts: number
  maxAttempts: number
  isOver: boolean
  winner: string | null
}

// Bot context passed to handlers
export interface BotContext {
  sock: WASocket
  message: proto.IWebMessageInfo
  chatId: string
  sender: string
  pushName: string
  isGroup: boolean
  isOwner: boolean
  text: string
  command: string | null
  args: string[]
  reply: (text: string) => Promise<void>
  sendMessage: (chatId: string, content: any) => Promise<void>
}

// Command handler type
export type CommandHandler = (ctx: BotContext) => Promise<void>

// Feature toggle type
export type FeatureName = 'antiDelete' | 'viewonceSave' | 'autoViewStatus' | 'autoReactStatus'

// AI conversation context
export interface ConversationContext {
  chatId: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  lastUpdated: number
}
