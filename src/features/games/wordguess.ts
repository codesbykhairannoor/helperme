import { BotContext, WordGuessState } from '../../types'
import { logger } from '../../utils/logger'

// Store active games
const activeGames = new Map<string, WordGuessState>()

// Word list
const WORDS = [
  'JAVASCRIPT', 'PYTHON', 'WHATSAPP', 'COMPUTER', 'KEYBOARD',
  'INTERNET', 'DATABASE', 'ALGORITHM', 'FUNCTION', 'VARIABLE',
  'ELEPHANT', 'GIRAFFE', 'DOLPHIN', 'PENGUIN', 'BUTTERFLY',
  'MOUNTAIN', 'OCEAN', 'FOREST', 'DESERT', 'ISLAND',
  'CHOCOLATE', 'PIZZA', 'HAMBURGER', 'SPAGHETTI', 'SANDWICH',
  'ADVENTURE', 'MYSTERY', 'FANTASY', 'ROMANCE', 'THRILLER',
  'GUITAR', 'PIANO', 'DRUMS', 'VIOLIN', 'TRUMPET',
  'FOOTBALL', 'BASKETBALL', 'TENNIS', 'SWIMMING', 'BASEBALL',
]

// Hangman stages
const HANGMAN_STAGES = [
  `
  +---+
  |   |
      |
      |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
      |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
  |   |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========`,
  `
  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      |
=========`,
]

// Get random word
function getRandomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]
}

// Render the game state
function renderGame(state: WordGuessState): string {
  const maskedWord = state.word
    .split('')
    .map(char => state.guessed.includes(char) ? char : '_')
    .join(' ')
  
  const hangman = HANGMAN_STAGES[Math.min(state.attempts, HANGMAN_STAGES.length - 1)]
  
  let text = '```' + hangman + '```\n\n'
  text += `*Word:* ${maskedWord}\n\n`
  text += `*Guessed:* ${state.guessed.join(', ') || 'None'}\n`
  text += `*Attempts left:* ${state.maxAttempts - state.attempts}`
  
  return text
}

// Start a new game
export async function handleWordGuess(ctx: BotContext): Promise<void> {
  // Check if there's already a game
  if (activeGames.has(ctx.chatId)) {
    const game = activeGames.get(ctx.chatId)!
    if (!game.isOver) {
      await ctx.reply(`A game is already in progress!\n\n${renderGame(game)}\n\nGuess a letter or use .guess end to quit.`)
      return
    }
  }
  
  const word = getRandomWord()
  
  const game: WordGuessState = {
    word,
    guessed: [],
    attempts: 0,
    maxAttempts: 6,
    isOver: false,
    winner: null,
  }
  
  activeGames.set(ctx.chatId, game)
  
  await ctx.reply(`*Word Guess Game Started!*\n\n${renderGame(game)}\n\nGuess a letter by typing .guess <letter>`)
  
  logger.info(`Word guess game started in ${ctx.chatId}`)
}

// Handle a guess
export async function handleGuess(ctx: BotContext): Promise<void> {
  const game = activeGames.get(ctx.chatId)
  
  if (!game) {
    await ctx.reply('No game in progress. Start one with .guess')
    return
  }
  
  if (game.isOver) {
    await ctx.reply('Game is over. Start a new one with .guess')
    return
  }
  
  // Check for end command
  if (ctx.args[0] === 'end' || ctx.args[0] === 'quit') {
    activeGames.delete(ctx.chatId)
    await ctx.reply(`Game ended. The word was: *${game.word}*`)
    return
  }
  
  // Parse guess
  const guess = ctx.args[0]?.toUpperCase()
  
  if (!guess) {
    await ctx.reply('Please provide a letter to guess. Usage: .guess <letter>')
    return
  }
  
  // Handle full word guess
  if (guess.length > 1) {
    if (guess === game.word) {
      game.isOver = true
      game.winner = ctx.sender
      activeGames.delete(ctx.chatId)
      
      await ctx.reply(`*Congratulations!* @${ctx.sender.split('@')[0]} guessed the word!\n\nThe word was: *${game.word}*`)
      return
    } else {
      game.attempts += 2 // Penalty for wrong word guess
      
      if (game.attempts >= game.maxAttempts) {
        game.isOver = true
        activeGames.delete(ctx.chatId)
        await ctx.reply(`*Game Over!* Wrong word guess.\n\nThe word was: *${game.word}*\n\n${renderGame(game)}`)
        return
      }
      
      await ctx.reply(`Wrong word! -2 attempts penalty.\n\n${renderGame(game)}`)
      return
    }
  }
  
  // Single letter guess
  const letter = guess[0]
  
  if (!/[A-Z]/.test(letter)) {
    await ctx.reply('Please guess a letter (A-Z).')
    return
  }
  
  if (game.guessed.includes(letter)) {
    await ctx.reply(`You already guessed "${letter}"!\n\n${renderGame(game)}`)
    return
  }
  
  // Add to guessed letters
  game.guessed.push(letter)
  
  // Check if letter is in word
  if (!game.word.includes(letter)) {
    game.attempts++
    
    // Check if game over
    if (game.attempts >= game.maxAttempts) {
      game.isOver = true
      activeGames.delete(ctx.chatId)
      
      await ctx.reply(`*Game Over!* You ran out of attempts.\n\nThe word was: *${game.word}*\n\n${renderGame(game)}`)
      return
    }
    
    await ctx.reply(`"${letter}" is not in the word!\n\n${renderGame(game)}`)
    return
  }
  
  // Correct guess - check if word is complete
  const isComplete = game.word.split('').every(char => game.guessed.includes(char))
  
  if (isComplete) {
    game.isOver = true
    game.winner = ctx.sender
    activeGames.delete(ctx.chatId)
    
    await ctx.reply(`*Congratulations!* @${ctx.sender.split('@')[0]} completed the word!\n\nThe word was: *${game.word}*`)
    return
  }
  
  await ctx.reply(`Good guess! "${letter}" is in the word!\n\n${renderGame(game)}`)
}

export default {
  handleWordGuess,
  handleGuess,
}
