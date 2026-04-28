import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { Card, Button, Input } from '@/components/ui'
import { log, logSuccess, logError } from '@/utils/logger'
import { truncateAddress } from '@/utils/web3'
import { 
  Wallet, Copy, ExternalLink, RefreshCw, Check, X,
  Coins, Hash, Users, Clock, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ethers } from 'ethers'

// 扩展 Window 接口
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (...args: any[]) => void) => void
      removeListener: (event: string, callback: (...args: any[]) => void) => void
    }
  }
}

// Sepolia 测试网配置
const SEPOLIA_CONFIG = {
  chainId: 11155111,
  chainName: 'Sepolia Testnet',
  rpcUrl: 'https://eth-sepolia.api.onfinality.io/public',
  symbol: 'ETH',
  explorer: 'https://sepolia.etherscan.io'
}

// 铭文合约配置
const INSCRIPTION_CONFIG = {
  // Sepolia 测试网合约地址
  contractAddress: '0x86bc751FED4f53d51D3463637985FB1d6F7b0dB6',
  // 铭文数据
  name: '币安人生',
  ticker: 'BSC-LIFE',
  maxSupply: 21000,
  perMint: 1,
  perWalletMax: 5,
  amountPerInscription: 1000
}

// 铭文 Mint 函数 - 使用 memo 协议格式
function createInscriptionData(ticker: string, amount: number): string {
  // BRC-20 格式: {"p":"bsc-20","op":"mint","tick":"BSC-LIFE","amt":1000}
  return JSON.stringify({
    p: 'bsc-20',
    op: 'mint',
    tick: ticker,
    amt: amount
  })
}

