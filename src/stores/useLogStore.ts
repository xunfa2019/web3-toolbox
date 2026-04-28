import { create } from 'zustand'

export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'batch'

export interface LogLink {
  text: string
  url: string
  type: 'tx' | 'address' | 'url'
}

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
  details?: string
  links?: LogLink[]
}

interface LogState {
  logs: LogEntry[]
  addLog: (level: LogLevel, message: string, details?: string, links?: LogLink[]) => void
  clearLogs: () => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  addLog: (level, message, details, links) =>
    set((s) => ({
      logs: [
        { id: crypto.randomUUID(), timestamp: Date.now(), level, message, details, links },
        ...s.logs,
      ].slice(0, 200), // 最多保留200条
    })),
  clearLogs: () => set({ logs: [] }),
}))
