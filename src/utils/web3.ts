import { ethers } from 'ethers'
import { Wallet, Chain, WalletType, WalletSource, BACKUP_RPCS } from '@/types'

// ============ 智能 Provider（自动切换 RPC）============
export class SmartProvider {
  private chainId: number
  private currentRpcIndex: number = 0
  private provider: ethers.JsonRpcProvider

  constructor(chainId: number, rpcUrl?: string) {
    this.chainId = chainId
    const rpcs = BACKUP_RPCS[chainId] || [rpcUrl || '']
    this.provider = new ethers.JsonRpcProvider(rpcUrl || rpcs[0])
  }

  // 获取当前 provider
  getProvider(): ethers.JsonRpcProvider {
    return this.provider
  }

  // 切换到下一个 RPC
  async switchToNextRpc(): Promise<boolean> {
    const rpcs = BACKUP_RPCS[this.chainId]
    if (!rpcs || rpcs.length === 0) return false

    this.currentRpcIndex = (this.currentRpcIndex + 1) % rpcs.length
    const newRpc = rpcs[this.currentRpcIndex]
    
    try {
      this.provider = new ethers.JsonRpcProvider(newRpc)
      // 测试连接
      await this.provider.getBlockNumber()
      console.log(`[SmartProvider] 切换到 RPC: ${newRpc}`)
      return true
    } catch {
      return this.switchToNextRpc() // 递归尝试下一个
    }
  }

  // 带自动重试的方法
  async getBalance(address: string): Promise<bigint> {
    try {
      return await this.provider.getBalance(address)
    } catch (error) {
      if (await this.switchToNextRpc()) {
        return await this.provider.getBalance(address)
      }
      throw error
    }
  }

  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber()
    } catch (error) {
      if (await this.switchToNextRpc()) {
        return await this.provider.getBlockNumber()
      }
      throw error
    }
  }

  async getFeeData(): Promise<ethers.FeeData> {
    try {
      return await this.provider.getFeeData()
    } catch (error) {
      if (await this.switchToNextRpc()) {
        return await this.provider.getFeeData()
      }
      throw error
    }
  }
}

// ============ 创建智能 Provider ============
export function createSmartProvider(chainId: number, rpcUrl?: string): SmartProvider {
  return new SmartProvider(chainId, rpcUrl)
}

// ============ 创建普通 Provider（兼容旧代码）============
export function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl)
}

// 生成分组ID
function generateGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ============ 生成随机钱包 ============
export function generateWallets(count: number, chainId: number, type: WalletType = 'evm', groupIndex: number = 1): Wallet[] {
  const wallets: Wallet[] = []
  const groupId = generateGroupId()
  for (let i = 0; i < count; i++) {
    const wallet = ethers.Wallet.createRandom()
    wallets.push({
      id: crypto.randomUUID(),
      name: `Wallet-${i + 1}`,
      address: wallet.address,
      privateKey: wallet.privateKey,
      balance: '0',
      chainId,
      type,
      source: 'generated',
      groupId,
      groupIndex,
    })
  }
  return wallets
}

