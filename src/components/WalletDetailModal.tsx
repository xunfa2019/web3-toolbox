import { useState, useEffect } from 'react'
import { Card, Button } from '@/components/ui'
import { truncateAddress } from '@/utils/web3'
import { log, logSuccess, logError } from '@/utils/logger'
import { 
  X, Copy, ExternalLink, RefreshCw, Wallet, Activity, Coins, 
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, Clock,
  Globe, Layers, TrendingUp, Eye, EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'

// 链信息配置
const CHAIN_CONFIG: Record<number, { name: string; symbol: string; icon: string; explorer: string; color: string }> = {
  1: { name: 'Ethereum', symbol: 'ETH', icon: '⟠', explorer: 'https://etherscan.io', color: '#627EEA' },
  56: { name: 'BSC', symbol: 'BNB', icon: '🟡', explorer: 'https://bscscan.com', color: '#F0B90B' },
  137: { name: 'Polygon', symbol: 'MATIC', icon: '🟣', explorer: 'https://polygonscan.com', color: '#8247E5' },
  42161: { name: 'Arbitrum', symbol: 'ETH', icon: '🔵', explorer: 'https://arbiscan.io', color: '#28A0F0' },
  10: { name: 'Optimism', symbol: 'ETH', icon: '🔴', explorer: 'https://optimistic.etherscan.io', color: '#FF0420' },
  43114: { name: 'Avalanche', symbol: 'AVAX', icon: '🔺', explorer: 'https://snowtrace.io', color: '#E84142' },
  250: { name: 'Fantom', symbol: 'FTM', icon: '👻', explorer: 'https://ftmscan.com', color: '#1969FF' },
  8453: { name: 'Base', symbol: 'ETH', icon: '🔷', explorer: 'https://basescan.org', color: '#0052FF' },
}

// 交易类型
type TransactionType = 'send' | 'receive' | 'swap' | 'approve' | 'mint' | 'burn' | 'contract'

interface Transaction {
  hash: string
  chainId: number
  type: TransactionType
  from: string
  to: string
  value: string
  symbol: string
  timestamp: number
  status: 'success' | 'failed'
  gasUsed?: string
  gasFee?: string
}

interface ChainBalance {
  chainId: number
  nativeBalance: string
  tokens: Array<{
    symbol: string
    balance: string
    value?: number
    address: string
    decimals: number
  }>
  totalValue?: number
}

interface WalletDetail {
  address: string
  name: string
  privateKey: string
  source: 'generated' | 'imported'
  groupIndex: number
  balances: ChainBalance[]
  transactions: Transaction[]
  totalValue: number
}

interface WalletDetailModalProps {
  wallet: {
    id: string
    address: string
    name: string
    privateKey: string
    source: 'generated' | 'imported'
    groupIndex: number
    balance: string
  }
  onClose: () => void
}

// 模拟获取全链余额（实际需要调用API）
async function fetchAllChainBalances(address: string): Promise<ChainBalance[]> {
  // 这里应该调用 Debank API 或类似服务
  // 暂时返回模拟数据
  const chains = Object.keys(CHAIN_CONFIG).map(Number)
  const balances: ChainBalance[] = []
  
  for (const chainId of chains) {
    // 模拟随机余额
    const hasBalance = Math.random() > 0.5
    if (hasBalance) {
      balances.push({
        chainId,
        nativeBalance: (Math.random() * 10).toFixed(4),
        tokens: [
          {
            symbol: 'USDT',
            balance: (Math.random() * 1000).toFixed(2),
            value: Math.random() * 1000,
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            decimals: 6,
          },
          {
            symbol: 'USDC',
            balance: (Math.random() * 500).toFixed(2),
            value: Math.random() * 500,
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
          },
        ],
        totalValue: Math.random() * 2000,
      })
    }
  }
  
  return balances
}

// 模拟获取最近交易（实际需要调用API）
async function fetchRecentTransactions(address: string): Promise<Transaction[]> {
  // 这里应该调用区块链浏览器API
  // 暂时返回模拟数据
  const types: TransactionType[] = ['send', 'receive', 'swap', 'approve']
  const transactions: Transaction[] = []
  
  for (let i = 0; i < 10; i++) {
    const type = types[Math.floor(Math.random() * types.length)]
    transactions.push({
      hash: `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      chainId: [1, 56, 137, 42161][Math.floor(Math.random() * 4)],
      type,
      from: type === 'receive' ? `0x${Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('')}` : address,
      to: type === 'send' ? `0x${Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('')}` : address,
      value: (Math.random() * 10).toFixed(4),
      symbol: ['ETH', 'BNB', 'MATIC', 'USDT', 'USDC'][Math.floor(Math.random() * 5)],
      timestamp: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      status: Math.random() > 0.1 ? 'success' : 'failed',
      gasUsed: (Math.random() * 100000).toFixed(0),
      gasFee: (Math.random() * 0.01).toFixed(6),
    })
  }
  
  return transactions.sort((a, b) => b.timestamp - a.timestamp)
}

export function WalletDetailModal({ wallet, onClose }: WalletDetailModalProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [activeTab, setActiveTab] = useState<'assets' | 'activity'>('assets')
  const [expandedChains, setExpandedChains] = useState<Record<number, boolean>>({})
  const [detail, setDetail] = useState<WalletDetail | null>(null)

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      const [balances, transactions] = await Promise.all([
        fetchAllChainBalances(wallet.address),
        fetchRecentTransactions(wallet.address),
      ])
      
      const totalValue = balances.reduce((sum, b) => sum + (b.totalValue || 0), 0)
      
      setDetail({
        address: wallet.address,
        name: wallet.name,
        privateKey: wallet.privateKey,
        source: wallet.source,
        groupIndex: wallet.groupIndex,
        balances,
        transactions,
        totalValue,
      })
    } catch (error: any) {
      logError(`加载钱包详情失败: ${error.message}`)
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [wallet.address])

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    toast.success('已刷新')
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制')
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return `${Math.floor(diff / 86400000)} 天前`
  }

  // 获取交易图标
  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'send': return <ArrowUpRight size={16} className="text-red-400" />
      case 'receive': return <ArrowDownLeft size={16} className="text-green-400" />
      case 'swap': return <RefreshCw size={16} className="text-blue-400" />
      case 'approve': return <Eye size={16} className="text-yellow-400" />
      default: return <Activity size={16} className="text-gray-400" />
    }
  }

  // 获取交易类型名称
  const getTransactionTypeName = (type: TransactionType) => {
    switch (type) {
      case 'send': return '发送'
      case 'receive': return '接收'
      case 'swap': return '兑换'
      case 'approve': return '授权'
      case 'mint': return '铸造'
      case 'burn': return '销毁'
      default: return '合约交互'
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <Card className="w-full max-w-2xl mx-4 animate-fade-in">
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={24} className="animate-spin text-primary-400" />
            <span className="ml-2 text-gray-400">加载中...</span>
          </div>
        </Card>
      </div>
    )
  }

  if (!detail) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div 
        className="w-full max-w-2xl mx-4 animate-fade-in max-h-[90vh] overflow-hidden flex flex-col bg-surface-300 rounded-xl border border-white/10"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {detail.name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-white">{detail.name}</div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={`px-1.5 py-0.5 rounded ${detail.source === 'generated' ? 'bg-primary-500/20 text-primary-400' : 'bg-green-500/20 text-green-400'}`}>
                  {detail.source === 'generated' ? '生成' : '导入'}
                </span>
                <span>#{detail.groupIndex}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-lg text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* 地址和总资产 */}
        <div className="p-4 bg-gradient-to-r from-primary-600/10 to-purple-600/10 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-300">{truncateAddress(detail.address, 8)}</span>
              <button onClick={() => copyToClipboard(detail.address)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                <Copy size={14} />
              </button>
              <a 
                href={`https://etherscan.io/address/${detail.address}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
              >
                <ExternalLink size={14} />
              </a>
            </div>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="text-3xl font-bold text-white">
            ${detail.totalValue.toFixed(2)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            全链总资产估值 (USD)
          </div>

          {/* 私钥显示 */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
            >
              {showPrivateKey ? <EyeOff size={12} /> : <Eye size={12} />}
              {showPrivateKey ? '隐藏私钥' : '显示私钥'}
            </button>
            {showPrivateKey && (
              <button
                onClick={() => copyToClipboard(detail.privateKey)}
                className="text-xs text-gray-400 hover:text-white"
              >
                <Copy size={12} />
              </button>
            )}
          </div>
          {showPrivateKey && (
            <div className="mt-2 p-2 bg-dark-900 rounded-lg font-mono text-xs text-yellow-400 break-all">
              {detail.privateKey}
            </div>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'assets' 
                ? 'text-primary-400 border-b-2 border-primary-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Coins size={14} className="inline mr-1" />
            资产 ({detail.balances.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'activity' 
                ? 'text-primary-400 border-b-2 border-primary-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Activity size={14} className="inline mr-1" />
            活动 ({detail.transactions.length})
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'assets' ? (
            // 资产列表
            <div className="space-y-3">
              {detail.balances.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Layers size={32} className="mx-auto mb-2 opacity-50" />
                  <div>暂无资产</div>
                </div>
              ) : (
                detail.balances.map((chainBalance) => {
                  const chain = CHAIN_CONFIG[chainBalance.chainId]
                  const isExpanded = expandedChains[chainBalance.chainId]
                  
                  return (
                    <div key={chainBalance.chainId} className="bg-surface-100 rounded-lg overflow-hidden">
                      {/* 链头部 */}
                      <button
                        onClick={() => setExpandedChains(prev => ({ ...prev, [chainBalance.chainId]: !isExpanded }))}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{chain?.icon || '🔗'}</span>
                          <div className="text-left">
                            <div className="font-medium text-white">{chain?.name || `Chain ${chainBalance.chainId}`}</div>
                            <div className="text-xs text-gray-400">
                              {chainBalance.nativeBalance} {chain?.symbol}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-medium text-white">${(chainBalance.totalValue || 0).toFixed(2)}</div>
                            <div className="text-xs text-gray-400">{chainBalance.tokens.length} 代币</div>
                          </div>
                          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                      </button>
                      
                      {/* 代币列表 */}
                      {isExpanded && (
                        <div className="border-t border-white/5 divide-y divide-white/5">
                          {/* 原生币 */}
                          <div className="px-4 py-2.5 flex items-center justify-between bg-surface-50">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: chain?.color + '20', color: chain?.color }}>
                                {chain?.icon}
                              </div>
                              <span className="text-sm">{chain?.symbol}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{chainBalance.nativeBalance}</div>
                            </div>
                          </div>
                          
                          {/* ERC20 代币 */}
                          {chainBalance.tokens.map((token, i) => (
                            <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold">
                                  {token.symbol.charAt(0)}
                                </div>
                                <span className="text-sm">{token.symbol}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{token.balance}</div>
                                {token.value && <div className="text-xs text-gray-500">${token.value.toFixed(2)}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            // 活动列表
            <div className="space-y-2">
              {detail.transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock size={32} className="mx-auto mb-2 opacity-50" />
                  <div>暂无活动</div>
                </div>
              ) : (
                detail.transactions.map((tx) => {
                  const chain = CHAIN_CONFIG[tx.chainId]
                  
                  return (
                    <a
                      key={tx.hash}
                      href={`${chain?.explorer || 'https://etherscan.io'}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-surface-100 rounded-lg hover:bg-surface-200 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getTransactionIcon(tx.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{getTransactionTypeName(tx.type)}</span>
                              <span className="text-xs text-gray-500">{chain?.icon} {chain?.name}</span>
                              {tx.status === 'failed' && (
                                <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">失败</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 font-mono">
                              {tx.type === 'send' ? `→ ${truncateAddress(tx.to, 6)}` : `← ${truncateAddress(tx.from, 6)}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium ${tx.type === 'send' ? 'text-red-400' : tx.type === 'receive' ? 'text-green-400' : 'text-white'}`}>
                            {tx.type === 'send' ? '-' : tx.type === 'receive' ? '+' : ''}{tx.value} {tx.symbol}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatTime(tx.timestamp)}
                          </div>
                        </div>
                      </div>
                    </a>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="p-4 border-t border-white/10 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => {
              copyToClipboard(detail.address)
            }}
          >
            <Copy size={14} className="mr-1" /> 复制地址
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => {
              window.open(`https://debank.com/profile/${detail.address}`, '_blank')
            }}
          >
            <ExternalLink size={14} className="mr-1" /> Debank
          </Button>
        </div>
      </div>
    </div>
  )
}
