import { create } from 'zustand'
import { Wallet, Chain, TransferTask, ContractCall, PRESET_CHAINS } from '@/types'

interface AppState {
  // 网络
  chains: Chain[]
  currentChain: Chain
  setCurrentChain: (chain: Chain) => void
  addChain: (chain: Chain) => void

  // 钱包
  wallets: Wallet[]
  walletGroupIndex: number
  addWallets: (wallets: Wallet[]) => void
  removeWallet: (id: string) => void
  clearWallets: () => void
  updateWalletBalance: (id: string, balance: string) => void

  // 批量转账
  transferTasks: TransferTask[]
  setTransferTasks: (tasks: TransferTask[]) => void
  updateTransferTask: (id: string, update: Partial<TransferTask>) => void
  clearTransferTasks: () => void

  // 合约交互
  contractCalls: ContractCall[]
  setContractCalls: (calls: ContractCall[]) => void
  updateContractCall: (id: string, update: Partial<ContractCall>) => void
  clearContractCalls: () => void

  // UI
  sidebarOpen: boolean
  toggleSidebar: () => void
  
  // 任务控制
  isRunning: boolean
  shouldStop: boolean
  setRunning: (running: boolean) => void
  setShouldStop: (stop: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  chains: PRESET_CHAINS,
  currentChain: PRESET_CHAINS.find(c => c.id === 11155111) || PRESET_CHAINS[1], // 默认 Sepolia
  setCurrentChain: (chain) => set({ currentChain: chain }),
  addChain: (chain) => set((s) => ({ chains: [...s.chains, chain] })),

  // 钱包
  wallets: [],
  walletGroupIndex: 0,
  addWallets: (newWallets) => set((s) => ({ 
    wallets: [...s.wallets, ...newWallets],
    walletGroupIndex: s.walletGroupIndex + 1,
  })),
  removeWallet: (id) => set((s) => ({ wallets: s.wallets.filter((w) => w.id !== id) })),
  clearWallets: () => set({ wallets: [], walletGroupIndex: 0 }),
  updateWalletBalance: (id, balance) =>
    set((s) => ({ wallets: s.wallets.map((w) => (w.id === id ? { ...w, balance } : w)) })),

  transferTasks: [],
  setTransferTasks: (tasks) => set({ transferTasks: tasks }),
  updateTransferTask: (id, update) =>
    set((s) => ({
      transferTasks: s.transferTasks.map((t) => (t.id === id ? { ...t, ...update } : t)),
    })),
  clearTransferTasks: () => set({ transferTasks: [] }),

  contractCalls: [],
  setContractCalls: (calls) => set({ contractCalls: calls }),
  updateContractCall: (id, update) =>
    set((s) => ({
      contractCalls: s.contractCalls.map((c) => (c.id === id ? { ...c, ...update } : c)),
    })),
  clearContractCalls: () => set({ contractCalls: [] }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  
  // 任务控制
  isRunning: false,
  shouldStop: false,
  setRunning: (running) => set({ isRunning: running }),
  setShouldStop: (stop) => set({ shouldStop: stop }),
}))
