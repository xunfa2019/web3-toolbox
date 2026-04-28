import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { Card, Button, Input, Textarea, Table, Badge } from '@/components/ui'
import { WalletType } from '@/types'
import { generateWallets, importFromPrivateKeys, importFromMnemonic, truncateAddress } from '@/utils/web3'
import { log, logSuccess, logError, logWarn } from '@/utils/logger'
import { Plus, Trash2, Copy, Eye, EyeOff, Download, RefreshCw, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { WalletDetailModal } from '@/components/WalletDetailModal'

export function Wallets() {
  const { wallets, currentChain, addWallets, removeWallet, clearWallets, updateWalletBalance, walletGroupIndex } = useStore()
  const walletType: WalletType = 'evm' // 默认 EVM
  const [importText, setImportText] = useState('')
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateCount, setGenerateCount] = useState('1')
  const [selectedWallet, setSelectedWallet] = useState<typeof wallets[0] | null>(null)

  // 智能识别并导入
  const handleSmartImport = () => {
    const text = importText.trim()
    if (!text) {
      toast.error('请输入私钥或助记词')
      return
    }

    try {
      let newWallets: ReturnType<typeof generateWallets> = []
      // 过滤掉注释行和空行
      const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && !l.startsWith('//'))

      // 判断是助记词还是私钥
      if (lines.length === 1 && !lines[0].startsWith('0x') && lines[0].split(/\s+/).length >= 12) {
        // 助记词
        const wordCount = lines[0].split(/\s+/).length
        log(`识别为助记词 (${wordCount} 个单词)，开始派生钱包...`)
        newWallets = importFromMnemonic(lines[0].trim(), 5, currentChain.id, walletType, walletGroupIndex + 1)
        logSuccess(`从助记词派生 ${newWallets.length} 个 ${walletType.toUpperCase()} 钱包`)
      } else {
        // 私钥（单个或多个）- 支持 CSV 格式
        const keys = lines.map(l => {
          // 如果是 CSV 格式（包含逗号），提取第一列（私钥）
          if (l.includes(',')) {
            return l.split(',')[0].trim()
          }
          return l
        }).filter(l => l.length > 0)
        
        log(`识别为 ${keys.length} 个私钥，开始导入...`)
        newWallets = importFromPrivateKeys(keys, currentChain.id, walletType, walletGroupIndex + 1)
        logSuccess(`从私钥导入 ${newWallets.length} 个 ${walletType.toUpperCase()} 钱包`)
      }

      addWallets(newWallets)
      setImportText('')
      
      // 显示详细日志
      if (newWallets.length <= 5) {
        newWallets.forEach((w, i) => {
          log(`  ${i + 1}. ${w.name}: ${w.address}`)
        })
      } else {
        log(`  前3个地址:`)
        newWallets.slice(0, 3).forEach((w, i) => {
          log(`  ${i + 1}. ${w.name}: ${w.address}`)
        })
        log(`  ... 共 ${newWallets.length} 个钱包`)
      }

      logWarn(`⚠️ 请妥善保管私钥！`)
      toast.success(`成功导入 ${newWallets.length} 个钱包`)
    } catch (e: any) {
      logError(`导入失败: ${e.message}`)
      toast.error(`导入失败: ${e.message}`)
    }
  }

  // 随机生成
  const handleGenerate = () => {
    setShowGenerateModal(true)
  }

  // 确认生成
  const confirmGenerate = () => {
    const count = Math.min(Math.max(parseInt(generateCount) || 1, 1), 10000)
    try {
      log(`开始生成 ${count} 个 ${walletType.toUpperCase()} 钱包...`)
      const newWallets = generateWallets(count, currentChain.id, walletType, walletGroupIndex + 1)
      addWallets(newWallets)
      logSuccess(`生成 ${newWallets.length} 个 ${walletType.toUpperCase()} 钱包成功 (第 ${walletGroupIndex + 1} 批)`)
      
      // 显示详细日志
      if (newWallets.length <= 5) {
        newWallets.forEach((w, i) => {
          log(`  ${i + 1}. ${w.name}: ${w.address}`)
        })
      } else {
        log(`  前3个地址:`)
        newWallets.slice(0, 3).forEach((w, i) => {
          log(`  ${i + 1}. ${w.name}: ${w.address}`)
        })
        log(`  ... 共 ${newWallets.length} 个钱包`)
      }

      // 自动保存钱包文档
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const fileName = `${newWallets.length}-wallets-generated-${timestamp}.csv`
      const data = newWallets.map((w) => `${w.privateKey},${w.name},${w.address},${w.type}`).join('\n')
      const blob = new Blob([`# Web3 工具箱 - 生成钱包\n# 时间: ${new Date().toLocaleString('zh-CN')}\n# 网络: ${currentChain.name} (${currentChain.symbol})\n# 数量: ${newWallets.length}\n# PrivateKey,Name,Address,Type\n${data}`], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      
      logSuccess(`钱包已保存: ${fileName}`)
      log(`保存位置: 浏览器默认下载目录`)
      logWarn(`⚠️ 请妥善保管私钥文件！`)

      toast.success(`成功生成 ${newWallets.length} 个钱包，已自动保存`, { duration: 3000 })
      setShowGenerateModal(false)
      setGenerateCount('1')
    } catch (e: any) {
      logError(`生成失败: ${e.message}`)
      toast.error(`生成失败: ${e.message}`)
    }
  }

  // 复制
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制')
  }

  // 导出钱包
  const exportWallets = () => {
    const data = wallets.map((w) => `${w.privateKey},${w.name},${w.address},${w.type}`).join('\n')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `${wallets.length}-wallets-exported-${timestamp}.csv`
    const blob = new Blob([`# 请妥善保管此文件！\n# PrivateKey,Name,Address,Type\n${data}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    logSuccess(`钱包已导出: ${fileName} (共 ${wallets.length} 个)`)
    log(`文件保存位置: 浏览器默认下载目录`)
    toast.success('已导出')
  }

  // 清空钱包
  const handleClearWallets = () => {
    if (wallets.length === 0) return
    const confirmed = window.confirm(
      `⚠️ 警告：即将清空 ${wallets.length} 个钱包！\n\n请确保已导出并妥善保存私钥，清空后无法恢复！\n\n确定要继续吗？`
    )
    if (confirmed) {
      clearWallets()
      logWarn(`已清空所有钱包 (${wallets.length} 个)`)
      toast.success('已清空')
    }
  }

  // 刷新余额
  const refreshBalances = async () => {
    setRefreshing(true)
    const { refreshBalances: refresh } = await import('@/utils/web3')
    await refresh(wallets, currentChain, (id, balance) => updateWalletBalance(id, balance))
    setRefreshing(false)
    toast.success('余额已刷新')
  }

  // 过滤当前类型的钱包
  const filteredWallets = wallets.filter(w => w.type === walletType)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">钱包管理</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={refreshBalances} disabled={refreshing || !wallets.length}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            刷新余额
          </Button>
          <Button variant="secondary" size="sm" onClick={exportWallets} disabled={!wallets.length}>
            <Download size={14} /> 导出
          </Button>
          <Button variant="danger" size="sm" onClick={handleClearWallets} disabled={!wallets.length}>
            <Trash2 size={14} /> 清空
          </Button>
        </div>
      </div>

      {/* 钱包导入 */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-400">钱包导入</h2>
          <Button size="sm" variant="secondary" onClick={handleGenerate}>
            <Plus size={14} /> 随机生成
          </Button>
        </div>

        <div
          className="relative border-2 border-dashed border-white/10 rounded-lg transition-colors"
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('border-primary-500', 'bg-primary-500/5')
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('border-primary-500', 'bg-primary-500/5')
          }}
          onDrop={async (e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('border-primary-500', 'bg-primary-500/5')
            
            const file = e.dataTransfer.files[0]
            if (file) {
              try {
                const text = await file.text()
                setImportText(text.trim())
                logSuccess(`已导入文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
                toast.success(`已导入文件: ${file.name}`)
              } catch (err) {
                logError('文件读取失败')
                toast.error('文件读取失败')
              }
            }
          }}
        >
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`输入私钥或助记词自动识别...

支持格式：
• 单个私钥：0xabc123...
• 多个私钥：每行一个
• 助记词：word1 word2 word3 ... word12

或拖入 .txt / .csv 文件`}
            rows={6}
            className="w-full bg-transparent border-0 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none resize-none"
          />
          
          {/* 拖拽提示 */}
          {!importText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-gray-600 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                拖入文件或手动输入
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-gray-500">
            支持自动识别私钥和助记词，助记词默认派生5个钱包
          </div>
          <Button onClick={handleSmartImport} disabled={!importText.trim()}>
            导入钱包
          </Button>
        </div>
      </Card>

      {/* 钱包列表 */}
      {filteredWallets.length > 0 && (
        <Card className="p-0">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="font-medium">
              ⟠ EVM 钱包 ({filteredWallets.length})
            </span>
          </div>

          {/* 按组显示 */}
          <div className="divide-y divide-white/5">
            {Object.entries(
              filteredWallets.reduce((groups, wallet) => {
                const key = wallet.groupId
                if (!groups[key]) groups[key] = []
                groups[key].push(wallet)
                return groups
              }, {} as Record<string, typeof filteredWallets>)
            ).map(([groupId, groupWallets]) => {
              const firstWallet = groupWallets[0]
              const isGenerated = firstWallet.source === 'generated'
              return (
                <div key={groupId} className={`${isGenerated ? 'bg-primary-500/5' : 'bg-green-500/5'}`}>
                  {/* 组标题 */}
                  <div className={`px-4 py-2 text-xs font-medium flex items-center gap-2 ${isGenerated ? 'text-primary-400 border-l-2 border-primary-500' : 'text-green-400 border-l-2 border-green-500'}`}>
                    <span>{isGenerated ? '🎲 生成' : '📥 导入'}</span>
                    <span className="text-gray-500">第 {firstWallet.groupIndex} 批 · {groupWallets.length} 个钱包</span>
                  </div>

                  {/* 钱包列表 */}
                  <Table headers={['名称', '地址', `余额 (${currentChain.symbol})`, '操作']}>
                    {groupWallets.map((w, index) => (
                      <tr key={w.id} className="hover:bg-surface-100/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{w.name}</td>
                        <td className="px-4 py-3 font-mono text-sm">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] ${isGenerated ? 'text-primary-400' : 'text-green-400'}`}>
                              {isGenerated ? 'generated' : 'imported'} {w.groupIndex}-{index + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <span>{truncateAddress(w.address)}</span>
                              <button onClick={() => copy(w.address)} className="text-gray-500 hover:text-primary-400">
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">{parseFloat(w.balance).toFixed(6)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedWallet(w)}
                              className="p-1.5 rounded-lg hover:bg-primary-500/20 text-gray-500 hover:text-primary-400"
                              title="查看详情"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              onClick={() => setShowKeys((p) => ({ ...p, [w.id]: !p[w.id] }))}
                              className="p-1.5 rounded-lg hover:bg-surface-100 text-gray-500 hover:text-gray-300"
                              title="显示私钥"
                            >
                              {showKeys[w.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            {showKeys[w.id] && (
                              <button
                                onClick={() => copy(w.privateKey)}
                                className="p-1.5 rounded-lg hover:bg-surface-100 text-gray-500 hover:text-gray-300"
                                title="复制私钥"
                              >
                                <Copy size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => removeWallet(w.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )
            })}
          </div>

          {/* 私钥展示区 */}
          {Object.keys(showKeys).some((k) => showKeys[k]) && (
            <div className="p-4 border-t border-white/5">
              <div className="text-xs text-yellow-400 mb-2">⚠️ 请勿泄露私钥</div>
              <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-xs text-gray-400">
                {filteredWallets
                  .filter((w) => showKeys[w.id])
                  .map((w) => (
                    <div key={w.id}>
                      {w.name}: {w.privateKey}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 生成钱包弹窗 */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm mx-4 animate-fade-in">
            <h3 className="text-lg font-semibold mb-4">生成随机钱包</h3>

            <div className="space-y-4">
              <Input
                label="生成数量"
                value={generateCount}
                onChange={(v) => {
                  const num = parseInt(v) || 1
                  setGenerateCount(String(Math.min(Math.max(num, 1), 10000)))
                }}
                placeholder="1"
              />
              <div className="text-xs text-gray-500">
                最小 1 个，最大 10000 个
              </div>

              {/* 快捷数量按钮 */}
              <div className="flex gap-2 flex-wrap">
                {[1, 5, 10, 50, 100, 500].map((n) => (
                  <button
                    key={n}
                    onClick={() => setGenerateCount(String(n))}
                    className={`px-3 py-1 rounded text-sm ${
                      generateCount === String(n)
                        ? 'bg-primary-600 text-white'
                        : 'bg-surface-100 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowGenerateModal(false)
                  setGenerateCount('1')
                }}
              >
                取消
              </Button>
              <Button className="flex-1" onClick={confirmGenerate}>
                确认生成
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 钱包详情弹窗 */}
      {selectedWallet && (
        <WalletDetailModal
          wallet={selectedWallet}
          onClose={() => setSelectedWallet(null)}
        />
      )}
    </div>
  )
}
