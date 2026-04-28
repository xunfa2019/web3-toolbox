import { useLogStore, LogLevel, LogLink } from '@/stores/useLogStore'

// 简化的日志调用
export function log(message: string, details?: string, links?: LogLink[]) {
  useLogStore.getState().addLog('info', message, details, links)
}

export function logSuccess(message: string, details?: string, links?: LogLink[]) {
  useLogStore.getState().addLog('success', message, details, links)
}

export function logError(message: string, details?: string, links?: LogLink[]) {
  useLogStore.getState().addLog('error', message, details, links)
}

export function logWarn(message: string, details?: string, links?: LogLink[]) {
  useLogStore.getState().addLog('warning', message, details, links)
}

export function logBatch(message: string, details?: string, links?: LogLink[]) {
  useLogStore.getState().addLog('batch', message, details, links)
}
