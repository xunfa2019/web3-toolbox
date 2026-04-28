import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { Card, Badge } from '@/components/ui'
import { truncateAddress } from '@/utils/web3'
import { GripVertical, ChevronDown, ChevronUp, Copy, Eye, EyeOff, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface FloatingWalletListProps {
  onFillAddress?: (address: string) => void
  fixed?: boolean
}

export function FloatingWalletList({ onFillAddress, fixed = false }: FloatingWalletListProps) {
  const { wallets, currentChain, removeWallet } = useStore()
  // 默认位置：如果是固定模式则不需要位置状态
  const [position, setPosition] = useState({ x: 280, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showPrivateKeys, setShowPrivateKeys] = useState<Record<string, boolean>>({})
  const [minimized, setMinimized] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 按组分组钱包
  const groupedWallets = wallets.reduce((groups, wallet) => {
    const key = wallet.groupId
    if (!groups[key]) groups[key] = []
    groups[key].push(wallet)
    return groups
  }, {} as Record<string, typeof wallets>)

  // 拖动开始（仅非固定模式）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (fixed) return
    if ((e.target as HTMLElement).closest('button')) return
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  // 拖动中
  useEffect(() => {
    if (fixed) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const newX = Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragOffset.x))
      const newY = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y))
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, fixed])

  // 复制
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制')
  }

  // 切换组折叠
  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  if (wallets.length === 0) return null

  const walletListContent = (
    <Card className={`${fixed ? '' : 'shadow-2xl border-2 border-primary-500/30'}`}>
      {/* 标题栏 */}
      <div
        className={`flex items-center justify-between px-3 py-2 bg-surface-200 rounded-t-lg ${!fixed ? 'cursor-move select-none' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          {!fixed && <GripVertical size={16} className="text-gray-400" />}
          <span className="text-sm font-medium text-white">钱包列表</span>
          <Badge color="green">{wallets.length}</Badge>
        </div>
        <button
          onClick={() => setMinimized(!minimized)}
          className="p-1 hover:bg-surface-100 rounded transition-colors"
        >
          {minimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

        {/* 内容区 */}
        {!minimized && (
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(groupedWallets).map(([groupId, groupWallets]) => {
              const firstWallet = groupWallets[0]
              const isGenerated = firstWallet.source === 'generated'
              const isCollapsed = collapsed[groupId]

              return (
                <div key={groupId} className="border-t border-white/5">
                  {/* 组标题 */}
                  <button
                    onClick={() => toggleGroup(groupId)}
                    className={clsx(
                      'w-full px-3 py-2 flex items-center justify-between text-xs font-medium transition-colors',
                      isGenerated
                        ? 'bg-primary-500/10 text-primary-400 hover:bg-primary-500/20'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>{isGenerated ? '🎲' : '📥'}</span>
                      <span>第 {firstWallet.groupIndex} 批</span>
                      <span className="text-gray-500">({groupWallets.length}个)</span>
                    </div>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>

                  {/* 钱包列表 */}
                  {!isCollapsed && (
                    <div className="divide-y divide-white/5">
                      {groupWallets.map((w, index) => (
                        <div
                          key={w.id}
                          className="px-3 py-2 hover:bg-surface-100/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className={`text-[9px] ${isGenerated ? 'text-primary-400' : 'text-green-400'}`}>
                                {isGenerated ? 'generated' : 'imported'} {w.groupIndex}-{index + 1}
                              </div>
                              <div className="text-xs font-medium text-white truncate">{w.name}</div>
                              <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <span className="truncate">{truncateAddress(w.address)}</span>
                                <button
                                  onClick={() => copy(w.address)}
                                  className="text-gray-500 hover:text-primary-400 shrink-0"
                                  title="复制地址"
                                >
                                  <Copy size={10} />
                                </button>
                                {onFillAddress && (
                                  <button
                                    onClick={() => onFillAddress(w.address)}
                                    className="text-primary-400 hover:text-primary-300 shrink-0 bg-primary-500/20 px-1 rounded"
                                    title="填入地址"
                                  >
                                    填入
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <div className="text-[10px] text-gray-400 font-mono">
                                {parseFloat(w.balance).toFixed(4)}
                              </div>
                            </div>
                          </div>

                          {/* 私钥展示 */}
                          {showPrivateKeys[w.id] && (
                            <div className="mt-1 p-1.5 bg-dark-900 rounded text-[9px] font-mono text-yellow-400 break-all">
                              {w.privateKey}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
    </Card>
  )

  // 固定模式直接返回内容
  if (fixed) {
    return walletListContent
  }

  // 浮动模式返回带定位的容器
  return (
    <div
      ref={containerRef}
      className="fixed z-40"
      style={{ left: position.x, top: position.y }}
    >
      {walletListContent}
    </div>
  )
}
