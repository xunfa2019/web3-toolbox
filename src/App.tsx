import { useState, useCallback, createContext, useContext, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Wallets } from '@/pages/Wallets'
import { Transfer } from '@/pages/Transfer'
import { Contract } from '@/pages/Contract'
import { Settings } from '@/pages/Settings'
import { Tools } from '@/pages/Tools'
import { BscInscriptionMint } from '@/pages/BscInscriptionMint'
import { NetworkSettingsModal } from '@/components/NetworkSettingsModal'
import { FloatingWalletList } from '@/components/FloatingWalletList'
import { WalletDropdown } from '@/components/WalletDropdown'
import { useStore } from '@/stores/useStore'
import { Globe, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

// 创建全局地址填入上下文
type FillAddressContextType = {
  setFillAddressHandler: (handler: ((address: string) => void) | null) => void
}

export const FillAddressContext = createContext<FillAddressContextType>({
  setFillAddressHandler: () => {},
})

export function useFillAddress() {
  return useContext(FillAddressContext)
}

export default function App() {
  const [showNetworkSettings, setShowNetworkSettings] = useState(false)
  const [showWalletList, setShowWalletList] = useState(false)
  const { wallets, currentChain } = useStore()
  const [fillAddressHandler, setFillAddressHandler] = useState<((address: string) => void) | null>(null)
  const [isConnected, setIsConnected] = useState(true)
  const [checking, setChecking] = useState(false)

  // 检测区块链网络连接状态
  const checkNetworkConnection = async () => {
    setChecking(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(currentChain.rpcUrl, {
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
      setIsConnected(!!data.result)
    } catch (error) {
      setIsConnected(false)
    }
    setChecking(false)
  }

  // 定期检测网络状态
  useEffect(() => {
    checkNetworkConnection()
    const interval = setInterval(checkNetworkConnection, 30000)
    return () => clearInterval(interval)
  }, [currentChain.rpcUrl])

  // 处理地址填入
  const handleFillAddress = useCallback((address: string) => {
    if (fillAddressHandler) {
      fillAddressHandler(address)
      toast.success('已填入地址')
    } else {
      navigator.clipboard.writeText(address)
      toast.success('地址已复制')
    }
  }, [fillAddressHandler])

  return (
    <FillAddressContext.Provider value={{ setFillAddressHandler }}>
      <Layout>
        {/* 右上角区域 */}
        <div className="fixed top-4 right-4 z-30 flex items-center gap-3">
          {/* 钱包按钮 - 有钱包时显示 */}
          {wallets.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowWalletList(!showWalletList)}
                className="flex items-center gap-2 px-3 py-2 bg-surface-300 border border-white/10 rounded-lg hover:bg-surface-200 transition-colors text-sm"
              >
                <Wallet size={16} className="text-primary-400" />
                <span className="text-gray-300">{wallets.length} 个钱包</span>
              </button>

              {/* 下拉钱包列表 */}
              {showWalletList && (
                <>
                  {/* 点击外部关闭 */}
                  <div className="fixed inset-0" onClick={() => setShowWalletList(false)} />
                  
                  {/* 下拉内容 - 右对齐 */}
                  <div 
                    className="absolute top-full mt-2 w-80 max-h-[70vh] overflow-hidden rounded-lg bg-surface-300 border border-white/10 shadow-2xl"
                    style={{ right: 0 }}
                  >
                    <WalletDropdown onFillAddress={(addr) => { handleFillAddress(addr); setShowWalletList(false); }} />
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* 网络设置按钮 */}
          <button
            onClick={() => setShowNetworkSettings(true)}
            className="flex items-center gap-2 px-3 py-2 bg-surface-300 border border-white/10 rounded-lg hover:bg-surface-200 transition-colors text-sm text-gray-300"
          >
            <Globe size={16} className={isConnected ? 'text-green-400' : 'text-red-400'} />
            <span>{currentChain.name}</span>
          </button>
        </div>

        <Routes>
          <Route path="/" element={<Navigate to="/wallets" replace />} />
          <Route path="/wallets" element={<Wallets />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/contract" element={<Contract />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/test" element={<BscInscriptionMint />} />
          <Route path="/mint" element={<BscInscriptionMint />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>

      {/* 网络设置弹窗 */}
      {showNetworkSettings && (
        <NetworkSettingsModal 
          onClose={() => setShowNetworkSettings(false)} 
          isConnected={isConnected}
          onCheckConnection={checkNetworkConnection}
          checking={checking}
        />
      )}
    </FillAddressContext.Provider>
  )
}