// ============ 从私钥导入钱包 ============
export function importFromPrivateKeys(keys: string[], chainId: number, type: WalletType = 'evm', groupIndex: number = 1): Wallet[] {
  const groupId = generateGroupId()
  return keys.map((key, i) => {
    const trimmed = key.trim()
    const wallet = new ethers.Wallet(trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`)
    return {
      id: crypto.randomUUID(),
      name: `Imported-${i + 1}`,
      address: wallet.address,
      privateKey: wallet.privateKey,
      balance: '0',
      chainId,
      type,
      source: 'imported' as WalletSource,
      groupId,
      groupIndex,
    }
  })
}

// ============ 从助记词导入 ============
export function importFromMnemonic(mnemonic: string, count: number, chainId: number, type: WalletType = 'evm', groupIndex: number = 1): Wallet[] {
  const wallets: Wallet[] = []
  const groupId = generateGroupId()
  const basePath = "m/44'/60'/0'/0/"
  for (let i = 0; i < count; i++) {
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, basePath + i)
    wallets.push({
      id: crypto.randomUUID(),
      name: `HD-${i + 1}`,
      address: wallet.address,
      privateKey: wallet.privateKey,
      balance: '0',
      chainId,
      type,
      source: 'imported',
      groupId,
      groupIndex,
    })
  }
  return wallets
}

// ============ 查询余额 ============
export async function getBalance(address: string, chain: Chain): Promise<string> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl)
  const balance = await provider.getBalance(address)
  return ethers.formatEther(balance)
}

// ============ 批量查询余额 ============
export async function refreshBalances(
  wallets: Wallet[],
  chain: Chain,
  onProgress?: (id: string, balance: string) => void
): Promise<void> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl)
  const promises = wallets.map(async (w) => {
    const balance = await provider.getBalance(w.address)
    const formatted = ethers.formatEther(balance)
    onProgress?.(w.id, formatted)
    return { id: w.id, balance: formatted }
  })
  await Promise.allSettled(promises)
}

// ============ 发送 ETH/BNB ============
export async function sendNative(
  privateKey: string,
  to: string,
  amount: string,
  chain: Chain
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)
  const tx = await wallet.sendTransaction({
    to,
    value: ethers.parseEther(amount),
  })
  return tx.hash
}

// ============ 合约调用（读取） ============
export async function callContractRead(
  chain: Chain,
  contractAddress: string,
  abi: any[],
  method: string,
  params: any[]
): Promise<any> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl)
  const contract = new ethers.Contract(contractAddress, abi, provider)
  return contract[method](...params)
}

// ============ 合约调用（写入） ============
export async function callContractWrite(
  privateKey: string,
  chain: Chain,
  contractAddress: string,
  abi: any[],
  method: string,
  params: any[],
  value: string = '0'
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)
  const contract = new ethers.Contract(contractAddress, abi, wallet)
  const tx = await contract[method](...params, {
    value: ethers.parseEther(value || '0'),
  })
  return tx.hash
}

// ============ 解析 CSV ============
export function parseCSVWallets(csvText: string, chainId: number, type: WalletType = 'evm', groupIndex: number = 1): Wallet[] {
  const lines = csvText.trim().split('\n')
  const wallets: Wallet[] = []
  const groupId = generateGroupId()
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.trim())
    if (parts.length < 2) continue
    const [privateKey, name] = parts
    try {
      const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`)
      wallets.push({
        id: crypto.randomUUID(),
        name: name || `CSV-${i + 1}`,
        address: wallet.address,
        privateKey: wallet.privateKey,
        balance: '0',
        chainId,
        type,
        source: 'imported',
        groupId,
        groupIndex,
      })
    } catch {
      // 跳过无效行
    }
  }
  return wallets
}

// ============ 地址校验 ============
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address)
}

// ============ 截断地址 ============
export function truncateAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

// ============ ERC20 合约 ABI ============
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
]

// ============ 查询 ERC20 余额 ============
export async function getERC20Balance(
  address: string,
  tokenAddress: string,
  chain: Chain
): Promise<{ balance: string; decimals: number; symbol: string }> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl)
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  
  const [balance, decimals, symbol] = await Promise.all([
    contract.balanceOf(address),
    contract.decimals(),
    contract.symbol(),
  ])
  
  return {
    balance: ethers.formatUnits(balance, decimals),
    decimals,
    symbol,
  }
}

// ============ 发送 ERC20 代币 ============
export async function sendERC20(
  privateKey: string,
  tokenAddress: string,
  to: string,
  amount: string,
  chain: Chain
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet)
  
  // 获取代币精度
  const decimals = await contract.decimals()
  const amountWei = ethers.parseUnits(amount, decimals)
  
  const tx = await contract.transfer(to, amountWei)
  return tx.hash
}

// ============ 查询 ERC20 代币信息 ============
export async function getERC20Info(
  tokenAddress: string,
  chain: Chain
): Promise<{ name: string; symbol: string; decimals: number }> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl)
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  
  const [name, symbol, decimals] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
  ])
  
  return { name, symbol, decimals }
}
