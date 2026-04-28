import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { Card, Button, Input, Select } from '@/components/ui'
import { BACKUP_RPCS } from '@/types'
import { log, logSuccess } from '@/utils/logger'
import { Globe, X, Plus, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface NetworkSettingsModalProps {
  onClose: () => void
  isConnected: boolean
  onCheckConnection: () => void
  checking: boolean
}

export function NetworkSettingsModal({ onClose, isConnected, onCheckConnection, checking }: NetworkSettingsModalProps) {
  const { chains, currentChain, setCurrentChain, addChain } = useStore()
  const [showAddChain, setShowAddChain] = useState(false)
  const [rpcStatuses, setRpcStatuses] = useState<Record<string, 'checking' | 'ok' | 'fail'>>({})
  const [newChain, setNewChain] = useState({
    name: '',
    rpcUrl: '',
    symbol: '',
    explorer: '',
    chainId: '',
  })

  // 获取当前网络的备用 RPC 列表
  const backupRpcs = BACKUP_RPCS[currentChain.id] || []

  // 检测单个 RPC 状态
  const checkRpcStatus = async (rpc: string) => {
    setRpcStatuses(prev => ({ ...prev, [rpc]: 'checking' }))
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      const data = await response.json()
      setRpcStatuses(prev => ({ ...prev, [rpc]: data.result ? 'ok' : 'fail' }))
    } catch {
      setRpcStatuses(prev => ({ ...prev, [rpc]: 'fail' }))
    }
  }

  // 检测所有备用 RPC
  const checkAllRpcs = async () => {
    for (const rpc of backupRpcs) {
      await checkRpcStatus(rpc)
    }
  }

  // 切换到指定 RPC
  const switchToRpc = (rpc: string) => {
    // 更新当前网络的 RPC
    const updatedChain = { ...currentChain, rpcUrl: rpc }
    setCurrentChain(updatedChain)
    log(`已切换 RPC: ${rpc}`)
    toast.success('RPC 已切换')
    onCheckConnection()
  }

  // 初始化时检测所有 RPC
  useEffect(() => {
    if (backupRpcs.length > 0) {
      checkAllRpcs()
    }
  }, [currentChain.id])

  const handleAddChain = () => {
    if (!newChain.name || !newChain.rpcUrl || !newChain.symbol || !newChain.chainId) {
      return toast.error('请填写完整信息')
    }
    addChain({
      id: parseInt(newChain.chainId),
      name: newChain.name,
      rpcUrl: newChain.rpcUrl,
      symbol: newChain.symbol,
      explorer: newChain.explorer,
    })
    setNewChain({ name: '', rpcUrl: '', symbol: '', explorer: '', chainId: '' })
    setShowAddChain(false)
    logSuccess(`添加网络: ${newChain.name} (${newChain.symbol})`)
    toast.success('网络已添加')
  }

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="w-full max-w-md mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <Card>
            {/* 标题 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-primary-400" />
                <h2 className="text-lg font-semibold">网络设置</h2>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-surface-100 rounded transition-colors">
                <X size={18} />
              </button>
            </div>

        {/* 网络选择 */}
        <div className="space-y-4">
          <Select
            label="选择网络"
            value={String(currentChain.id)}
            onChange={(v) => {
              const chain = chains.find((c) => c.id === parseInt(v))
              if (chain) {
                setCurrentChain(chain)
                log(`切换网络: ${chain.name} (${chain.symbol})`)
              }
            }}
            options={chains.map((c) => ({
              value: String(c.id),
              label: `${c.name} (${c.symbol})`,
            }))}
          />

          <Input
            label="当前 RPC"
            value={currentChain.rpcUrl}
            onChange={() => {}}
            placeholder="https://..."
          />

          {/* 备用 RPC 列表 */}
          {backupRpcs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">备用 RPC 节点</label>
                <button
                  onClick={checkAllRpcs}
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  刷新状态
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {backupRpcs.map((rpc, i) => {
                  const status = rpcStatuses[rpc]
                  const isCurrent = rpc === currentChain.rpcUrl
                  return (
                    <div
                      key={rpc}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                        isCurrent ? 'bg-primary-600/20 border border-primary-500/30' : 'bg-dark-900/50'
                      }`}
                    >
                      {/* 状态指示 */}
                      <div className="shrink-0">
                        {status === 'checking' && (
                          <Loader2 size={14} className="text-yellow-400 animate-spin" />
                        )}
                        {status === 'ok' && (
                          <Check size={14} className="text-green-400" />
                        )}
                        {status === 'fail' && (
                          <X size={14} className="text-red-400" />
                        )}
                        {!status && (
                          <div className="w-3.5 h-3.5 rounded-full bg-gray-600" />
                        )}
                      </div>
                      
                      {/* RPC 地址 */}
                      <div className="flex-1 truncate font-mono text-gray-300">
                        {rpc}
                      </div>
                      
                      {/* 操作按钮 */}
                      {!isCurrent && status === 'ok' && (
                        <button
                          onClick={() => switchToRpc(rpc)}
                          className="shrink-0 px-2 py-1 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 rounded transition-colors"
                        >
                          切换
                        </button>
                      )}
                      {isCurrent && (
                        <span className="shrink-0 text-primary-400">当前</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sepolia DEX 入口 */}
          {currentChain.id === 11155111 && (
            <div className="pt-3 border-t border-white/5">
              <label className="text-sm text-gray-400 mb-2 block">Sepolia DEX</label>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="https://app.uniswap.org/#/swap?chain=sepolia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-100 hover:bg-primary-600/20 transition-colors text-sm text-gray-300 hover:text-primary-400"
                >
                  <svg className="w-5 h-5" viewBox="0 0 40 40" fill="currentColor">
                    <path d="M20 40C31.0457 40 40 31.0457 40 20C40 8.9543 31.0457 0 20 0C8.9543 0 0 8.9543 0 20C0 31.0457 8.9543 40 20 40Z"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M20 38C29.9411 38 38 29.9411 38 20C38 10.0589 29.9411 2 20 2C10.0589 2 2 10.0589 2 20C2 29.9411 10.0589 38 20 38ZM26.6 15.6C27.1 14.9 27.8 14.5 28.6 14.5C29.4 14.5 30.1 14.9 30.6 15.6L30.7 15.7C31.3 16.5 31.4 17.6 30.9 18.5L25.4 27.5C24.9 28.3 24 28.8 23 28.8H22.9C21.9 28.8 21 28.3 20.5 27.5L15 18.5C14.5 17.6 14.6 16.5 15.2 15.7L15.3 15.6C15.8 14.9 16.5 14.5 17.3 14.5C18.1 14.5 18.8 14.9 19.3 15.6L20 16.7L20.7 15.6C21.2 14.9 21.9 14.5 22.7 14.5C23.5 14.5 24.2 14.9 24.7 15.6L25.4 16.7L26.6 15.6Z" fill="white"/>
                  </svg>
                  <span>Uniswap</span>
                </a>
                <a
                  href="https://www.sushi.com/swap?chainId=11155111"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-100 hover:bg-primary-600/20 transition-colors text-sm text-gray-300 hover:text-primary-400"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v2h-4v-2zm0 3h4v2h-4v-2zm0-6h4v2h-4V8z"/>
                  </svg>
                  <span>SushiSwap</span>
                </a>
                <a
                  href="https://pancakeswap.finance/swap?chain=sepolia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-100 hover:bg-primary-600/20 transition-colors text-sm text-gray-300 hover:text-primary-400"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  <span>PancakeSwap</span>
                </a>
                <a
                  href="https://sepolia.etherscan.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-100 hover:bg-primary-600/20 transition-colors text-sm text-gray-300 hover:text-primary-400"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <span>浏览器</span>
                </a>
              </div>
            </div>
          )}

          <Input
            label="区块浏览器"
            value={currentChain.explorer}
            onChange={() => {}}
            placeholder="https://..."
          />
        </div>

        {/* 添加网络 */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <button
            onClick={() => setShowAddChain(!showAddChain)}
            className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            <Plus size={14} />
            {showAddChain ? '收起' : '添加自定义网络'}
          </button>

          {showAddChain && (
            <div className="mt-3 space-y-3 p-3 bg-dark-900/50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="名称"
                  value={newChain.name}
                  onChange={(v) => setNewChain((p) => ({ ...p, name: v }))}
                  placeholder="My Chain"
                />
                <Input
                  label="Chain ID"
                  value={newChain.chainId}
                  onChange={(v) => setNewChain((p) => ({ ...p, chainId: v }))}
                  placeholder="1234"
                />
              </div>
              <Input
                label="RPC"
                value={newChain.rpcUrl}
                onChange={(v) => setNewChain((p) => ({ ...p, rpcUrl: v }))}
                placeholder="https://..."
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="符号"
                  value={newChain.symbol}
                  onChange={(v) => setNewChain((p) => ({ ...p, symbol: v }))}
                  placeholder="ETH"
                />
                <Input
                  label="浏览器"
                  value={newChain.explorer}
                  onChange={(v) => setNewChain((p) => ({ ...p, explorer: v }))}
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddChain}>添加</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddChain(false)}>取消</Button>
              </div>
            </div>
          )}
        </div>

        {/* 连接状态和按钮 */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                {isConnected ? '已连接' : '未连接'}
              </span>
            </div>
            <Button 
              size="sm" 
              variant={isConnected ? 'secondary' : 'primary'}
              onClick={onCheckConnection}
              disabled={checking}
            >
              {checking ? '检测中...' : isConnected ? '刷新连接' : '重新连接'}
            </Button>
          </div>
        </div>
          </Card>
        </div>
      </div>
    )
}
