import { WASocket } from '@whiskeysockets/baileys'

// Generate a random delay between min and max (inclusive)
export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Sleep for ms milliseconds
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Simulates human typing delay based on text length.
 * Adds a base delay (reaction time) + typing time + jitter.
 * @param text The text to be sent
 * @param wpm Words per minute (average human is 40-60)
 */
export async function simulateTyping(
  sock: WASocket,
  chatId: string,
  text: string,
  wpm: number = 60
): Promise<void> {
  // Base human reaction time before starting to type (e.g., picking up phone)
  const reactionTime = getRandomDelay(1000, 2500)
  await sleep(reactionTime)

  // Send composing status
  try {
    await sock.sendPresenceUpdate('composing', chatId)
  } catch (e) {
    // Ignore presence errors
  }

  // Calculate typing duration
  // Average word length is ~5 characters.
  const charsPerSecond = (wpm * 5) / 60
  const typingDurationMs = (text.length / charsPerSecond) * 1000
  
  // Cap the maximum typing duration to 8 seconds so the bot isn't too slow for long texts
  // Add some random jitter (±15%)
  let finalDuration = Math.min(typingDurationMs, 8000)
  const jitter = finalDuration * 0.15
  finalDuration = getRandomDelay(finalDuration - jitter, finalDuration + jitter)

  await sleep(finalDuration)
  
  // Clear composing status
  try {
    await sock.sendPresenceUpdate('paused', chatId)
  } catch (e) {
    // Ignore presence errors
  }
}

/**
 * Calculate delay for sending media
 */
export async function simulateMediaUpload(
  sock: WASocket,
  chatId: string,
  sizeBytes: number = 0
): Promise<void> {
  const reactionTime = getRandomDelay(800, 1500)
  await sleep(reactionTime)
  
  // Minimal delay for media preparation (assume 1-3 seconds + based on size if provided)
  const uploadTime = getRandomDelay(1000, 3000)
  
  // Note: Baileys doesn't have an explicit 'uploading media' presence,
  // we just wait before sending it.
  await sleep(uploadTime)
}
