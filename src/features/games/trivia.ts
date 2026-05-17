import { BotContext, TriviaState } from '../../types'
import { logger } from '../../utils/logger'

// Store active trivia games
const activeGames = new Map<string, TriviaState>()

// Trivia questions database
const TRIVIA_QUESTIONS = [
  { question: 'What planet is known as the Red Planet?', answer: 'Mars', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'] },
  { question: 'What is the largest mammal in the world?', answer: 'Blue whale', options: ['Elephant', 'Blue whale', 'Giraffe', 'Hippopotamus'] },
  { question: 'In what year did World War II end?', answer: '1945', options: ['1943', '1944', '1945', '1946'] },
  { question: 'What is the chemical symbol for gold?', answer: 'Au', options: ['Ag', 'Au', 'Fe', 'Cu'] },
  { question: 'Who painted the Mona Lisa?', answer: 'Leonardo da Vinci', options: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Picasso'] },
  { question: 'What is the capital of Japan?', answer: 'Tokyo', options: ['Kyoto', 'Osaka', 'Tokyo', 'Hiroshima'] },
  { question: 'How many continents are there?', answer: '7', options: ['5', '6', '7', '8'] },
  { question: 'What is the largest ocean on Earth?', answer: 'Pacific Ocean', options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'] },
  { question: 'Who wrote Romeo and Juliet?', answer: 'William Shakespeare', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'] },
  { question: 'What is the hardest natural substance on Earth?', answer: 'Diamond', options: ['Gold', 'Iron', 'Diamond', 'Platinum'] },
  { question: 'What year was the iPhone first released?', answer: '2007', options: ['2005', '2006', '2007', '2008'] },
  { question: 'How many colors are in a rainbow?', answer: '7', options: ['5', '6', '7', '8'] },
  { question: 'What is the smallest country in the world?', answer: 'Vatican City', options: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'] },
  { question: 'What is the main language spoken in Brazil?', answer: 'Portuguese', options: ['Spanish', 'Portuguese', 'English', 'French'] },
  { question: 'What gas do plants absorb from the atmosphere?', answer: 'Carbon dioxide', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'] },
]

// Shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Get a random question
function getRandomQuestion(): { question: string; answer: string; options: string[] } {
  const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)]
  return {
    question: q.question,
    answer: q.answer,
    options: shuffleArray(q.options),
  }
}

// Format question for display
function formatQuestion(state: TriviaState): string {
  let text = `*Trivia - Round ${state.currentRound}/${state.totalRounds}*\n\n`
  text += `*${state.question}*\n\n`
  
  state.options.forEach((opt, i) => {
    text += `${i + 1}. ${opt}\n`
  })
  
  text += '\nReply with the number (1-4) of your answer!'
  
  return text
}

// Format scores
function formatScores(scores: Record<string, number>): string {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return 'No scores yet'
  
  return sorted
    .map(([player, score], i) => `${i + 1}. @${player.split('@')[0]}: ${score} pts`)
    .join('\n')
}

// Start a new trivia game
export async function handleTrivia(ctx: BotContext): Promise<void> {
  // Check if there's already a game
  if (activeGames.has(ctx.chatId)) {
    const game = activeGames.get(ctx.chatId)!
    if (!game.answered) {
      await ctx.reply(`A trivia question is still pending!\n\n${formatQuestion(game)}`)
      return
    }
  }
  
  // Parse number of rounds
  let rounds = 5
  if (ctx.args[0]) {
    const parsed = parseInt(ctx.args[0])
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) {
      rounds = parsed
    }
  }
  
  // Get first question
  const { question, answer, options } = getRandomQuestion()
  
  const game: TriviaState = {
    question,
    answer,
    options,
    scores: {},
    currentRound: 1,
    totalRounds: rounds,
    answered: false,
  }
  
  activeGames.set(ctx.chatId, game)
  
  await ctx.reply(`*Trivia Game Started!*\n${rounds} rounds\n\n${formatQuestion(game)}`)
  
  logger.info(`Trivia game started in ${ctx.chatId}`)
}

// Handle trivia answer
export async function handleTriviaAnswer(ctx: BotContext): Promise<void> {
  const game = activeGames.get(ctx.chatId)
  
  if (!game) {
    return // No active game
  }
  
  if (game.answered) {
    return // Already answered
  }
  
  // Check if message is an answer (1-4)
  const answerNum = parseInt(ctx.text)
  if (isNaN(answerNum) || answerNum < 1 || answerNum > 4) {
    return // Not a valid answer
  }
  
  const selectedAnswer = game.options[answerNum - 1]
  const isCorrect = selectedAnswer === game.answer
  
  game.answered = true
  
  // Update score
  if (isCorrect) {
    game.scores[ctx.sender] = (game.scores[ctx.sender] || 0) + 10
  }
  
  let response = isCorrect
    ? `*Correct!* @${ctx.sender.split('@')[0]} got it right!\n`
    : `*Wrong!* The answer was: ${game.answer}\n`
  
  response += `\n*Current Scores:*\n${formatScores(game.scores)}`
  
  // Check if game is over
  if (game.currentRound >= game.totalRounds) {
    activeGames.delete(ctx.chatId)
    
    response += `\n\n*Game Over!*\n`
    const winner = Object.entries(game.scores).sort((a, b) => b[1] - a[1])[0]
    if (winner) {
      response += `*Winner: @${winner[0].split('@')[0]} with ${winner[1]} points!*`
    }
    
    await ctx.reply(response)
    return
  }
  
  // Next question
  const { question, answer, options } = getRandomQuestion()
  game.question = question
  game.answer = answer
  game.options = options
  game.currentRound++
  game.answered = false
  
  response += `\n\n${formatQuestion(game)}`
  
  await ctx.reply(response)
}

// End trivia game
export async function handleTriviaEnd(ctx: BotContext): Promise<void> {
  const game = activeGames.get(ctx.chatId)
  
  if (!game) {
    await ctx.reply('No trivia game in progress.')
    return
  }
  
  activeGames.delete(ctx.chatId)
  
  let response = '*Trivia Game Ended!*\n\n'
  response += `*Final Scores:*\n${formatScores(game.scores)}`
  
  const winner = Object.entries(game.scores).sort((a, b) => b[1] - a[1])[0]
  if (winner) {
    response += `\n\n*Winner: @${winner[0].split('@')[0]} with ${winner[1]} points!*`
  }
  
  await ctx.reply(response)
}

// Check if message might be a trivia answer
export function mightBeTriviaAnswer(chatId: string, text: string): boolean {
  const game = activeGames.get(chatId)
  if (!game || game.answered) return false
  
  const num = parseInt(text)
  return !isNaN(num) && num >= 1 && num <= 4
}

export default {
  handleTrivia,
  handleTriviaAnswer,
  handleTriviaEnd,
  mightBeTriviaAnswer,
}
