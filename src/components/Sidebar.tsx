import { NavLink } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { useState, useEffect } from 'react'
import {
  Wallet,
  Send,
  FileCode,
  Globe,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Settings,
  Wrench,
  FlaskConical,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/wallets', icon: Wallet, label: '钱包管理' },
  { to: '/transfer', icon: Send, label: '批量转账' },
  { to: '/contract', icon: FileCode, label: '合约交互' },
  { to: '/tools', icon: Wrench, label: '工具箱' },
  { to: '/test', icon: FlaskConical, label: '测试' },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, currentChain } = useStore()
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
    const interval = setInterval(checkNetworkConnection, 30000) // 每30秒检测一次
    return () => clearInterval(interval)
  }, [currentChain.rpcUrl])

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full bg-surface-300 border-r border-white/5 transition-all duration-300 z-50 flex flex-col',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          W3
        </div>
        {sidebarOpen && (
          <span className="font-semibold text-white whitespace-nowrap">Web3 工具箱</span>
        )}
      </div>

      {/* 主导航 */}
      <nav className="p-3 space-y-1 flex-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm',
                isActive
                  ? 'bg-primary-600/20 text-primary-500'
                  : 'text-gray-400 hover:bg-surface-100 hover:text-gray-200'
              )
            }
          >
            <Icon size={20} />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* 底部区域 */}
      <div className="p-3 border-t border-white/5 space-y-1">
        {/* 区块链网络状态指示器 */}
        <div 
          className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer"
          onClick={checkNetworkConnection}
          title={`当前网络: ${currentChain.name} (${currentChain.symbol})\nRPC: ${currentChain.rpcUrl}\n点击刷新`}
        >
          {checking ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : isConnected ? (
            <Wifi size={20} className="text-green-500" />
          ) : (
            <WifiOff size={20} className="text-red-500" />
          )}
          {sidebarOpen && (
            <div className="flex flex-col">
              <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                {currentChain.name}
              </span>
              <span className="text-[10px] text-gray-500">
                {isConnected ? '已连接' : '未连接'}
              </span>
            </div>
          )}
        </div>

        {/* 收起按钮 */}
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-surface-100 hover:text-gray-200 transition-colors text-sm w-full"
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          {sidebarOpen && <span>收起</span>}
        </button>
      </div>
    </aside>
  )
}
