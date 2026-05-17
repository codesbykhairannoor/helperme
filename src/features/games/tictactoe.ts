import { BotContext, TicTacToeState } from '../../types'
import { logger } from '../../utils/logger'

// Store active games (in-memory)
const activeGames = new Map<string, TicTacToeState>()

// Board positions displayed as grid
const BOARD_TEMPLATE = `
 {0} | {1} | {2}
-----------
 {3} | {4} | {5}
-----------
 {6} | {7} | {8}
`

// Render the board
function renderBoard(board: (string | null)[]): string {
  let display = BOARD_TEMPLATE
  board.forEach((cell, i) => {
    display = display.replace(`{${i}}`, cell || String(i + 1))
  })
  return '```\n' + display + '\n```'
}

// Check for winner
function checkWinner(board: (string | null)[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6], // Diagonals
  ]
  
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }
  
  return null
}

// Check if board is full (draw)
function isBoardFull(board: (string | null)[]): boolean {
  return board.every(cell => cell !== null)
}

// Start a new game
export async function handleTicTacToe(ctx: BotContext): Promise<void> {
  // Check if there's already a game in this chat
  if (activeGames.has(ctx.chatId)) {
    const game = activeGames.get(ctx.chatId)!
    await ctx.reply(`A game is already in progress!\n\n${renderBoard(game.board)}\n\nCurrent turn: ${game.currentPlayer}\nUse .ttt <1-9> to make a move or .ttt end to end the game.`)
    return
  }
  
  // Get opponent
  const mentions = ctx.args.filter(arg => arg.includes('@'))
  let opponent = ''
  
  if (mentions.length > 0) {
    // Parse mentioned user
    opponent = mentions[0].replace('@', '') + '@s.whatsapp.net'
  } else if (ctx.args[0] === 'bot' || ctx.args[0] === 'ai') {
    opponent = 'BOT'
  } else if (!ctx.isGroup) {
    // In DM, play against bot
    opponent = 'BOT'
  } else {
    await ctx.reply('Please mention a player to play against!\n\nUsage: .ttt @player or .ttt bot')
    return
  }
  
  // Create new game
  const game: TicTacToeState = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    players: {
      X: ctx.sender,
      O: opponent,
    },
    winner: null,
    isOver: false,
  }
  
  activeGames.set(ctx.chatId, game)
  
  const opponentDisplay = opponent === 'BOT' ? 'Bot' : `@${opponent.split('@')[0]}`
  
  await ctx.reply(
    `*Tic-Tac-Toe Started!*\n\n` +
    `X: @${ctx.sender.split('@')[0]}\n` +
    `O: ${opponentDisplay}\n\n` +
    renderBoard(game.board) +
    `\nX goes first! Use .ttt <1-9> to make a move.`
  )
  
  logger.info(`Tic-tac-toe game started in ${ctx.chatId}`)
}

// Make a move
export async function handleTicTacToeMove(ctx: BotContext): Promise<void> {
  const game = activeGames.get(ctx.chatId)
  
  if (!game) {
    await ctx.reply('No game in progress. Start one with .ttt @player')
    return
  }
  
  // Check for end command
  if (ctx.args[0] === 'end' || ctx.args[0] === 'quit') {
    activeGames.delete(ctx.chatId)
    await ctx.reply('Game ended.')
    return
  }
  
  // Parse move
  const move = parseInt(ctx.args[0]) - 1
  if (isNaN(move) || move < 0 || move > 8) {
    await ctx.reply('Invalid move. Use .ttt <1-9> where numbers represent positions.')
    return
  }
  
  // Check if it's the player's turn
  const currentPlayerId = game.players[game.currentPlayer]
  if (currentPlayerId !== ctx.sender && currentPlayerId !== 'BOT') {
    await ctx.reply(`It's not your turn! Waiting for ${game.currentPlayer}.`)
    return
  }
  
  // Check if position is taken
  if (game.board[move] !== null) {
    await ctx.reply('That position is already taken!')
    return
  }
  
  // Make the move
  game.board[move] = game.currentPlayer
  
  // Check for winner
  const winner = checkWinner(game.board)
  if (winner) {
    game.winner = winner
    game.isOver = true
    activeGames.delete(ctx.chatId)
    
    const winnerId = game.players[winner as 'X' | 'O']
    const winnerDisplay = winnerId === 'BOT' ? 'Bot' : `@${winnerId.split('@')[0]}`
    
    await ctx.reply(
      `*Game Over!*\n\n${renderBoard(game.board)}\n\n*Winner: ${winnerDisplay} (${winner})*`
    )
    return
  }
  
  // Check for draw
  if (isBoardFull(game.board)) {
    game.isOver = true
    activeGames.delete(ctx.chatId)
    await ctx.reply(`*Game Over - Draw!*\n\n${renderBoard(game.board)}`)
    return
  }
  
  // Switch player
  game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
  
  // If next player is bot, make bot move
  if (game.players[game.currentPlayer] === 'BOT') {
    await makeBotMove(ctx, game)
    return
  }
  
  const nextPlayerId = game.players[game.currentPlayer]
  const nextPlayerDisplay = `@${nextPlayerId.split('@')[0]}`
  
  await ctx.reply(
    renderBoard(game.board) +
    `\n${nextPlayerDisplay}'s turn (${game.currentPlayer})`
  )
}

// Bot makes a move
async function makeBotMove(ctx: BotContext, game: TicTacToeState): Promise<void> {
  // Simple AI: try to win, block, or pick random
  const board = game.board
  const botSymbol = game.currentPlayer
  const playerSymbol = botSymbol === 'X' ? 'O' : 'X'
  
  // Find best move
  let move = findWinningMove(board, botSymbol) // Try to win
  if (move === -1) move = findWinningMove(board, playerSymbol) // Block player
  if (move === -1) move = board[4] === null ? 4 : -1 // Take center
  if (move === -1) {
    // Take random corner or edge
    const available = board.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1)
    move = available[Math.floor(Math.random() * available.length)]
  }
  
  // Make the move
  game.board[move] = botSymbol
  
  // Check for winner
  const winner = checkWinner(game.board)
  if (winner) {
    game.winner = winner
    game.isOver = true
    activeGames.delete(ctx.chatId)
    await ctx.reply(`*Game Over!*\n\n${renderBoard(game.board)}\n\n*Winner: Bot (${winner})*`)
    return
  }
  
  // Check for draw
  if (isBoardFull(game.board)) {
    game.isOver = true
    activeGames.delete(ctx.chatId)
    await ctx.reply(`*Game Over - Draw!*\n\n${renderBoard(game.board)}`)
    return
  }
  
  // Switch back to player
  game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
  const nextPlayerId = game.players[game.currentPlayer]
  
  await ctx.reply(
    renderBoard(game.board) +
    `\nBot played. Your turn (${game.currentPlayer})!`
  )
}

// Find a winning move for a symbol
function findWinningMove(board: (string | null)[], symbol: string): number {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ]
  
  for (const [a, b, c] of lines) {
    const cells = [board[a], board[b], board[c]]
    const symbolCount = cells.filter(c => c === symbol).length
    const emptyCount = cells.filter(c => c === null).length
    
    if (symbolCount === 2 && emptyCount === 1) {
      // Can win or block
      if (board[a] === null) return a
      if (board[b] === null) return b
      if (board[c] === null) return c
    }
  }
  
  return -1
}

export default {
  handleTicTacToe,
  handleTicTacToeMove,
}
