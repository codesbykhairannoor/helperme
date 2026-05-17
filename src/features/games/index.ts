import { BotContext } from '../../types'
import tictactoe from './tictactoe'
import trivia from './trivia'
import wordguess from './wordguess'

export { tictactoe, trivia, wordguess }

// Export all game handlers
export const gameHandlers = {
  // Tic-tac-toe
  ttt: async (ctx: BotContext) => {
    if (ctx.args.length > 0 && /^[1-9]$/.test(ctx.args[0])) {
      await tictactoe.handleTicTacToeMove(ctx)
    } else {
      await tictactoe.handleTicTacToe(ctx)
    }
  },
  tictactoe: async (ctx: BotContext) => {
    await tictactoe.handleTicTacToe(ctx)
  },
  
  // Trivia
  trivia: async (ctx: BotContext) => {
    if (ctx.args[0] === 'end') {
      await trivia.handleTriviaEnd(ctx)
    } else {
      await trivia.handleTrivia(ctx)
    }
  },
  
  // Word guess
  guess: async (ctx: BotContext) => {
    if (ctx.args.length > 0) {
      await wordguess.handleGuess(ctx)
    } else {
      await wordguess.handleWordGuess(ctx)
    }
  },
  hangman: async (ctx: BotContext) => {
    await wordguess.handleWordGuess(ctx)
  },
}

// Check if a message might be a trivia answer (for non-command messages)
export function checkTriviaAnswer(ctx: BotContext): boolean {
  return trivia.mightBeTriviaAnswer(ctx.chatId, ctx.text)
}

// Handle potential trivia answer
export async function handleTriviaAnswer(ctx: BotContext): Promise<void> {
  await trivia.handleTriviaAnswer(ctx)
}

export default {
  gameHandlers,
  checkTriviaAnswer,
  handleTriviaAnswer,
}
