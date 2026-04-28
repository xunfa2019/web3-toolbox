// ============ 钱包类型 ============
export type WalletType = 'evm' | 'sol' | 'btc'

// ============ 钱包来源 ============
export type WalletSource = 'generated' | 'imported'

// ============ 钱包 ============
export interface Wallet {
  id: string
  name: string
  address: string
  privateKey: string // 加密存储，实际使用时解密
  balance: string    // ETH/BNB 余额
  chainId: number
  type: WalletType   // 钱包类型
  source: WalletSource // 来源：生成 or 导入
  groupId: string    // 分组ID
  groupIndex: number // 第几次导入/生成
}

// ============ 网络 ============
export interface Chain {
  id: number
  name: string
  rpcUrl: string
  symbol: string
  explorer: string
  icon?: string
}

// ============ 批量转账 ============
export interface TransferTask {
  id: string
  fromWallet: string    // wallet id
  toAddress: string
  amount: string
  status: 'pending' | 'sending' | 'success' | 'failed'
  txHash?: string
  error?: string
}

// ============ 合约交互 ============
export interface ContractCall {
  id: string
  walletId: string
  contractAddress: string
  method: string
  params: string[]
  value: string       // 发送的 ETH 数量
  abi: string         // JSON string
  status: 'pending' | 'sending' | 'success' | 'failed'
  txHash?: string
  error?: string
}

// ============ 预设网络 ============
export const PRESET_CHAINS: Chain[] = [
  { id: 1, name: 'Ethereum', rpcUrl: 'https://eth.llamarpc.com', symbol: 'ETH', explorer: 'https://etherscan.io' },
  { id: 56, name: 'BSC', rpcUrl: 'https://bsc-dataseed.binance.org', symbol: 'BNB', explorer: 'https://bscscan.com' },
  { id: 137, name: 'Polygon', rpcUrl: 'https://polygon-rpc.com', symbol: 'MATIC', explorer: 'https://polygonscan.com' },
  { id: 42161, name: 'Arbitrum', rpcUrl: 'https://arb1.arbitrum.io/rpc', symbol: 'ETH', explorer: 'https://arbiscan.io' },
  { id: 8453, name: 'Base', rpcUrl: 'https://mainnet.base.org', symbol: 'ETH', explorer: 'https://basescan.org' },
  { id: 43114, name: 'Avalanche', rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', symbol: 'AVAX', explorer: 'https://snowtrace.io' },
  { id: 250, name: 'Fantom', rpcUrl: 'https://rpc.ftm.tools', symbol: 'FTM', explorer: 'https://ftmscan.com' },
  { id: 11155111, name: 'Sepolia', rpcUrl: 'https://eth-sepolia.api.onfinality.io/public', symbol: 'ETH', explorer: 'https://sepolia.etherscan.io' },
]

// ============ 备用 RPC 列表 ============
export const BACKUP_RPCS: Record<number, string[]> = {
  11155111: [ // Sepolia
    'https://eth-sepolia.api.onfinality.io/public',
    'https://ethereum-sepolia.rpc.subquery.network/public',
    'https://ethereum-sepolia-public.nodies.app',
    'https://1rpc.io/sepolia',
    'https://sepolia.drpc.org',
    'https://gateway.tenderly.co/public/sepolia',
  ],
  1: [ // Ethereum Mainnet
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
  ],
  56: [ // BSC
    'https://bsc-dataseed.binance.org',
    'https://rpc.ankr.com/bsc',
    'https://bsc.publicnode.com',
  ],
}
