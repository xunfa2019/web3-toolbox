import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { Card, Button, Input, Textarea, Table, Badge, Select } from '@/components/ui'
import { log, logSuccess, logError } from '@/utils/logger'
import { callContractRead, callContractWrite } from '@/utils/web3'
import { FileCode, Play, Trash2, Plus, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuid } from 'uuid'

interface MethodParam {
  name: string
  type: string
  value: string
}

export function Contract() {
  const { wallets, currentChain, contractCalls, setContractCalls, updateContractCall, clearContractCalls } = useStore()

  const [contractAddress, setContractAddress] = useState('')
  const [abiText, setAbiText] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [methods, setMethods] = useState<string[]>([])
  const [params, setParams] = useState<MethodParam[]>([])
  const [value, setValue] = useState('0')
  const [selectedWallets, setSelectedWallets] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  // 解析 ABI
  const parseABI = () => {
    try {
      const abi = JSON.parse(abiText)
      const writeMethods = abi
        .filter((item: any) => item.type === 'function' && (item.stateMutability === 'nonpayable' || item.stateMutability === 'payable'))
        .map((item: any) => item.name)
      const allMethods = abi
        .filter((item: any) => item.type === 'function')
        .map((item: any) => `${item.name} (${item.stateMutability})`)
      setMethods(allMethods)
      logSuccess(`解析 ABI 成功: ${writeMethods.length} 个写方法, ${allMethods.length} 个总方法`)
      toast.success(`解析成功: ${writeMethods.length} 个写方法, ${allMethods.length} 个总方法`)
    } catch {
      logError('ABI 解析失败: JSON 格式错误')
      toast.error('ABI 格式错误')
    }
  }

  // 选择方法时加载参数
  const selectMethod = (methodStr: string) => {
    setSelectedMethod(methodStr)
    try {
      const abi = JSON.parse(abiText)
      const methodName = methodStr.split(' (')[0]
      const method = abi.find((item: any) => item.type === 'function' && item.name === methodName)
      if (method) {
        setParams(
          method.inputs.map((input: any) => ({
            name: input.name,
            type: input.type,
            value: '',
          }))
        )
      }
    } catch { /* ignore */ }
  }

  // 构建调用
  const buildCalls = () => {
    if (!contractAddress) return toast.error('请输入合约地址')
    if (!selectedMethod) return toast.error('请选择方法')
    if (!selectedWallets.length) return toast.error('请选择钱包')

    const methodName = selectedMethod.split(' (')[0]
    const paramValues = params.map((p) => p.value)

    const calls = selectedWallets.map((walletId) => ({
      id: uuid(),
      walletId,
      contractAddress,
      method: methodName,
      params: paramValues,
      value,
      abi: abiText,
      status: 'pending' as const,
    }))

    setContractCalls(calls)
    logSuccess(`构建 ${calls.length} 条合约调用: ${methodName}`)
    toast.success(`已构建 ${calls.length} 条调用`)
  }

  // 真实执行合约调用
  const executeCalls = async () => {
    if (!contractCalls.length) return toast.error('请先构建调用')
    setRunning(true)
    const startTime = Date.now()
    log(`开始执行 ${contractCalls.length} 条合约调用...`)

    // 记录执行日志
    const executionLogs: string[] = []
    executionLogs.push(`=== Web3 工具箱 - 合约交互执行日志 ===`)
    executionLogs.push(`开始时间: ${new Date().toLocaleString('zh-CN')}`)
    executionLogs.push(`网络: ${currentChain.name} (${currentChain.symbol})`)
    executionLogs.push(`合约地址: ${contractAddress}`)
    executionLogs.push(`调用方法: ${selectedMethod}`)
    executionLogs.push(`调用数量: ${contractCalls.length}`)
    executionLogs.push('')

    const methodName = selectedMethod.split(' (')[0]
    const isWriteMethod = selectedMethod.includes('nonpayable') || selectedMethod.includes('payable')
    const abi = JSON.parse(abiText)
    const paramValues = params.map(p => p.value)

    for (const call of contractCalls) {
      if (!running) break
      const wallet = wallets.find((w) => w.id === call.walletId)
      if (!wallet) {
        logError(`钱包不存在: ${call.walletId}`)
        continue
      }

      log(`调用 ${methodName} (${wallet.name})...`)
      updateContractCall(call.id, { status: 'sending' })

      try {
        let result: any
        let txHash: string | undefined

        if (isWriteMethod) {
          // 写入方法
          txHash = await callContractWrite(
            wallet.privateKey,
            currentChain,
            contractAddress,
            abi,
            methodName,
            paramValues,
            value
          )
          result = txHash
          logSuccess(`调用成功: ${methodName} | Tx: ${txHash}`)
        } else {
          // 读取方法
          result = await callContractRead(
            currentChain,
            contractAddress,
            abi,
            methodName,
            paramValues
          )
          logSuccess(`调用成功: ${methodName} = ${JSON.stringify(result)}`)
        }

        updateContractCall(call.id, { status: 'success', txHash })
        const logEntry = `[${new Date().toLocaleTimeString('zh-CN')}] ✓ 成功 | ${wallet.name} | ${methodName} | Result: ${JSON.stringify(result)}`
        executionLogs.push(logEntry)
      } catch (error: any) {
        const errorMsg = error.message || '未知错误'
        updateContractCall(call.id, { status: 'failed', error: errorMsg })
        const logEntry = `[${new Date().toLocaleTimeString('zh-CN')}] ✗ 失败 | ${wallet.name} | ${methodName} | Error: ${errorMsg}`
        executionLogs.push(logEntry)
        logError(`调用失败: ${errorMsg}`)
      }

      // 每笔调用间隔
      await new Promise(r => setTimeout(r, 1000))
    }

    setRunning(false)

    // 统计结果
    const successCount = contractCalls.filter(c => c.status === 'success').length
    const failedCount = contractCalls.filter(c => c.status === 'failed').length
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    executionLogs.push('')
    executionLogs.push('=== 执行结果 ===')
    executionLogs.push(`成功: ${successCount}`)
    executionLogs.push(`失败: ${failedCount}`)
    executionLogs.push(`耗时: ${duration} 秒`)
    executionLogs.push(`结束时间: ${new Date().toLocaleString('zh-CN')}`)

    logSuccess(`所有合约调用执行完毕 (成功: ${successCount}, 失败: ${failedCount}, 耗时: ${duration}s)`)

    // 保存日志文档
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `contract-log-${timestamp}.txt`
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

  // 切换钱包选择
  const toggleWallet = (id: string) => {
    setSelectedWallets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    )
  }

  // 全选/全不选
  const selectAll = () => {
    setSelectedWallets(
      selectedWallets.length === wallets.length ? [] : wallets.map((w) => w.id)
    )
  }

  const statusColor = (s: string): 'gray' | 'yellow' | 'green' | 'red' => {
    const map: Record<string, 'gray' | 'yellow' | 'green' | 'red'> = {
      pending: 'gray', sending: 'yellow', success: 'green', failed: 'red',
    }
    return map[s] || 'gray'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">合约交互</h1>
        <Badge color={wallets.length ? 'green' : 'red'}>{wallets.length} 个钱包</Badge>
      </div>

      {!wallets.length && (
        <Card className="text-center py-8">
          <p className="text-gray-400">请先在「钱包管理」中导入钱包</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左：合约配置 */}
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileCode size={18} /> 合约配置
          </h2>

          <Input
            label="合约地址"
            value={contractAddress}
            onChange={setContractAddress}
            placeholder="0x..."
          />

          <Textarea
            label="ABI (JSON)"
            value={abiText}
            onChange={setAbiText}
            placeholder='[{"type":"function","name":"transfer",...}]'
            rows={6}
          />

          <Button onClick={parseABI} disabled={!abiText}>
            解析 ABI
          </Button>

          {methods.length > 0 && (
            <>
              <Select
                label="选择方法"
                value={selectedMethod}
                onChange={selectMethod}
                options={[
                  { value: '', label: '-- 选择方法 --' },
                  ...methods.map((m) => ({ value: m, label: m })),
                ]}
              />

              {params.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">参数</label>
                  {params.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-xs text-gray-500 w-20 truncate">{p.name || `arg${i}`}</span>
                      <span className="text-xs text-gray-600 w-16">{p.type}</span>
                      <input
                        value={p.value}
                        onChange={(e) => {
                          const newParams = [...params]
                          newParams[i] = { ...p, value: e.target.value }
                          setParams(newParams)
                        }}
                        placeholder={p.type}
                        className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 font-mono"
                      />
                    </div>
                  ))}
                </div>
              )}

              {selectedMethod.includes('payable') && (
                <Input
                  label={`发送 ${currentChain.symbol} 数量`}
                  value={value}
                  onChange={setValue}
                  placeholder="0"
                />
              )}
            </>
          )}
        </Card>

        {/* 右：钱包选择 */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">选择钱包</h2>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              {selectedWallets.length === wallets.length ? '全不选' : '全选'}
            </Button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {wallets.map((w) => (
              <label
                key={w.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedWallets.includes(w.id)
                    ? 'bg-primary-600/20 border border-primary-500/30'
                    : 'bg-dark-900/50 border border-transparent hover:bg-surface-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedWallets.includes(w.id)}
                  onChange={() => toggleWallet(w.id)}
                  className="accent-primary-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{w.name}</div>
                  <div className="text-xs text-gray-500 font-mono">
                    {w.address.slice(0, 10)}...{w.address.slice(-8)}
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {parseFloat(w.balance).toFixed(4)} {currentChain.symbol}
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={buildCalls} disabled={!contractAddress || !selectedMethod}>
              <Play size={16} /> 构建调用
            </Button>
            <Button
              variant="primary"
              onClick={executeCalls}
              disabled={!contractCalls.length || running}
            >
              <FileCode size={16} /> {running ? '执行中...' : '批量执行'}
            </Button>
          </div>
        </Card>
      </div>

      {/* 任务表 */}
      {contractCalls.length > 0 && (
        <Card className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h3 className="font-semibold">调用记录</h3>
            <Button variant="danger" size="sm" onClick={clearContractCalls}>
              <Trash2 size={14} /> 清空
            </Button>
          </div>
          <Table headers={['#', '钱包', '方法', '参数', '状态', 'Tx Hash', '错误']}>
            {contractCalls.map((c, i) => {
              const wallet = wallets.find((w) => w.id === c.walletId)
              return (
                <tr key={c.id} className="hover:bg-surface-100/50">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-sm">{wallet?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{c.method}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-48 truncate">
                    {c.params.join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.txHash || '-'}</td>
                  <td className="px-4 py-3 text-xs text-red-400">{c.error || '-'}</td>
                </tr>
              )
            })}
          </Table>
        </Card>
      )}
    </div>
  )
}
