import { ReactNode, useState, useRef, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { LogPanel } from './LogPanel'
import { useStore } from '@/stores/useStore'
import { Toaster } from 'react-hot-toast'
import clsx from 'clsx'

export function Layout({ children }: { children: ReactNode }) {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const [logHeight, setLogHeight] = useState(300) // 默认高度
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startY.current = e.clientY
    startHeight.current = logHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [logHeight])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    const delta = startY.current - e.clientY
    const newHeight = Math.min(Math.max(startHeight.current + delta, 150), window.innerHeight * 0.6)
    setLogHeight(newHeight)
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  // 添加全局事件监听
  if (typeof window !== 'undefined') {
    window.onmousemove = handleMouseMove
    window.onmouseup = handleMouseUp
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div
        className={clsx(
          'flex-1 flex flex-col transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        {/* 功能区 */}
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-6xl mx-auto p-6">{children}</div>
        </main>

        {/* 拖拽条 */}
        <div
          className="h-2 bg-surface-300 hover:bg-primary-600/30 cursor-row-resize transition-colors flex items-center justify-center group"
          onMouseDown={handleMouseDown}
        >
          <div className="w-10 h-1 bg-gray-600 group-hover:bg-primary-500 rounded-full transition-colors" />
        </div>

        {/* 日志区 */}
        <div style={{ height: logHeight }} className="shrink-0">
          <LogPanel />
        </div>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e1e30',
            color: '#e5e7eb',
            border: '1px solid rgba(255,255,255,0.05)',
          },
        }}
      />
    </div>
  )
}
