import Groq from 'groq-sdk'
import { BotContext, ConversationContext } from '../types'
import config from '../config'
import { logger } from '../utils/logger'

// Store conversation contexts (in-memory, keyed by chatId)
const conversations = new Map<string, ConversationContext>()

// Initialize Groq client
let groqClient: Groq | null = null

function getGroqClient(): Groq {
  if (!groqClient) {
    if (!config.groqApiKey) {
      throw new Error('GROQ_API_KEY not configured')
    }
    groqClient = new Groq({ apiKey: config.groqApiKey })
  }
  return groqClient
}

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are a helpful AI assistant integrated into WhatsApp. 
You provide concise, helpful responses. Keep answers brief but informative since this is a chat platform.
If asked about your capabilities, mention you can help with questions, have conversations, provide information, and more.
Be friendly and conversational. Use emojis sparingly when appropriate.
If you don't know something, say so honestly.`

// Get or create conversation context
function getConversation(chatId: string): ConversationContext {
  let context = conversations.get(chatId)
  
  // Check if context is expired
  if (context && Date.now() - context.lastUpdated > config.ai.contextTimeout) {
    // Clear old context
    conversations.delete(chatId)
    context = undefined
  }
  
  if (!context) {
    context = {
      chatId,
      messages: [],
      lastUpdated: Date.now(),
    }
    conversations.set(chatId, context)
  }
  
  return context
}

// Clear conversation context for a chat
export function clearConversation(chatId: string): void {
  conversations.delete(chatId)
  logger.info(`Cleared AI conversation for ${chatId}`)
}

// Handle AI chat command
export async function handleAIChat(ctx: BotContext): Promise<void> {
  const userMessage = ctx.args.join(' ').trim()
  
  if (!userMessage) {
    await ctx.reply('Please provide a message. Usage: .ai <your message>')
    return
  }
  
  if (!config.groqApiKey) {
    await ctx.reply('AI chat is not configured. Please set GROQ_API_KEY.')
    return
  }
  
  try {
    // Get conversation context
    const context = getConversation(ctx.chatId)
    
    // Add user message to context
    context.messages.push({ role: 'user', content: userMessage })
    
    // Keep only last 10 messages for context
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10)
    }
    
    // Prepare messages for API
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...context.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]
    
    // Call Groq API
    const client = getGroqClient()
    const completion = await client.chat.completions.create({
      model: config.ai.model,
      messages,
      max_tokens: config.ai.maxTokens,
      temperature: 0.7,
    })
    
    const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'
    
    // Add assistant response to context
    context.messages.push({ role: 'assistant', content: response })
    context.lastUpdated = Date.now()
    
    // Send response
    await ctx.reply(response)
    
    logger.info(`AI chat response sent to ${ctx.chatId}`)
  } catch (error: any) {
    logger.error('AI chat error:', error)
    
    if (error.status === 429) {
      await ctx.reply('AI rate limit reached. Please try again in a moment.')
    } else if (error.status === 401) {
      await ctx.reply('AI authentication failed. Please check GROQ_API_KEY.')
    } else {
      await ctx.reply('Sorry, there was an error processing your request.')
    }
  }
}

// Handle clear conversation command
export async function handleClearAI(ctx: BotContext): Promise<void> {
  clearConversation(ctx.chatId)
  await ctx.reply('AI conversation history cleared.')
}

export default {
  handleAIChat,
  handleClearAI,
  clearConversation,
}
