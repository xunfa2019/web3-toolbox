import { useRef, useEffect, useState } from 'react'
import { useLogStore, LogLevel } from '@/stores/useLogStore'
import { useStore } from '@/stores/useStore'
import { log, logSuccess, logWarn } from '@/utils/logger'
import { Trash2, Terminal, Wifi, WifiOff, Download, Wallet } from 'lucide-react'
import clsx from 'clsx'

const levelColors: Record<LogLevel, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  batch: 'text-cyan-400',
}

const levelLabels: Record<LogLevel, string> = {
  info: 'INFO',
  success: 'OK',
  error: 'ERR',
  warning: 'WARN',
  batch: '>>',
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

export function LogPanel() {
  const { logs, clearLogs } = useLogStore()
  const { wallets, isRunning, setRunning, setShouldStop } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // 新日志时自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs.length])

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 保存日志为文档
  const saveLogs = () => {
    if (logs.length === 0) return

    const content = logs
      .slice()
      .reverse()
      .map((log) => {
        const time = formatTime(log.timestamp)
        const level = levelLabels[log.level]
        return `[${time}] [${level}] ${log.message}${log.details ? ` | ${log.details}` : ''}`
      })
      .join('\n')

    const header = `Web3 工具箱 - 运行日志\n导出时间: ${new Date().toLocaleString('zh-CN')}\n${'='.repeat(50)}\n\n`

    const blob = new Blob([header + content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `web3-logs-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d14] border-t-2 border-primary-600/30">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-400/50 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Terminal size={15} className="text-primary-400" />
          <span className="font-semibold">运行日志</span>
          <span className="text-xs text-gray-500 bg-surface-200 px-2 py-0.5 rounded-full">
            {logs.length} 条
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={() => {
                const confirmed = window.confirm('确定要强制结束当前任务吗？')
                if (confirmed) {
                  setShouldStop(true)
                  setRunning(false)
                  logWarn('⚠️ 用户强制结束任务')
                  log('正在重新连接网络...')
                  setTimeout(() => {
                    logSuccess('网络已重新连接，任务已中断')
                  }, 1000)
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs transition-colors animate-pulse"
              title="强制结束当前任务"
            >
              强制结束
            </button>
          )}
          <button
            onClick={saveLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-100 text-gray-400 hover:text-gray-200 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title="保存日志"
          >
            <Download size={12} />
            保存
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-100 text-gray-400 hover:text-gray-200 transition-colors text-xs"
            title="清空日志"
          >
            <Trash2 size={12} />
            清空
          </button>
        </div>
      </div>

      {/* 日志列表 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <Terminal size={24} className="mb-2 opacity-50" />
            <span>暂无日志</span>
            <span className="text-[10px] mt-1">操作后将在此显示</span>
          </div>
        ) : (
          [...logs].reverse().map((log, i) => (
            <div
              key={log.id}
              className={clsx(
                'py-1 px-2 rounded transition-colors',
                log.level === 'batch' 
                  ? 'bg-cyan-500/5 hover:bg-cyan-500/10 flex gap-2 text-[10px]' 
                  : 'py-1.5 px-2 rounded bg-surface-400/20 hover:bg-surface-400/40 flex gap-2 text-[11px]',
                log.level === 'error' && 'bg-red-500/10 border-l-2 border-red-500',
                log.level === 'success' && 'bg-green-500/10 border-l-2 border-green-500'
              )}
            >
              <span className={log.level === 'batch' ? 'text-gray-500 shrink-0 w-12 text-[9px]' : 'text-gray-500 shrink-0 w-14 text-[10px]'}>
                {formatTime(log.timestamp)}
              </span>
              <span className={clsx('shrink-0 font-bold', log.level === 'batch' ? 'w-4 text-[9px]' : 'w-8 text-[10px]', levelColors[log.level])}>
                [{levelLabels[log.level]}]
              </span>
              <span className={clsx(
                'break-all flex-1',
                log.level === 'error' ? 'text-red-400' : 
                log.level === 'success' ? 'text-green-400' : 
                log.level === 'batch' ? 'text-cyan-300' :
                'text-gray-200'
              )}>
                {log.links && log.links.length > 0 ? (
                  <span>
                    {log.message.split(/(0x[a-fA-F0-9]{64,})/g).map((part, idx) => {
                      const link = log.links?.find(l => l.text === part)
                      if (link) {
                        return (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={clsx(
                              'underline hover:no-underline cursor-pointer',
                              link.type === 'tx' ? 'text-blue-400 hover:text-blue-300' :
                              link.type === 'address' ? 'text-purple-400 hover:text-purple-300' :
                              'text-cyan-400 hover:text-cyan-300'
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {part}
                          </a>
                        )
                      }
                      return part
                    })}
                  </span>
                ) : (
                  log.message
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface-400/30 border-t border-white/5 text-[10px] text-gray-600 shrink-0">
        <span>实时更新 · 最多保留 200 条</span>
        <div className="flex items-center gap-4">
          {/* 钱包数量 */}
          {wallets.length > 0 && (
            <div className="flex items-center gap-1">
              <Wallet size={10} className="text-green-500" />
              <span className="text-green-500">{wallets.length} 钱包</span>
            </div>
          )}
          {/* 网络状态 */}
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <>
                <Wifi size={10} className="text-green-500" />
                <span className="text-green-500">已连接</span>
              </>
            ) : (
              <>
                <WifiOff size={10} className="text-red-500" />
                <span className="text-red-500">已断开</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
