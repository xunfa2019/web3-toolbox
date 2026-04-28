import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { Card, Button, Input, Textarea, Table, Badge } from '@/components/ui'
import { log, logSuccess, logError, logBatch, logWarn } from '@/utils/logger'
import { truncateAddress, sendNative, sendERC20, getERC20Info } from '@/utils/web3'
import { Send, Upload, Play, Trash2, ChevronDown, ChevronUp, Check, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Coins, Hexagon, Copy, RefreshCw } from 'lucide-react'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import { v4 as uuid } from 'uuid'
import clsx from 'clsx'

type TransferType = 'one-to-many' | 'many-to-one'
type TokenType = 'native' | 'erc20'

const transferTypes: { type: TransferType; label: string; icon: any; desc: string }[] = [
  { type: 'one-to-many', label: '一对多', icon: ArrowDownToLine, desc: '分发：从一个钱包转到多个地址' },
  { type: 'many-to-one', label: '多对一', icon: ArrowUpFromLine, desc: '归集：从多个钱包转到一个地址' },
]

const tokenTypes: { type: TokenType; label: string; icon: any }[] = [
  { type: 'native', label: '原生币', icon: Hexagon },
  { type: 'erc20', label: 'ERC20', icon: Coins },
]

interface TransferRow {
  id: string
  fromIndex: number
  toAddress: string
  amount: string
}