export function BscInscriptionMint() {
  const { currentChain } = useStore()
  
  // 钱包状态
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  
  // Mint 状态
  const [minting, setMinting] = useState(false)
  const [totalMinted, setTotalMinted] = useState(0)
  const [walletMintCount, setWalletMintCount] = useState(0)
  const [txHash, setTxHash] = useState<string>('')
  
  // 检查是否在 Sepolia 网络
  const isSepoliaNetwork = async () => {
    if (!provider) return false
    try {
      const network = await provider.getNetwork()
      return Number(network.chainId) === SEPOLIA_CONFIG.chainId
    } catch {
      return false
    }
  }

  // 切换到 Sepolia 网络
  const switchToSepolia = async () => {
    if (!window.ethereum) return false
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${SEPOLIA_CONFIG.chainId.toString(16)}` }]
      })
      return true
    } catch (switchError: any) {
      // 如果网络不存在，添加网络
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${SEPOLIA_CONFIG.chainId.toString(16)}`,
              chainName: SEPOLIA_CONFIG.chainName,
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: [SEPOLIA_CONFIG.rpcUrl],
              blockExplorerUrls: [SEPOLIA_CONFIG.explorer]
            }]
          })
          return true
        } catch (addError) {
          logError('添加 Sepolia 网络失败')
          return false
        }
      }
      return false
    }
  }

  // 连接钱包
  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('请安装 MetaMask 或其他钱包')
      return
    }

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await browserProvider.send('eth_requestAccounts', [])
      
      if (accounts.length === 0) {
        toast.error('未获取到钱包账户')
        return
      }

      // 检查并切换到 Sepolia
      const isSepolia = await isSepoliaNetwork()
      if (!isSepolia) {
        log('正在切换到 Sepolia 网络...')
        const switched = await switchToSepolia()
        if (!switched) {
          toast.error('请手动切换到 Sepolia 网络')
          return
        }
      }

      const walletSigner = await browserProvider.getSigner()
      const address = await walletSigner.getAddress()

      setProvider(browserProvider)
      setSigner(walletSigner)
      setWalletAddress(address)
      setIsConnected(true)

      logSuccess(`钱包已连接: ${address}`)
      toast.success('钱包连接成功')

      // 查询该钱包的 mint 次数（这里模拟，实际需要从链上查询）
      // TODO: 查询链上实际 mint 次数
      setWalletMintCount(0)
      
    } catch (error: any) {
      logError(`连接钱包失败: ${error.message}`)
      toast.error('连接钱包失败')
    }
  }

  // 断开钱包
  const disconnectWallet = () => {
    setWalletAddress('')
    setIsConnected(false)
    setProvider(null)
    setSigner(null)
    setWalletMintCount(0)
    log('钱包已断开')
  }

  // Mint 铭文 - 调用合约
  const handleMint = async () => {
    if (!isConnected || !signer) {
      toast.error('请先连接钱包')
      return
    }

    // 检查 mint 次数限制
    if (walletMintCount >= INSCRIPTION_CONFIG.perWalletMax) {
      toast.error(`该钱包已达到最大 mint 次数 (${INSCRIPTION_CONFIG.perWalletMax} 次)`)
      return
    }

    // 检查总供应量
    if (totalMinted >= INSCRIPTION_CONFIG.maxSupply) {
      toast.error('已达到最大供应量')
      return
    }

    setMinting(true)
    log(`开始 Mint 铭文: ${INSCRIPTION_CONFIG.name}...`)

    try {
      // 合约 ABI
      const contractABI = [
        'function mint() external',
        'function totalMinted() external view returns (uint256)',
        'function getMintCount(address minter) external view returns (uint256)',
        'function getRemainingMints(address minter) external view returns (uint256)'
      ]
      
      // 创建合约实例
      const contract = new ethers.Contract(
        INSCRIPTION_CONFIG.contractAddress,
        contractABI,
        signer
      )
      
      log(`调用合约 mint()...`)
      log(`合约地址: ${INSCRIPTION_CONFIG.contractAddress}`)
      
      // 调用 mint 函数
      const tx = await contract.mint()

      setTxHash(tx.hash)
      log(`交易已发送: ${tx.hash}`)
      log(`等待确认...`)

      // 等待交易确认
      const receipt = await tx.wait()
      
      if (receipt && receipt.status === 1) {
        logSuccess(`Mint 成功!`)
        logSuccess(`交易哈希: ${tx.hash}`)
        logSuccess(`铭文: ${INSCRIPTION_CONFIG.name}`)
        logSuccess(`数量: ${INSCRIPTION_CONFIG.amountPerInscription}`)
        
        // 查询最新的 mint 次数
        try {
          const count = await contract.getMintCount(walletAddress)
          setWalletMintCount(Number(count))
          const total = await contract.totalMinted()
          setTotalMinted(Number(total))
        } catch (e) {
          // 如果查询失败，手动更新
          setWalletMintCount(prev => prev + 1)
          setTotalMinted(prev => prev + 1)
        }
        
        toast.success(`Mint 成功! 交易: ${tx.hash.slice(0, 10)}...`)
      } else {
        throw new Error('交易失败')
      }
      
    } catch (error: any) {
      logError(`Mint 失败: ${error.message}`)
      toast.error(`Mint 失败: ${error.message}`)
    } finally {
      setMinting(false)
    }
  }

  // 复制地址
  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress)
    toast.success('已复制')
  }

  // 页面加载时检查是否已连接并查询合约状态
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await browserProvider.send('eth_accounts', [])
        if (accounts.length > 0) {
          const walletSigner = await browserProvider.getSigner()
          const address = await walletSigner.getAddress()
          setProvider(browserProvider)
          setSigner(walletSigner)
          setWalletAddress(address)
          setIsConnected(true)
          
          // 查询合约状态
          try {
            const contractABI = [
              'function totalMinted() external view returns (uint256)',
              'function getMintCount(address minter) external view returns (uint256)'
            ]
            const contract = new ethers.Contract(
              INSCRIPTION_CONFIG.contractAddress,
              contractABI,
              browserProvider
            )
            
            const total = await contract.totalMinted()
            setTotalMinted(Number(total))
            
            const count = await contract.getMintCount(address)
            setWalletMintCount(Number(count))
            
            log(`已连接钱包: ${address}`)
            log(`已 Mint: ${count}/${INSCRIPTION_CONFIG.perWalletMax}`)
            log(`总 Mint: ${total}/${INSCRIPTION_CONFIG.maxSupply}`)
          } catch (e) {
            // 合约可能未部署或网络错误
            log('查询合约状态失败，请检查网络')
          }
        }
      }
    }
    checkConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 to-dark-800 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎫 币安人生 铭文铸造
          </h1>
          <p className="text-gray-400">
            BSC 链上免费铸造 · 先到先得 · 每个钱包限 5 次
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="text-center p-4">
            <div className="text-gray-400 text-sm mb-1">总铸造量</div>
            <div className="text-2xl font-bold text-white">
              {totalMinted} / {INSCRIPTION_CONFIG.maxSupply}
            </div>
            <div className="mt-2 h-2 bg-dark-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${(totalMinted / INSCRIPTION_CONFIG.maxSupply) * 100}%` }}
              />
            </div>
          </Card>
          
          <Card className="text-center p-4">
            <div className="text-gray-400 text-sm mb-1">剩余可铸造</div>
            <div className="text-2xl font-bold text-green-400">
              {INSCRIPTION_CONFIG.maxSupply - totalMinted}
            </div>
          </Card>
          
          <Card className="text-center p-4">
            <div className="text-gray-400 text-sm mb-1">单张包含</div>
            <div className="text-2xl font-bold text-primary-400">
              {INSCRIPTION_CONFIG.amountPerInscription}
            </div>
            <div className="text-xs text-gray-500">{INSCRIPTION_CONFIG.name}</div>
          </Card>
          
          <Card className="text-center p-4">
            <div className="text-gray-400 text-sm mb-1">每钱包限制</div>
            <div className="text-2xl font-bold text-yellow-400">
              {INSCRIPTION_CONFIG.perWalletMax} 次
            </div>
          </Card>
        </div>

        {/* 主要内容 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 左侧：钱包连接 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Wallet size={20} className="text-primary-400" />
              钱包连接
            </h2>

            {!isConnected ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-200 flex items-center justify-center">
                  <Wallet size={32} className="text-gray-500" />
                </div>
                <p className="text-gray-400 mb-4">连接钱包以开始铸造</p>
                <Button onClick={connectWallet} className="w-full">
                  连接钱包
                </Button>
                <p className="text-xs text-gray-500 mt-3">
                  支持 MetaMask、TokenPocket 等
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 钱包地址 */}
                <div className="p-4 bg-surface-200 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">钱包地址</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">
                      {truncateAddress(walletAddress, 8)}
                    </span>
                    <button 
                      onClick={copyAddress}
                      className="p-1 hover:bg-surface-100 rounded text-gray-400 hover:text-white"
                    >
                      <Copy size={14} />
                    </button>
                    <a 
                      href={`${SEPOLIA_CONFIG.explorer}/address/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-surface-100 rounded text-gray-400 hover:text-white"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>

                {/* 网络状态 */}
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm text-green-400">已连接 Sepolia 网络</span>
                </div>

                {/* Mint 次数 */}
                <div className="p-4 bg-surface-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">已 Mint 次数</span>
                    <span className="text-xl font-bold text-white">
                      {walletMintCount} / {INSCRIPTION_CONFIG.perWalletMax}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: INSCRIPTION_CONFIG.perWalletMax }).map((_, i) => (
                      <div 
                        key={i}
                        className={`flex-1 h-2 rounded-full ${
                          i < walletMintCount 
                            ? 'bg-primary-500' 
                            : 'bg-dark-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <Button 
                  variant="ghost" 
                  onClick={disconnectWallet}
                  className="w-full"
                >
                  <X size={14} className="mr-1" /> 断开连接
                </Button>
              </div>
            )}
          </Card>

          {/* 右侧：Mint 操作 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Coins size={20} className="text-yellow-400" />
              铸造铭文
            </h2>

            {/* 铭文信息 */}
            <div className="p-4 bg-gradient-to-r from-primary-600/10 to-purple-600/10 rounded-lg border border-primary-500/20 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl">
                  🎫
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{INSCRIPTION_CONFIG.name}</div>
                  <div className="text-sm text-gray-400">{INSCRIPTION_CONFIG.ticker}</div>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-dark-800/50 rounded">
                  <div className="text-gray-500">单张数量</div>
                  <div className="font-bold text-white">{INSCRIPTION_CONFIG.amountPerInscription}</div>
                </div>
                <div className="p-2 bg-dark-800/50 rounded">
                  <div className="text-gray-500">铸造费用</div>
                  <div className="font-bold text-green-400">FREE</div>
                </div>
              </div>
            </div>

            {/* Mint 按钮 */}
            <Button
              onClick={handleMint}
              disabled={!isConnected || minting || walletMintCount >= INSCRIPTION_CONFIG.perWalletMax}
              className="w-full py-4 text-lg"
            >
              {minting ? (
                <>
                  <RefreshCw size={18} className="mr-2 animate-spin" />
                  铸造中...
                </>
              ) : !isConnected ? (
                <>
                  <Wallet size={18} className="mr-2" />
                  请先连接钱包
                </>
              ) : walletMintCount >= INSCRIPTION_CONFIG.perWalletMax ? (
                <>
                  <Check size={18} className="mr-2" />
                  已达到限制
                </>
              ) : (
                <>
                  <Coins size={18} className="mr-2" />
                  免费铸造
                </>
              )}
            </Button>

            {/* 交易哈希 */}
            {txHash && (
              <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="text-xs text-gray-400 mb-1">最近交易</div>
                <a 
                  href={`${SEPOLIA_CONFIG.explorer}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1"
                >
                  {truncateAddress(txHash, 10)}
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            {/* 提示信息 */}
            <div className="mt-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                <div className="text-sm text-yellow-200/80">
                  <div className="font-medium mb-1">铸造须知</div>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>每次铸造包含 {INSCRIPTION_CONFIG.amountPerInscription} 个 {INSCRIPTION_CONFIG.name}</li>
                    <li>每个钱包最多铸造 {INSCRIPTION_CONFIG.perWalletMax} 次</li>
                    <li>铸造免费，只需支付 BSC gas 费</li>
                    <li>总量 {INSCRIPTION_CONFIG.maxSupply} 张，先到先得</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* 铭文说明 */}
        <Card className="mt-6 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">什么是 BSC 铭文？</h3>
          <div className="text-gray-400 text-sm space-y-2">
            <p>
              BSC 铭文是基于 BNB Smart Chain 的代币协议，类似于比特币的 BRC-20，
              通过在交易的 data 字段中写入特定格式的数据来实现代币的铸造和转移。
            </p>
            <p>
              <strong className="text-white">币安人生 ({INSCRIPTION_CONFIG.ticker})</strong> 是一个社区驱动的铭文项目，
              总量 {INSCRIPTION_CONFIG.maxSupply} 张，每张包含 {INSCRIPTION_CONFIG.amountPerInscription} 个代币。
            </p>
          </div>
        </Card>

        {/* 底部链接 */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <a 
            href={SEPOLIA_CONFIG.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-400 transition-colors"
          >
            Sepolia Explorer
          </a>
          <span className="mx-2">·</span>
          <a 
            href={`${SEPOLIA_CONFIG.explorer}/address/${INSCRIPTION_CONFIG.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-400 transition-colors"
          >
            合约地址
          </a>
        </div>
      </div>
    </div>
  )
}
