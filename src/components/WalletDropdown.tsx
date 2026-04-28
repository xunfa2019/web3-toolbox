import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { Badge } from '@/components/ui'
import { truncateAddress } from '@/utils/web3'
import { Copy, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { log } from '@/utils/logger'
import clsx from 'clsx'

interface WalletDropdownProps {
  onFillAddress?: (address: string) => void
}

export function WalletDropdown({ onFillAddress }: WalletDropdownProps) {
  const { wallets, currentChain, updateWalletBalance } = useStore()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)

  // 按组分组钱包
  const groupedWallets = wallets.reduce((groups, wallet) => {
    const key = wallet.groupId
    if (!groups[key]) groups[key] = []
    groups[key].push(wallet)
    return groups
  }, {} as Record<string, typeof wallets>)

  // 复制
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制')
  }

  // 切换组折叠
  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      {/* 标题 */}
      <div className="sticky top-0 px-4 py-3 bg-surface-200 border-b border-white/5 flex items-center justify-between">
        <span className="text-sm font-medium text-white">钱包列表</span>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setRefreshing(true)
              const { refreshBalances: refresh } = await import('@/utils/web3')
              await refresh(wallets, currentChain, (id, balance) => updateWalletBalance(id, balance))
              setRefreshing(false)
              
              // 按批次统计
              const groups = wallets.reduce((acc, w) => {
                if (!acc[w.groupId]) {
                  acc[w.groupId] = { 
                    index: w.groupIndex, 
                    source: w.source, 
                    count: 0, 
                    totalBalance: 0 
                  }
                }
                acc[w.groupId].count++
                acc[w.groupId].totalBalance += parseFloat(w.balance)
                return acc
              }, {} as Record<string, { index: number; source: string; count: number; totalBalance: number }>)
              
              const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0)
              
              log(`余额刷新完成 | 网络: ${currentChain.name} (${currentChain.symbol})`)
              Object.values(groups)
                .sort((a, b) => a.index - b.index)
                .forEach(g => {
                  const icon = g.source === 'generated' ? '🎲' : '📥'
                  log(`${icon} 第${g.index}批: ${g.count}个钱包 | 余额: ${g.totalBalance.toFixed(6)} ${currentChain.symbol}`)
                })
              log(`总计: ${wallets.length}个钱包 | 总余额: ${totalBalance.toFixed(6)} ${currentChain.symbol}`)
              
              toast.success('余额已刷新')
            }}
            disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 rounded bg-surface-100 hover:bg-primary-600/20 text-gray-400 hover:text-primary-400 transition-colors text-xs disabled:opacity-50"
            title="刷新余额"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            刷新余额
          </button>
          <Badge color="green">{wallets.length}</Badge>
        </div>
      </div>

      {/* 分组列表 */}
      <div className="divide-y divide-white/5">
        {Object.entries(groupedWallets).map(([groupId, groupWallets]) => {
          const firstWallet = groupWallets[0]
          const isGenerated = firstWallet.source === 'generated'
          const isCollapsed = collapsed[groupId]

          return (
            <div key={groupId}>
              {/* 组标题 */}
              <button
                onClick={() => toggleGroup(groupId)}
                className={clsx(
                  'w-full px-4 py-2 flex items-center justify-between text-xs font-medium transition-colors',
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
                  {groupWallets.map((w) => (
                    <div
                      key={w.id}
                      className="px-4 py-2.5 hover:bg-surface-100/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">{w.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-500 font-mono">
                              {truncateAddress(w.address)}
                            </span>
                            <button
                              onClick={() => copy(w.address)}
                              className="text-gray-500 hover:text-primary-400 transition-colors"
                              title="复制地址"
                            >
                              <Copy size={12} />
                            </button>
                            {onFillAddress && (
                              <button
                                onClick={() => onFillAddress(w.address)}
                                className="text-xs text-primary-400 hover:text-primary-300 bg-primary-500/20 px-1.5 py-0.5 rounded transition-colors"
                                title="填入地址"
                              >
                                填入
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-xs text-gray-400 font-mono">
                            {parseFloat(w.balance).toFixed(4)}
                          </div>
                          <div className="text-[10px] text-gray-600">{currentChain.symbol}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
