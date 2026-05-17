import { getDatabase } from './index'
import { ChatSettings, FeatureName } from '../types'
import config from '../config'

export function getSettings(chatId: string): ChatSettings {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT chat_id as chatId, anti_delete as antiDelete, viewonce_save as viewonceSave,
           auto_view_status as autoViewStatus, auto_react_status as autoReactStatus
    FROM settings WHERE chat_id = ?
  `)
  
  const result = stmt.get(chatId) as ChatSettings | undefined
  
  if (!result) {
    // Return defaults
    return {
      chatId,
      antiDelete: config.defaults.antiDelete ? 1 : 0,
      viewonceSave: config.defaults.viewonceSave ? 1 : 0,
      autoViewStatus: config.defaults.autoViewStatus ? 1 : 0,
      autoReactStatus: config.defaults.autoReactStatus ? 1 : 0,
    }
  }
  
  return result
}

export function updateSetting(chatId: string, feature: FeatureName, enabled: boolean): void {
  const db = getDatabase()
  
  // First ensure the row exists
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO settings (chat_id, anti_delete, viewonce_save, auto_view_status, auto_react_status)
    VALUES (?, ?, ?, ?, ?)
  `)
  
  insertStmt.run(
    chatId,
    config.defaults.antiDelete ? 1 : 0,
    config.defaults.viewonceSave ? 1 : 0,
    config.defaults.autoViewStatus ? 1 : 0,
    config.defaults.autoReactStatus ? 1 : 0
  )
  
  // Map feature name to column name
  const columnMap: Record<FeatureName, string> = {
    antiDelete: 'anti_delete',
    viewonceSave: 'viewonce_save',
    autoViewStatus: 'auto_view_status',
    autoReactStatus: 'auto_react_status',
  }
  
  const column = columnMap[feature]
  const updateStmt = db.prepare(`UPDATE settings SET ${column} = ? WHERE chat_id = ?`)
  updateStmt.run(enabled ? 1 : 0, chatId)
}

export function isFeatureEnabled(chatId: string, feature: FeatureName): boolean {
  const settings = getSettings(chatId)
  return settings[feature] === 1
}

export function getAllEnabledChats(feature: FeatureName): string[] {
  const db = getDatabase()
  
  const columnMap: Record<FeatureName, string> = {
    antiDelete: 'anti_delete',
    viewonceSave: 'viewonce_save',
    autoViewStatus: 'auto_view_status',
    autoReactStatus: 'auto_react_status',
  }
  
  const column = columnMap[feature]
  const stmt = db.prepare(`SELECT chat_id FROM settings WHERE ${column} = 1`)
  const results = stmt.all() as { chat_id: string }[]
  
  return results.map(r => r.chat_id)
}

export default {
  getSettings,
  updateSetting,
  isFeatureEnabled,
  getAllEnabledChats,
}