export function Transfer() {
  const { wallets, currentChain, transferTasks, setTransferTasks, updateTransferTask, clearTransferTasks, updateWalletBalance, isRunning, shouldStop, setRunning: setGlobalRunning, setShouldStop } = useStore()
  const [transferType, setTransferType] = useState<TransferType>('one-to-many')
  const [tokenType, setTokenType] = useState<TokenType>('native')
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('TOKEN')
  const [hexData, setHexData] = useState('')  // 自定义16进制数据
  const [typeCollapsed, setTypeCollapsed] = useState(false)
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0)

  // 一对多
  const [oneToManyRows, setOneToManyRows] = useState<TransferRow[]>([
    { id: uuid(), fromIndex: 0, toAddress: '', amount: '' },
  ])
  const [oneToManyCsvText, setOneToManyCsvText] = useState('')
  const [oneToManyMode, setOneToManyMode] = useState<'manual' | 'batch'>('manual')

  // 多对一
  const [manyToOneTarget, setManyToOneTarget] = useState('')
  const [manyToOneAmount, setManyToOneAmount] = useState('')
  const [manyToOneSelectedWallets, setManyToOneSelectedWallets] = useState<string[]>([])
  const [erc20Balances, setErc20Balances] = useState<Record<string, string>>({})
  const [showBalances, setShowBalances] = useState(false)
  const [recipientBalances, setRecipientBalances] = useState<Record<string, string>>({})
  const [senderErc20Balance, setSenderErc20Balance] = useState<string | null>(null)

  const [running, setRunning] = useState(false)
  
  // 同步全局状态
  useEffect(() => {
    setRunning(isRunning)
  }, [isRunning])
  const prevWalletCount = useRef(0)

  // 监听 ERC20 代币变化，自动查询余额
  useEffect(() => {
    if (tokenType === 'erc20' && tokenAddress && wallets.length > 0) {
      const fetchBalances = async () => {
        try {
          const ethersLib = await import('ethers')
          const provider = new ethersLib.JsonRpcProvider(currentChain.rpcUrl)
          const erc20Abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
          const contract = new ethersLib.Contract(tokenAddress, erc20Abi, provider)
          
          const decimals = await contract.decimals()
          const balances: Record<string, string> = {}
          
          for (const w of wallets) {
            const balance = await contract.balanceOf(w.address)
            balances[w.id] = ethersLib.formatUnits(balance, decimals)
          }
          
          setErc20Balances(balances)
          log(`已查询 ${wallets.length} 个钱包的 ${tokenSymbol} 余额`)
        } catch (error: any) {
          logError(`查询 ERC20 余额失败: ${error.message}`)
        }
      }
      fetchBalances()
    }
  }, [tokenType, tokenAddress, wallets.length, currentChain.id])

  // 监听钱包变化，自动填入表单
  useEffect(() => {
    const currentCount = wallets.length
    // 只在钱包数量变化时触发
    if (currentCount > 0 && currentCount !== prevWalletCount.current) {
      prevWalletCount.current = currentCount

      if (currentCount === 1) {
        // 单个钱包 - 自动填入发送钱包
        setOneToManyRows([{ id: uuid(), fromIndex: 0, toAddress: '', amount: '' }])
        setManyToOneTarget(wallets[0].address)
        setManyToOneSelectedWallets([])
        log(`已自动填入: 单钱包模式（发送钱包已选择）`)
      } else if (currentCount >= 2) {
        // 多个钱包 - 发送钱包需要手动选择，不自动填入
        // 所有钱包地址作为接收地址，发送钱包默认未选择
        const newRows = wallets.map((w, i) => ({
          id: uuid(),
          fromIndex: -1, // -1 表示未选择
          toAddress: w.address,
          amount: '',
        }))
        setOneToManyRows(newRows)
        
        // 多对一：选择数量最多的那一批钱包
        const groups = wallets.reduce((acc, w) => {
          if (!acc[w.groupId]) acc[w.groupId] = []
          acc[w.groupId].push(w.id)
          return acc
        }, {} as Record<string, string[]>)
        
        const largestGroup = Object.entries(groups).reduce((max, [groupId, ids]) => 
          ids.length > max.count ? { groupId, count: ids.length, ids } : max
        , { groupId: '', count: 0, ids: [] as string[] })
        
        setManyToOneSelectedWallets(largestGroup.ids)
        setManyToOneTarget('')
        log(`已自动填入: ${currentCount} 个接收地址，发送钱包请手动选择`)
      }
    }
  }, [wallets])

  // 获取当前代币符号
  const getCurrentSymbol = () => {
    return tokenType === 'native' ? currentChain.symbol : tokenSymbol
  }

  // 一对多：添加行
  const addOneToManyRow = () => {
    const newRow = { id: uuid(), fromIndex: -1, toAddress: '', amount: '' }
    setOneToManyRows((p) => [...p, newRow])
    setActiveRowIndex(oneToManyRows.length)
  }

  // 一对多：删除行
  const removeOneToManyRow = (id: string) => {
    setOneToManyRows((p) => {
      const newRows = p.filter((r) => r.id !== id)
      if (activeRowIndex >= newRows.length) {
        setActiveRowIndex(Math.max(0, newRows.length - 1))
      }
      return newRows
    })
  }

  // 一对多：更新行
  const updateOneToManyRow = (id: string, field: keyof TransferRow, value: string | number) => {
    setOneToManyRows((p) => p.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  // 点击钱包填入接收地址
  const fillAddressFromWallet = (address: string) => {
    if (transferType === 'one-to-many' && oneToManyRows.length > 0) {
      const activeRow = oneToManyRows[activeRowIndex]
      if (activeRow) {
        updateOneToManyRow(activeRow.id, 'toAddress', address)
        log(`填入接收地址: ${address.slice(0, 10)}...`)
        toast.success('已填入地址')
      }
    } else if (transferType === 'many-to-one') {
      setManyToOneTarget(address)
      log(`填入目标地址: ${address.slice(0, 10)}...`)
      toast.success('已填入目标地址')
    }
  }

  // 批量导入地址（支持 CSV、文本、粘贴）
  const importOneToManyCsv = () => {
    try {
      const text = oneToManyCsvText.trim()
      if (!text) {
        toast.error('请输入内容')
        return
      }

      const lines = text.split('\n').filter((l) => l.trim())
      const newRows: TransferRow[] = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // 智能识别格式
        // 格式1: 钱包序号,接收地址,金额
        // 格式2: 接收地址,金额
        // 格式3: 接收地址（每行一个）
        // 格式4: 0x开头的地址（空格或逗号分隔多个）

        if (trimmed.includes(',')) {
          // CSV 格式
          const parts = trimmed.split(',').map(s => s.trim())
          if (parts.length >= 3) {
            // 钱包序号,接收地址,金额
            newRows.push({
              id: uuid(),
              fromIndex: parseInt(parts[0]) || 0,
              toAddress: parts[1],
              amount: parts[2],
            })
          } else if (parts.length === 2) {
            // 接收地址,金额
            newRows.push({
              id: uuid(),
              fromIndex: 0,
              toAddress: parts[0],
              amount: parts[1],
            })
          } else if (parts.length === 1 && parts[0].startsWith('0x')) {
            // 单个地址
            newRows.push({
              id: uuid(),
              fromIndex: 0,
              toAddress: parts[0],
              amount: '',
            })
          }
        } else if (trimmed.includes(' ') && !trimmed.startsWith('0x')) {
          // 空格分隔（可能是助记词，跳过）
          continue
        } else if (trimmed.startsWith('0x')) {
          // 单个地址（每行一个）
          newRows.push({
            id: uuid(),
            fromIndex: 0,
            toAddress: trimmed,
            amount: '',
          })
        }
      }

      if (newRows.length === 0) {
        toast.error('未识别到有效地址')
        return
      }

      setOneToManyRows(newRows)
      logSuccess(`批量导入 ${newRows.length} 条转账记录`)
      toast.success(`导入 ${newRows.length} 条记录`)
    } catch (e: any) {
      logError('导入失败: 格式错误')
      toast.error('格式错误')
    }
  }

  // 多对一：切换钱包选择
  const toggleManyToOneWallet = (id: string) => {
    setManyToOneSelectedWallets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    )
  }

  // 多对一：全选/全不选
  const selectAllManyToOne = () => {
    setManyToOneSelectedWallets(
      manyToOneSelectedWallets.length === wallets.length ? [] : wallets.map((w) => w.id)
    )
  }

  // 构建任务
  const buildTasks = () => {
    if (!wallets.length) return toast.error('请先导入钱包')

    // ERC20 验证
    if (tokenType === 'erc20' && !tokenAddress) {
      return toast.error('请输入 ERC20 合约地址')
    }

    let tasks: any[] = []
    const symbol = getCurrentSymbol()

    if (transferType === 'one-to-many') {
      // 检查是否选择了发送钱包
      if (oneToManyRows[0]?.fromIndex < 0) {
        return toast.error('请先选择发送钱包')
      }
      // 检查是否填入了接收地址和金额
      const hasValidRows = oneToManyRows.some(r => r.toAddress && r.amount)
      if (!hasValidRows) {
        return toast.error('请填入接收地址和金额')
      }
      
      tasks = oneToManyRows
        .filter((r) => r.toAddress && r.amount)
        .map((r) => ({
          id: uuid(),
          fromWallet: wallets[r.fromIndex]?.id || '',
          toAddress: r.toAddress,
          amount: r.amount,
          status: 'pending' as const,
          tokenType,
          tokenAddress: tokenType === 'erc20' ? tokenAddress : undefined,
          tokenSymbol: symbol,
        }))
    } else {
      if (!manyToOneTarget) return toast.error('请输入目标地址')
      if (!manyToOneSelectedWallets.length) return toast.error('请选择钱包')

      tasks = manyToOneSelectedWallets.map((walletId) => ({
        id: uuid(),
        fromWallet: walletId,
        toAddress: manyToOneTarget,
        amount: manyToOneAmount || '0.01',
        status: 'pending' as const,
        tokenType,
        tokenAddress: tokenType === 'erc20' ? tokenAddress : undefined,
        tokenSymbol: symbol,
      }))
    }

    if (!tasks.length) return toast.error('请填写至少一条转账记录')

    setTransferTasks(tasks)
    const tokenInfo = tokenType === 'erc20' ? ` (${tokenSymbol})` : ''
    logSuccess(`构建 ${tasks.length} 条转账任务 (${transferType === 'one-to-many' ? '分发' : '归集'}${tokenInfo})`)
    toast.success(`已构建 ${tasks.length} 条转账任务`)
  }

  // 自转任务 - 只保留一个接收地址框，接收地址与发送钱包地址强制一致
  const handleSelfTransfer = () => {
    if (!wallets.length) return toast.error('请先导入钱包')
    if (tokenType === 'erc20' && !tokenAddress) {
      return toast.error('请输入 ERC20 合约地址')
    }

    // 如果还没有选择发送钱包，提示用户先选择
    if (oneToManyRows[0]?.fromIndex < 0) {
      toast.error('请先选择发送钱包')
      return
    }

    const selectedWallet = wallets[oneToManyRows[0].fromIndex]
    if (!selectedWallet) {
      toast.error('发送钱包无效')
      return
    }

    // 只保留一个接收地址框，接收地址与发送钱包地址一致
    setOneToManyRows([{
      id: uuid(),
      fromIndex: oneToManyRows[0].fromIndex,
      toAddress: selectedWallet.address,
      amount: oneToManyRows[0]?.amount || '0.001',
    }])

    log(`自转模式：${selectedWallet.name} → ${selectedWallet.address}`)
    toast.success('已设置自转模式')
  }

  // 真实执行转账
  const executeTransfers = async () => {
    if (!transferTasks.length) return toast.error('请先构建任务')
    setRunning(true)
    const symbol = getCurrentSymbol()
    const startTime = Date.now()
    log(`开始执行 ${transferTasks.length} 条转账任务 (${tokenType === 'erc20' ? 'ERC20' : '原生币'})...`)

    // 记录执行日志
    const executionLogs: string[] = []
    executionLogs.push(`=== Web3 工具箱 - 批量转账执行日志 ===`)
    executionLogs.push(`开始时间: ${new Date().toLocaleString('zh-CN')}`)
    executionLogs.push(`网络: ${currentChain.name} (${currentChain.symbol})`)
    executionLogs.push(`代币类型: ${tokenType === 'erc20' ? `ERC20 (${tokenSymbol})` : '原生币'}`)
    executionLogs.push(`任务数量: ${transferTasks.length}`)
    executionLogs.push('')

    for (const task of transferTasks) {
      if (!running) break
      const fromWallet = wallets.find(w => w.id === task.fromWallet)
      if (!fromWallet) {
        logError(`钱包不存在: ${task.fromWallet}`)
        continue
      }

      log(`发送 ${task.amount} ${symbol} → ${task.toAddress}...`)
      updateTransferTask(task.id, { status: 'sending' })

      try {
        let txHash: string
        if (tokenType === 'erc20' && tokenAddress) {
          // ERC20 转账
          txHash = await sendERC20(fromWallet.privateKey, tokenAddress, task.toAddress, task.amount, currentChain)
        } else {
          // 原生币转账
          txHash = await sendNative(fromWallet.privateKey, task.toAddress, task.amount, currentChain)
        }

        updateTransferTask(task.id, { status: 'success', txHash })
        const logEntry = `[${new Date().toLocaleTimeString('zh-CN')}] ✓ 成功 | ${fromWallet.name} → ${task.toAddress} | ${task.amount} ${symbol} | Tx: ${txHash}`
        executionLogs.push(logEntry)
        logSuccess(`转账成功: ${task.amount} ${symbol} → ${task.toAddress.slice(0, 10)}... | Tx: ${txHash}`)
      } catch (error: any) {
        const errorMsg = error.message || '未知错误'
        updateTransferTask(task.id, { status: 'failed', error: errorMsg })
        const logEntry = `[${new Date().toLocaleTimeString('zh-CN')}] ✗ 失败 | ${fromWallet.name} → ${task.toAddress} | ${task.amount} ${symbol} | Error: ${errorMsg}`
        executionLogs.push(logEntry)
        logError(`转账失败: ${errorMsg}`)
      }

      // 每笔交易间隔，避免 nonce 冲突
      await new Promise(r => setTimeout(r, 1000))
    }
    
    setRunning(false)
    
    // 统计结果
    const successCount = transferTasks.filter(t => t.status === 'success').length
    const failedCount = transferTasks.filter(t => t.status === 'failed').length
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    executionLogs.push('')
    executionLogs.push('=== 执行结果 ===')
    executionLogs.push(`成功: ${successCount}`)
    executionLogs.push(`失败: ${failedCount}`)
    executionLogs.push(`耗时: ${duration} 秒`)
    executionLogs.push(`结束时间: ${new Date().toLocaleString('zh-CN')}`)
    
    logSuccess(`所有转账任务执行完毕 (成功: ${successCount}, 失败: ${failedCount}, 耗时: ${duration}s)`)
    
    // 保存日志文档
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `transfer-log-${timestamp}.txt`
    const blob = new Blob([executionLogs.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    
    logSuccess(`执行日志已保存: ${fileName}`)
    log(`保存位置: 浏览器默认下载目录`)
  }

  const statusColor = (status: string) => {
    const map: Record<string, 'yellow' | 'green' | 'red' | 'gray'> = {
      pending: 'gray',
      sending: 'yellow',
      success: 'green',
      failed: 'red',
    }
    return map[status] || 'gray'
  }

  // 复制地址
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast.success('已复制')
  }

  // 按组分组钱包
  const groupedWallets = wallets.reduce((groups, wallet) => {
    const key = wallet.groupId
    if (!groups[key]) groups[key] = []
    groups[key].push(wallet)
    return groups
  }, {} as Record<string, typeof wallets>)

  // 组折叠状态
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">批量转账</h1>
      </div>

      {!wallets.length && (
        <Card className="text-center py-8">
          <p className="text-gray-400">请先在「钱包管理」中导入钱包</p>
        </Card>
      )}

      {/* 主内容区 */}
      {wallets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧：钱包列表 */}
          <div className="lg:col-span-1">
            <Card className="p-0 overflow-hidden">
              {/* 标题 */}
              <div className="px-4 py-3 bg-surface-200 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">钱包列表</span>
                    <button 
                    className="flex items-center gap-1 px-2 py-1 rounded bg-surface-100 hover:bg-primary-600/20 text-gray-400 hover:text-primary-400 transition-colors text-xs"
                    onClick={async () => {
                      const { refreshBalances: refresh } = await import('@/utils/web3')
                      await refresh(wallets, currentChain, (id, balance) => updateWalletBalance(id, balance))
                      
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
                    title="刷新余额"
                  >
                    <RefreshCw size={12} />
                    刷新余额
                  </button>
                </div>
                <Badge color="green">{wallets.length}</Badge>
              </div>

              {/* 分组列表 */}
              <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                {Object.entries(groupedWallets).map(([groupId, groupWallets]) => {
                  const firstWallet = groupWallets[0]
                  const isGenerated = firstWallet.source === 'generated'
                  const isCollapsed = collapsedGroups[groupId]

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
                            <button
                              key={w.id}
                              onClick={() => fillAddressFromWallet(w.address)}
                              className="w-full px-4 py-2.5 hover:bg-surface-100/50 transition-colors text-left"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white">{w.name}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs text-gray-500 font-mono">
                                      {truncateAddress(w.address)}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyAddress(w.address)
                                      }}
                                      className="text-gray-500 hover:text-primary-400 transition-colors"
                                      title="复制地址"
                                    >
                                      <Copy size={12} />
                                    </button>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <div className="text-xs text-gray-400 font-mono">
                                    {parseFloat(w.balance).toFixed(4)}
                                  </div>
                                  <div className="text-[10px] text-gray-600">{currentChain.symbol}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* 右侧：功能区 */}
          <div className="lg:col-span-3 space-y-4">
            {/* 选择转账类型和代币类型 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 转账类型 */}
              <Card className="py-3">
                <h2 className="text-sm font-medium text-gray-400 mb-2">转账类型</h2>
                <div className="grid grid-cols-2 gap-2">
                  {transferTypes.map(({ type, label, icon: Icon, desc }) => (
                    <button
                      key={type}
                      onClick={() => setTransferType(type)}
                      className={`p-2 rounded-lg border-2 transition-all text-left ${
                        transferType === type
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-white/5 bg-surface-100 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-primary-400" />
                        <div className="font-semibold text-white text-xs">{label}</div>
                        {transferType === type && <Check size={14} className="text-primary-400 ml-auto" />}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              {/* 代币类型 */}
              <Card className="py-3">
                <h2 className="text-sm font-medium text-gray-400 mb-2">代币类型</h2>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {tokenTypes.map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      onClick={() => setTokenType(type)}
                      className={`p-2 rounded-lg border-2 transition-all text-left ${
                        tokenType === type
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-white/5 bg-surface-100 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-primary-400" />
                        <div className="font-semibold text-white text-xs">{label}</div>
                        {tokenType === type && <Check size={14} className="text-primary-400 ml-auto" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* ERC20 合约地址输入 */}
                {tokenType === 'erc20' && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex gap-2">
                      <input
                        value={tokenAddress}
                        onChange={(e) => setTokenAddress(e.target.value)}
                        placeholder="ERC20 合约地址"
                        className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 font-mono"
                      />
                      <button
                        onClick={async () => {
                          if (!tokenAddress) return toast.error('请输入合约地址')
                          try {
                            log(`检查 ERC20 合约: ${tokenAddress}...`)
                            const info = await getERC20Info(tokenAddress, currentChain)
                            setTokenSymbol(info.symbol)
                            logSuccess(`检测到代币: ${info.name} (${info.symbol}), 精度: ${info.decimals}`)
                            toast.success(`检测到代币: ${info.symbol}`)
                            
                            // 查询选中发送钱包的ERC20余额
                            if (oneToManyRows[0]?.fromIndex >= 0) {
                              const selectedWallet = wallets[oneToManyRows[0].fromIndex]
                              if (selectedWallet) {
                                try {
                                  const ethersLib = await import('ethers')
                                  const provider = new ethersLib.JsonRpcProvider(currentChain.rpcUrl)
                                  const erc20Abi = ['function balanceOf(address) view returns (uint256)']
                                  const contract = new ethersLib.Contract(tokenAddress, erc20Abi, provider)
                                  const balance = await contract.balanceOf(selectedWallet.address)
                                  const formatted = ethersLib.formatUnits(balance, info.decimals)
                                  setSenderErc20Balance(formatted)
                                  log(`发送钱包 ${selectedWallet.name} 的 ${info.symbol} 余额: ${formatted}`)
                                } catch (e) {
                                  setSenderErc20Balance(null)
                                }
                              }
                            }
                          } catch (error: any) {
                            logError(`检查失败: ${error.message}`)
                            toast.error(`检查失败: ${error.message}`)
                          }
                        }}
                        className="px-2 py-1.5 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 rounded-lg text-xs transition-colors"
                      >
                        检查
                      </button>
                    </div>
                    <input
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      placeholder="代币符号"
                      className="w-full bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500"
                    />
                  </div>
                )}
              </Card>
            </div>

            {/* 一对多 */}
            {transferType === 'one-to-many' && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">分发设置</h2>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSelfTransfer} 
                      variant="secondary"
                      size="sm"
                    >
                      <RotateCcw size={14} className="mr-1" /> 自转
                    </Button>
                    <button
                      onClick={() => {
                        const hexData = prompt('请输入16进制数据（用于附加到转账的data字段）：')
                        if (hexData) {
                          // 验证是否为有效的16进制
                          const cleanHex = hexData.startsWith('0x') ? hexData.slice(2) : hexData
                          if (/^[0-9a-fA-F]*$/.test(cleanHex)) {
                            setHexData(hexData.startsWith('0x') ? hexData : `0x${hexData}`)
                            toast.success(`已填入16进制数据: 0x${cleanHex.slice(0, 20)}...`)
                            log(`已设置自定义16进制数据: 0x${cleanHex.slice(0, 40)}...`)
                          } else {
                            toast.error('无效的16进制数据')
                          }
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm bg-surface-100 text-gray-400 hover:bg-primary-500/20 hover:text-primary-400 transition-colors"
                    >
                      16进制
                    </button>
                    <button
                      onClick={() => setOneToManyMode('manual')}
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        oneToManyMode === 'manual' ? 'bg-primary-600 text-white' : 'bg-surface-100 text-gray-400'
                      }`}
                    >
                      手动输入
                    </button>
                    <button
                      onClick={() => setOneToManyMode('batch')}
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        oneToManyMode === 'batch' ? 'bg-primary-600 text-white' : 'bg-surface-100 text-gray-400'
                      }`}
                    >
                      批量导入
                    </button>
                  </div>
                </div>

                {oneToManyMode === 'manual' ? (
                  <div className="space-y-3">
                    {/* 统一发送钱包选择 */}
                    <div className="flex items-center gap-3 p-3 bg-surface-100 rounded-lg">
                      <label className="text-sm text-gray-400 shrink-0">发送钱包</label>
                      <div className="flex-1 relative">
                        <select
                          value={oneToManyRows[0]?.fromIndex ?? -1}
                          onChange={(e) => {
                            const idx = parseInt(e.target.value)
                            if (idx >= 0) {
                              setOneToManyRows(prev => prev.map(r => ({ ...r, fromIndex: idx })))
                              // 清除之前的 ERC20 余额显示
                              setSenderErc20Balance(null)
                            }
                          }}
                          className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-primary-500"
                        >
                          <option value={-1}>-- 请选择发送钱包 --</option>
                          {wallets.map((w, j) => (
                            <option key={w.id} value={j}>{w.name} ({w.address.slice(0, 8)}...{w.address.slice(-6)})</option>
                          ))}
                        </select>
                        {senderErc20Balance && tokenType === 'erc20' && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary-400 bg-primary-500/20 px-2 py-0.5 rounded">
                            余额: {parseFloat(senderErc20Balance).toFixed(4)} {tokenSymbol}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          if (!oneToManyRows[0] || oneToManyRows[0].fromIndex < 0) {
                            logError('请先选择发送钱包')
                            return
                          }
                          const selectedWallet = wallets[oneToManyRows[0].fromIndex]
                          if (!selectedWallet) return
                          
                          try {
                            const ethersLib = await import('ethers')
                            const provider = new ethersLib.JsonRpcProvider(currentChain.rpcUrl)
                            
                            log(`查询余额开始...`)
                            
                            // 查询每个接收地址的余额
                            const balances: Record<string, string> = {}
                            
                            if (tokenType === 'erc20' && tokenAddress) {
                              // 查询 ERC20 余额
                              const erc20Abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
                              const contract = new ethersLib.Contract(tokenAddress, erc20Abi, provider)
                              const decimals = await contract.decimals()
                              
                              for (const row of oneToManyRows) {
                                if (row.toAddress && ethers.isAddress(row.toAddress)) {
                                  try {
                                    const balance = await contract.balanceOf(row.toAddress)
                                    balances[row.toAddress] = ethersLib.formatUnits(balance, decimals)
                                  } catch {
                                    balances[row.toAddress] = '0'
                                  }
                                }
                              }
                              log(`已查询 ${Object.keys(balances).length} 个接收地址的 ${tokenSymbol} 余额`)
                            } else {
                              // 查询原生币余额
                              for (const row of oneToManyRows) {
                                if (row.toAddress && ethers.isAddress(row.toAddress)) {
                                  const balance = await provider.getBalance(row.toAddress)
                                  balances[row.toAddress] = ethersLib.formatEther(balance)
                                }
                              }
                              log(`已查询 ${Object.keys(balances).length} 个接收地址的 ${currentChain.symbol} 余额`)
                            }
                            
                            setRecipientBalances(balances)
                            logSuccess(`余额查询完成`)
                            setShowBalances(true)
                            toast.success('余额已刷新')
                          } catch (error: any) {
                            logError(`查询失败: ${error.message}`)
                          }
                        }}
                        className="px-2 py-2 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 rounded-lg text-xs transition-colors"
                        title="查询余额"
                      >
                        查询余额
                      </button>
                    </div>

                    {/* 接收地址列表 */}
                    <div className="grid grid-cols-12 gap-2 text-sm text-gray-500 px-1">
                      <div className="col-span-6">接收地址 (点击左侧钱包填入)</div>
                      <div className="col-span-4">金额 ({getCurrentSymbol()})</div>
                      <div className="col-span-2"></div>
                    </div>

                    <div 
                      className="space-y-2 overflow-y-auto pr-1"
                      style={{ 
                        maxHeight: oneToManyRows.length > 5 ? '250px' : 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(255,255,255,0.1) transparent'
                      }}
                    >
                      {oneToManyRows.map((row, index) => (
                        <div
                          key={row.id}
                          className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg transition-colors ${
                            activeRowIndex === index ? 'bg-primary-500/5 ring-1 ring-primary-500/30' : ''
                          }`}
                          onClick={() => setActiveRowIndex(index)}
                        >
                          <input
                            value={row.toAddress}
                            onChange={(e) => {
                              updateOneToManyRow(row.id, 'toAddress', e.target.value)
                              setActiveRowIndex(index)
                            }}
                            onFocus={() => setActiveRowIndex(index)}
                            placeholder="点击左侧钱包填入"
                            className="col-span-6 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 font-mono"
                          />
                          <input
                            value={row.amount}
                            onChange={(e) => {
                              const newAmount = e.target.value
                              updateOneToManyRow(row.id, 'amount', newAmount)
                              // 如果是第一行，同步到其他所有行
                              if (index === 0 && oneToManyRows.length > 1) {
                                setOneToManyRows(prev => prev.map((r, i) => 
                                  i === 0 ? r : { ...r, amount: newAmount }
                                ))
                                log(`一对多转账 - 修改金额: ${newAmount} ${getCurrentSymbol()} → 已同步到 ${oneToManyRows.length - 1} 个接收地址`)
                              }
                            }}
                            placeholder="0.01"
                            className="col-span-4 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 font-mono"
                          />
                          <div className="col-span-2 flex items-center justify-center gap-1">
                            {/* 状态指示器 */}
                            {isRunning && transferTasks[index] && (
                              <>
                                {transferTasks[index].status === 'sending' && (
                                  <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                )}
                                {transferTasks[index].status === 'success' && (
                                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                                {transferTasks[index].status === 'failed' && (
                                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </div>
                                )}
                                {transferTasks[index].status === 'pending' && (
                                  <div className="w-5 h-5 rounded-full bg-gray-500/20 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                                  </div>
                                )}
                              </>
                            )}
                            {!isRunning && (
                              <>
                                {/* 余额显示 - 查询后才显示接收地址余额 */}
                                {showBalances && recipientBalances[row.toAddress] && (
                                  <div className="text-[10px] text-gray-500 font-mono text-right">
                                    {parseFloat(recipientBalances[row.toAddress]).toFixed(4)} {tokenType === 'erc20' ? tokenSymbol : currentChain.symbol}
                                  </div>
                                )}
                                {oneToManyRows.length > 1 && (
                                  <Button variant="danger" size="sm" onClick={() => removeOneToManyRow(row.id)}>✕</Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button variant="ghost" size="sm" onClick={addOneToManyRow}>+ 添加一行</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      label="批量导入地址"
                      value={oneToManyCsvText}
                      onChange={setOneToManyCsvText}
                      placeholder={`支持以下格式：

格式1 - CSV（钱包序号,地址,金额）：
0,0xABC...,0.01
1,0xDEF...,0.02

格式2 - CSV（地址,金额）：
0xABC...,0.01
0xDEF...,0.02

格式3 - 纯地址（每行一个）：
0xABC...
0xDEF...

直接粘贴即可自动识别`}
                      rows={8}
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        支持 CSV、文本格式，自动识别
                      </div>
                      <Button onClick={importOneToManyCsv}>
                        解析导入
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex justify-center">
                    <Button 
                      onClick={async () => {
                        // 构建任务并直接执行
                        if (!wallets.length) return toast.error('请先导入钱包')
                        if (tokenType === 'erc20' && !tokenAddress) {
                          return toast.error('请输入 ERC20 合约地址')
                        }
                        
                        const symbol = getCurrentSymbol()
                        const tasks = oneToManyRows
                          .filter((r) => r.toAddress && ethers.isAddress(r.toAddress))
                          .map((r) => ({
                            id: uuid(),
                            fromWallet: wallets[r.fromIndex]?.id || '',
                            toAddress: r.toAddress,
                            amount: r.amount || '0',
                            status: 'pending' as const,
                            tokenType,
                            tokenAddress: tokenType === 'erc20' ? tokenAddress : undefined,
                            tokenSymbol: symbol,
                          }))

                        if (!tasks.length) return toast.error('请填写至少一条有效的接收地址')
                        
                        // 检查金额是否为0
                        const hasZeroAmount = tasks.some(t => !t.amount || parseFloat(t.amount) === 0)
                        if (hasZeroAmount) {
                          const confirmed = window.confirm(
                            `⚠️ 检测到金额为 0 的转账记录\n\n` +
                            `共 ${tasks.length} 笔交易，其中 ${tasks.filter(t => !t.amount || parseFloat(t.amount) === 0).length} 笔金额为 0\n\n` +
                            `确定要继续执行吗？`
                          )
                          if (!confirmed) return
                        }
                        
                        setTransferTasks(tasks)
                        logSuccess(`构建 ${tasks.length} 条转账任务`)
                        
                        // 直接执行
                        setGlobalRunning(true)
                        setShouldStop(false)
                        const startTime = Date.now()
                        log(`[批量转账] 开始执行 ${tasks.length} 笔交易 | 网络: ${currentChain.name} (${currentChain.symbol})`)
                        log(`[批量转账] 总计: ${tasks.length} 笔 | 预计耗时: ${tasks.length * 1.5}s`)
                        
                        let successCount = 0
                        let failCount = 0
                        
                        for (let i = 0; i < tasks.length; i++) {
                          // 检查是否被强制停止
                          if (useStore.getState().shouldStop) {
                            logWarn(`[批量转账] 任务被中断 | 已执行: ${i}/${tasks.length}`)
                            break
                          }
                          
                          const task = tasks[i]
                          const fromWallet = wallets.find(w => w.id === task.fromWallet)
                          if (!fromWallet) continue
                          
                          const progress = `[${i + 1}/${tasks.length}]`
                          const percent = Math.round(((i + 1) / tasks.length) * 100)
                          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                          const speed = ((i + 1) / parseFloat(elapsed)).toFixed(2)
                          const eta = tasks.length > i + 1 ? Math.round((tasks.length - i - 1) / parseFloat(speed)) : 0
                          
                          logBatch(`${progress} (${percent}%) 打包交易... | 耗时: ${elapsed}s | 速度: ${speed}笔/s | ETA: ${eta}s`)
                          updateTransferTask(task.id, { status: 'sending' })
                          
                          try {
                            logBatch(`${progress} (${percent}%) 等待签名...`)
                            let txHash: string
                            if (tokenType === 'erc20' && tokenAddress) {
                              const tx = await sendERC20(fromWallet.privateKey, tokenAddress, task.toAddress, task.amount, currentChain)
                              txHash = tx
                              logBatch(`${progress} (${percent}%) 等待上链确认...`)
                              const ethersLib = await import('ethers')
                              const provider = new ethersLib.JsonRpcProvider(currentChain.rpcUrl)
                              await provider.waitForTransaction(txHash)
                            } else {
                              const ethersLib = await import('ethers')
                              const provider = new ethersLib.JsonRpcProvider(currentChain.rpcUrl)
                              const wallet = new ethersLib.Wallet(fromWallet.privateKey, provider)
                              const txParams: any = {
                                to: task.toAddress,
                                value: ethersLib.parseEther(task.amount)
                              }
                              // 如果有自定义16进制数据，添加到交易参数中
                              if (hexData) {
                                txParams.data = hexData
                              }
                              const tx = await wallet.sendTransaction(txParams)
                              txHash = tx.hash
                              logBatch(`${progress} (${percent}%) 等待上链确认...`)
                              await tx.wait()
                            }
                            
                            logBatch(`${progress} (${percent}%) ✓ 已上链确认 | ${task.amount} ${symbol} → ${task.toAddress} | Tx: ${txHash}`, undefined, [
                              { text: txHash, url: `${currentChain.explorer}/tx/${txHash}`, type: 'tx' },
                              { text: task.toAddress, url: `${currentChain.explorer}/address/${task.toAddress}`, type: 'address' }
                            ])
                            updateTransferTask(task.id, { status: 'success', txHash })
                            successCount++
                          } catch (error: any) {
                            logError(`${progress} (${percent}%) ✗ 执行失败 | ${error.message.slice(0, 40)}`)
                            updateTransferTask(task.id, { status: 'failed', error: error.message })
                            failCount++
                          }
                          // 等待下一笔
                          await new Promise(r => setTimeout(r, 1000))
                        }
                        
                        setGlobalRunning(false)
                        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
                        logSuccess(`[批量转账] ========== 执行完成 ==========`)
                        logSuccess(`[批量转账] 成功: ${successCount} | 失败: ${failCount} | 总计: ${tasks.length}`)
                        logSuccess(`[批量转账] 总耗时: ${duration}s | 平均速度: ${(tasks.length / parseFloat(duration)).toFixed(2)}笔/s`)
                        logSuccess(`[批量转账] 网络: ${currentChain.name} (${currentChain.symbol})`)
                      }} 
                      disabled={running}
                      className="px-8 py-3 text-base"
                    >
                      <Send size={18} className="mr-2" /> {running ? '执行中...' : '执行转账'}
                    </Button>
                  </div>
                  <div className="text-center mt-3 text-sm text-gray-400">
                    有效接收地址: <span className="text-primary-400 font-semibold">{oneToManyRows.filter(r => r.toAddress && ethers.isAddress(r.toAddress)).length}</span> 个
                  </div>
                </div>
              </Card>
            )}

            {/* 多对一 */}
            {transferType === 'many-to-one' && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">归集设置</h2>
                  <button
                    onClick={() => {
                      setManyToOneTarget('')
                      setManyToOneSelectedWallets([])
                      toast.success('已清空归集设置')
                      log('已清空归集设置中的目标地址和钱包选择')
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm bg-surface-100 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    清空
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-[2]">
                      <Input
                        label="目标地址"
                        value={manyToOneTarget}
                        onChange={setManyToOneTarget}
                        placeholder="点击左侧钱包填入"
                      />
                    </div>
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1">
                        <Input
                          label={`金额 (${getCurrentSymbol()})`}
                          value={manyToOneAmount}
                          onChange={setManyToOneAmount}
                          placeholder="0.01"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!manyToOneSelectedWallets.length) {
                            toast.error('请先选择钱包')
                            return
                          }
                          try {
                            const ethersLib = await import('ethers')
                            const provider = new ethersLib.JsonRpcProvider(currentChain.rpcUrl)
                            
                            log(`正在计算 MAX 金额...`)
                            
                            let maxBalance = 0n
                            let maxWalletAddr = ''
                            
                            if (tokenType === 'native') {
                              // 原生币：扣除gas费计算最大可转账金额
                              const gasPrice = (await provider.getFeeData()).gasPrice || 0n
                              const gasCost = gasPrice * 21000n
                              
                              for (const walletId of manyToOneSelectedWallets) {
                                const w = wallets.find(w => w.id === walletId)
                                if (w) {
                                  const balance = await provider.getBalance(w.address)
                                  const sendable = balance - gasCost
                                  if (sendable > 0n && sendable > maxBalance) {
                                    maxBalance = sendable
                                    maxWalletAddr = w.address
                                  }
                                }
                              }
                              
                              if (maxBalance > 0n) {
                                const maxAmount = ethersLib.formatEther(maxBalance)
                                setManyToOneAmount(maxAmount)
                                log(`MAX: ${maxAmount} ${currentChain.symbol} (已扣除 gas: ${ethersLib.formatEther(gasCost)} ${currentChain.symbol})`)
                                toast.success(`已设置最大金额: ${maxAmount}`)
                              } else {
                                toast.error('钱包余额不足以支付 gas')
                                logError('MAX 计算失败: 余额不足')
                              }
                            } else if (tokenType === 'erc20' && tokenAddress) {
                              // ERC20代币：直接使用余额，不扣除gas
                              const erc20Abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
                              const contract = new ethersLib.Contract(tokenAddress, erc20Abi, provider)
                              
                              for (const walletId of manyToOneSelectedWallets) {
                                const w = wallets.find(w => w.id === walletId)
                                if (w) {
                                  try {
                                    const balance = await contract.balanceOf(w.address)
                                    if (balance > maxBalance) {
                                      maxBalance = balance
                                      maxWalletAddr = w.address
                                    }
                                  } catch (e) {
                                    // 继续查询其他钱包
                                  }
                                }
                              }
                              
                              if (maxBalance > 0n) {
                                const decimals = await contract.decimals()
                                const maxAmount = ethersLib.formatUnits(maxBalance, decimals)
                                setManyToOneAmount(maxAmount)
                                log(`MAX: ${maxAmount} ${tokenSymbol} (来自 ${maxWalletAddr.slice(0, 10)}...)`)
                                toast.success(`已设置最大金额: ${maxAmount}`)
                              } else {
                                toast.error('所有钱包 ERC20 余额为 0')
                                logError('MAX 计算失败: ERC20 余额为 0')
                              }
                            } else if (tokenType === 'erc20' && !tokenAddress) {
                              toast.error('请先输入 ERC20 合约地址')
                            }
                          } catch (error: any) {
                            logError(`MAX 计算失败: ${error.message}`)
                            toast.error('计算失败: ' + error.message)
                          }
                        }}
                        className="mt-6 px-3 py-2 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 rounded-lg text-sm font-semibold transition-colors"
                        title={tokenType === 'native' ? '最大可转金额（扣除 gas）' : '最大余额'}
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">选择发送钱包</label>
                        {manyToOneSelectedWallets.length > 0 && (
                          <span className="text-xs text-primary-400 bg-primary-500/20 px-2 py-0.5 rounded">
                            已选 {manyToOneSelectedWallets.length}/{wallets.length}
                          </span>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={selectAllManyToOne}
                      >
                        {manyToOneSelectedWallets.length === wallets.length ? '取消全选' : '全选'}
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {wallets.map((w) => (
                        <label
                          key={w.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            manyToOneSelectedWallets.includes(w.id)
                              ? 'bg-primary-600/20 border border-primary-500/30'
                              : 'bg-dark-900/50 border border-transparent hover:bg-surface-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={manyToOneSelectedWallets.includes(w.id)}
                            onChange={() => toggleManyToOneWallet(w.id)}
                            className="accent-primary-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{w.name}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {w.address.slice(0, 10)}...{w.address.slice(-8)}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {tokenType === 'erc20' && erc20Balances[w.id] 
                              ? `${parseFloat(erc20Balances[w.id]).toFixed(4)} ${tokenSymbol}`
                              : `${parseFloat(w.balance).toFixed(4)} ${currentChain.symbol}`
                            }
                          </div>
                          {/* 状态指示器 */}
                          {isRunning && (
                            <div className="ml-2 shrink-0">
                              {(() => {
                                const taskIndex = wallets.findIndex(wallet => wallet.id === w.id)
                                const task = transferTasks[taskIndex]
                                if (!task) return null
                                
                                if (task.status === 'sending') {
                                  return <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                }
                                if (task.status === 'success') {
                                  return (
                                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )
                                }
                                if (task.status === 'failed') {
                                  return (
                                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </div>
                                  )
                                }
                                return (
                                  <div className="w-5 h-5 rounded-full bg-gray-500/20 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                  <Button onClick={async () => {
                    // 构建任务并直接执行
                    if (!wallets.length) return toast.error('请先导入钱包')
                    if (!manyToOneTarget) return toast.error('请输入目标地址')
                    if (!manyToOneSelectedWallets.length) return toast.error('请选择钱包')
                    
                    const symbol = getCurrentSymbol()
                    const amount = manyToOneAmount || '0'
                    
                    // 检查金额是否为0
                    if (!manyToOneAmount || parseFloat(manyToOneAmount) === 0) {
                      const confirmed = window.confirm(
                        `⚠️ 转账金额为 0\n\n` +
                        `将从 ${manyToOneSelectedWallets.length} 个钱包归集到目标地址\n` +
                        `金额: 0 ${symbol}\n\n` +
                        `确定要继续执行吗？`
                      )
                      if (!confirmed) return
                    }
                    
                    const tasks = manyToOneSelectedWallets.map((walletId) => ({
                      id: uuid(),
                      fromWallet: walletId,
                      toAddress: manyToOneTarget,
                      amount,
                      status: 'pending' as const,
                      tokenType,
                      tokenAddress: tokenType === 'erc20' ? tokenAddress : undefined,
                      tokenSymbol: symbol,
                    }))
                    
                    setTransferTasks(tasks)
                    logSuccess(`构建 ${tasks.length} 条归集任务`)
                    
                    // 直接执行
                    setGlobalRunning(true)
                    setShouldStop(false)
                    const startTime = Date.now()
                    let successCount = 0
                    let failCount = 0
                    log(`[批量归集] 开始执行 ${tasks.length} 笔归集 | 网络: ${currentChain.name} (${currentChain.symbol})`)
                    log(`[批量归集] 总计: ${tasks.length} 笔 | 预计耗时: ${tasks.length * 1.5}s`)
                    
                    for (let i = 0; i < tasks.length; i++) {
                      // 检查是否被强制停止
                      if (useStore.getState().shouldStop) {
                        logWarn(`[批量归集] 任务被中断 | 已执行: ${i}/${tasks.length}`)
                        break
                      }
                      
                      const task = tasks[i]
                      const fromWallet = wallets.find(w => w.id === task.fromWallet)
                      if (!fromWallet) continue
                      
                      const progress = `[${i + 1}/${tasks.length}]`
                      const percent = Math.round(((i + 1) / tasks.length) * 100)
                      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                      const speed = ((i + 1) / parseFloat(elapsed)).toFixed(2)
                      const eta = tasks.length > i + 1 ? Math.round((tasks.length - i - 1) / parseFloat(speed)) : 0
                      
                      logBatch(`${progress} (${percent}%) 打包归集... | 耗时: ${elapsed}s | 速度: ${speed}笔/s | ETA: ${eta}s`)
                      updateTransferTask(task.id, { status: 'sending' })
                      
                      try {
                        logBatch(`${progress} (${percent}%) 等待签名...`)
                        let txHash: string
                        if (tokenType === 'erc20' && tokenAddress) {
                          const tx = await sendERC20(fromWallet.privateKey, tokenAddress, task.toAddress, task.amount, currentChain)
                          txHash = tx
                          logBatch(`${progress} (${percent}%) 等待上链确认...`)
                          // 等待交易确认
                          const ethersLib = await import('ethers')
                          const provider = new ethersLib.JsonRpcProvider(currentChain.rpcUrl)
                          await provider.waitForTransaction(txHash)
                        } else {
                          const ethersLib = await import('ethers')
                          const provider = new ethersLib.JsonRpcProvider(currentChain.rpcUrl)
                          const wallet = new ethersLib.Wallet(fromWallet.privateKey, provider)
                          const txParams: any = {
                            to: task.toAddress,
                            value: ethersLib.parseEther(task.amount)
                          }
                          // 如果有自定义16进制数据，添加到交易参数中
                          if (hexData) {
                            txParams.data = hexData
                          }
                          const tx = await wallet.sendTransaction(txParams)
                          txHash = tx.hash
                          logBatch(`${progress} (${percent}%) 等待上链确认...`)
                          // 等待交易确认
                          await tx.wait()
                        }
                        
                        logBatch(`${progress} (${percent}%) ✓ 已上链确认 | ${fromWallet.name} → ${task.amount} ${symbol} | Tx: ${txHash}`, undefined, [
                          { text: txHash, url: `${currentChain.explorer}/tx/${txHash}`, type: 'tx' },
                          { text: fromWallet.address, url: `${currentChain.explorer}/address/${fromWallet.address}`, type: 'address' }
                        ])
                        updateTransferTask(task.id, { status: 'success', txHash })
                        successCount++
                      } catch (error: any) {
                        logError(`${progress} (${percent}%) ✗ 执行失败 | ${error.message.slice(0, 40)}`)
                        updateTransferTask(task.id, { status: 'failed', error: error.message })
                        failCount++
                      }
                      // 等待下一笔
                      await new Promise(r => setTimeout(r, 1000))
                    }
                    
                    setGlobalRunning(false)
                    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
                    logSuccess(`[批量归集] ========== 执行完成 ==========`)
                    logSuccess(`[批量归集] 成功: ${successCount} | 失败: ${failCount} | 总计: ${tasks.length}`)
                    logSuccess(`[批量归集] 总耗时: ${duration}s | 平均速度: ${(tasks.length / parseFloat(duration)).toFixed(2)}笔/s`)
                    logSuccess(`[批量归集] 网络: ${currentChain.name} (${currentChain.symbol})`)
                  }} disabled={running}>
                    <Send size={16} /> {running ? '执行中...' : '执行归集'}
                  </Button>
                  <div className="text-sm text-gray-400">
                    已选钱包: <span className="text-primary-400 font-semibold">{manyToOneSelectedWallets.length}</span> 个
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
