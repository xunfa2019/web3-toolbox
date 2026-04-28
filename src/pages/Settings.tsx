import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { Card, Button, Input, Select } from '@/components/ui'
import { PRESET_CHAINS } from '@/types'
import { log, logSuccess } from '@/utils/logger'
import { Globe, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export function Settings() {
  const { chains, currentChain, setCurrentChain, addChain } = useStore()
  const [showAddChain, setShowAddChain] = useState(false)
  const [newChain, setNewChain] = useState({
    name: '',
    rpcUrl: '',
    symbol: '',
    explorer: '',
    chainId: '',
  })

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
    <div className="animate-fade-in -ml-3">
      {/* 网络设置 */}
      <Card className="space-y-4 w-full max-w-md">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe size={18} /> 网络设置
          </h2>
          <Button size="sm" onClick={() => setShowAddChain(!showAddChain)}>
            <Plus size={14} /> 添加网络
          </Button>
        </div>

        {showAddChain ? (
          <div className="space-y-3 p-4 bg-dark-900/50 rounded-lg border border-white/5">
            <div className="grid grid-cols-2 gap-3">
              <Input label="名称" value={newChain.name} onChange={(v) => setNewChain((p) => ({ ...p, name: v }))} placeholder="My Chain" />
              <Input label="Chain ID" value={newChain.chainId} onChange={(v) => setNewChain((p) => ({ ...p, chainId: v }))} placeholder="1234" />
            </div>
            <Input label="RPC" value={newChain.rpcUrl} onChange={(v) => setNewChain((p) => ({ ...p, rpcUrl: v }))} placeholder="https://..." />
            <div className="grid grid-cols-2 gap-3">
              <Input label="符号" value={newChain.symbol} onChange={(v) => setNewChain((p) => ({ ...p, symbol: v }))} placeholder="ETH" />
              <Input label="浏览器" value={newChain.explorer} onChange={(v) => setNewChain((p) => ({ ...p, explorer: v }))} placeholder="https://..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddChain}>确认添加</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddChain(false)}>取消</Button>
            </div>
          </div>
        ) : (
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
              label="RPC 地址"
              value={currentChain.rpcUrl}
              onChange={() => {}}
              placeholder="https://..."
            />

            <Input
              label="链 ID"
              value={String(currentChain.id)}
              onChange={() => {}}
              placeholder="56"
            />

            <Input
              label="区块浏览器"
              value={currentChain.explorer}
              onChange={() => {}}
              placeholder="https://..."
            />

            <Button className="w-full">
              连接
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
