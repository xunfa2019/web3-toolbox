import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { Card, Button, Input, Textarea } from '@/components/ui'
import { log, logSuccess, logError } from '@/utils/logger'
import { truncateAddress } from '@/utils/web3'
import { 
  Rocket, Globe, Hexagon, Code, Trash2, GripVertical, Copy, ExternalLink,
  ChevronDown, ChevronUp, Play, Square, RefreshCw, Calculator, Binary,
  Wallet, ArrowRightLeft, Layers, Zap, Timer
} from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuid } from 'uuid'
import clsx from 'clsx'

// 卡片类型定义
interface ToolCard {
  id: string
  type: string
  title: string
  collapsed: boolean
  order: number
}

// 打新脚本模版
const snipeTemplates = [
  {
    name: '快速抢购 (Buy)',
    description: '检测到新代币后立即买入',
    code: `// 快速抢购脚本模版
const { ethers } = require('ethers');

// 配置
const RPC_URL = '{{RPC_URL}}';
const PRIVATE_KEY = '{{PRIVATE_KEY}}';
const TOKEN_ADDRESS = '{{TOKEN_ADDRESS}}';
const ROUTER_ADDRESS = '{{ROUTER_ADDRESS}}'; // Uniswap/PancakeSwap Router
const AMOUNT_IN = '{{AMOUNT_IN}}'; // 投入金额 (ETH/BNB)

// Router ABI (简化版)
const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'
];

async function snipe() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  
  const WETH = '0x...'; // WETH/WBNB 地址
  const path = [WETH, TOKEN_ADDRESS];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分钟
  
  const tx = await router.swapExactETHForTokens(
    0, // amountOutMin = 0 (最大滑点)
    path,
    wallet.address,
    deadline,
    { value: ethers.parseEther(AMOUNT_IN) }
  );
  
  console.log('交易已发送:', tx.hash);
  await tx.wait();
  console.log('抢购成功!');
}

snipe().catch(console.error);`
  },
  {
    name: '限价单监控',
    description: '监控价格达到目标后自动交易',
    code: `// 限价单监控脚本
const { ethers } = require('ethers');

// 配置
const RPC_URL = '{{RPC_URL}}';
const PRIVATE_KEY = '{{PRIVATE_KEY}}';
const TOKEN_ADDRESS = '{{TOKEN_ADDRESS}}';
const TARGET_PRICE = '{{TARGET_PRICE}}'; // 目标价格
const CHECK_INTERVAL = 5000; // 检查间隔 (ms)

// Pair ABI
const PAIR_ABI = [
  'function getReserves() external view returns (uint112, uint112, uint32)'
];

async function monitorPrice() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const pairAddress = '0x...'; // 交易对地址
  const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
  
  console.log('开始监控价格...');
  
  setInterval(async () => {
    const [reserve0, reserve1] = await pair.getReserves();
    const price = reserve1 / reserve0;
    
    console.log(\`当前价格: \${price}\`);
    
    if (price >= TARGET_PRICE) {
      console.log('达到目标价格，执行交易!');
      // 执行卖出逻辑...
    }
  }, CHECK_INTERVAL);
}

monitorPrice();`
  },
  {
    name: '批量授权+购买',
    description: '授权代币后批量购买新币',
    code: `// 批量授权+购买脚本
const { ethers } = require('ethers');

// 配置
const RPC_URL = '{{RPC_URL}}';
const WALLETS = [/* 私钥数组 */];
const TOKEN_ADDRESS = '{{TOKEN_ADDRESS}}';
const AMOUNT = '{{AMOUNT}}';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address) view returns (uint256)'
];

const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)'
];

async function batchBuy() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  for (const privateKey of WALLETS) {
    try {
      const wallet = new ethers.Wallet(privateKey, provider);
      console.log(\`处理钱包: \${wallet.address}\`);
      
      // 1. 授权
      const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);
      const approveTx = await token.approve(
        '0x...', // Router
        ethers.MaxUint256
      );
      await approveTx.wait();
      
      // 2. 购买
      // ... 购买逻辑
      
      console.log(\`钱包 \${wallet.address} 完成\`);
    } catch (error) {
      console.error(\`钱包失败: \${error.message}\`);
    }
  }
}

batchBuy();`
  },
  {
    name: 'Mempool 监听',
    description: '监听内存池中的新交易',
    code: `// Mempool 监听脚本
const { ethers } = require('ethers');

const WSS_URL = '{{WSS_URL}}'; // WebSocket RPC

async function watchMempool() {
  const provider = new ethers.WebSocketProvider(WSS_URL);
  
  console.log('开始监听 mempool...');
  
  provider.on('pending', async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      
      // 过滤目标交易
      if (tx && tx.to && tx.data.length > 10) {
        // 解码交易数据
        console.log('检测到交易:', txHash);
        console.log('From:', tx.from);
        console.log('To:', tx.to);
        console.log('Value:', ethers.formatEther(tx.value || 0));
        
        // 判断是否为目标代币交易
        // ... 分析逻辑
      }
    } catch (error) {
      // 忽略错误
    }
  });
}

watchMempool();`
  }
]

// 快速分析网页链接
const analysisLinks = [
  { name: 'DexScreener', url: 'https://dexscreener.com', desc: 'DEX 实时价格和图表' },
  { name: 'DexTools', url: 'https://www.dextools.io', desc: 'DEX 分析工具' },
  { name: 'DeBank', url: 'https://debank.com', desc: 'DeFi 资产追踪' },
  { name: 'Etherscan', url: 'https://etherscan.io', desc: '以太坊区块浏览器' },
  { name: 'BscScan', url: 'https://bscscan.com', desc: 'BSC 区块浏览器' },
  { name: 'Arbiscan', url: 'https://arbiscan.io', desc: 'Arbitrum 区块浏览器' },
  { name: 'GeckoTerminal', url: 'https://www.geckoterminal.com', desc: 'DeFi 池子分析' },
  { name: 'Arkham', url: 'https://platform.arkhamintelligence.com', desc: '链上追踪' },
  { name: 'Nansen', url: 'https://www.nansen.ai', desc: 'Smart Money 追踪' },
  { name: 'Bubblemaps', url: 'https://bubblemaps.io', desc: '代币分布可视化' },
]

// 默认卡片配置
const defaultCards: ToolCard[] = [
  { id: 'snipe', type: 'snipe', title: '打新脚本', collapsed: false, order: 0 },
  { id: 'analysis', type: 'analysis', title: '快速分析', collapsed: false, order: 1 },
  { id: 'hex', type: 'hex', title: '16进制工具', collapsed: false, order: 2 },
  { id: 'contract', type: 'contract', title: '合约交互', collapsed: false, order: 3 },
  { id: 'webtest', type: 'webtest', title: '网页测试', collapsed: false, order: 4 },
]

export function Tools() {
  const { wallets, currentChain } = useStore()
  const [cards, setCards] = useState<ToolCard[]>(() => {
    const saved = localStorage.getItem('toolCards')
    return saved ? JSON.parse(saved) : defaultCards
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  
  // 打新脚本状态
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [selectedWallet, setSelectedWallet] = useState(0)
  const [scriptCode, setScriptCode] = useState(snipeTemplates[0].code)
  const [isRunning, setIsRunning] = useState(false)
  
  // 16进制工具状态
  const [hexInput, setHexInput] = useState('')
  const [hexOutput, setHexOutput] = useState('')
  const [hexMode, setHexMode] = useState<'encode' | 'decode'>('encode')
  const [textInput, setTextInput] = useState('')
  
  // 合约交互状态
  const [contractAddress, setContractAddress] = useState('')
  const [contractMethod, setContractMethod] = useState('')
  const [contractParams, setContractParams] = useState('')
  const [contractValue, setContractValue] = useState('0')
  
  // 保存卡片配置
  useEffect(() => {
    localStorage.setItem('toolCards', JSON.stringify(cards))
  }, [cards])
  
  // 删除卡片
  const removeCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
    toast.success('已删除卡片')
  }
  
  // 切换折叠
  const toggleCollapse = (id: string) => {
    setCards(prev => prev.map(c => 
      c.id === id ? { ...c, collapsed: !c.collapsed } : c
    ))
  }
  
  // 拖动开始
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  // 拖动结束
  const handleDragEnd = () => {
    setDraggingId(null)
  }
  
  // 拖动经过
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) return
    
    setCards(prev => {
      const dragIndex = prev.findIndex(c => c.id === draggingId)
      const targetIndex = prev.findIndex(c => c.id === targetId)
      
      if (dragIndex === -1 || targetIndex === -1) return prev
      
      const newCards = [...prev]
      const [removed] = newCards.splice(dragIndex, 1)
      newCards.splice(targetIndex, 0, removed)
      
      return newCards.map((c, i) => ({ ...c, order: i }))
    })
  }
  
  // 重置卡片
  const resetCards = () => {
    setCards(defaultCards)
    toast.success('已重置卡片布局')
  }
  
  // 16进制转换
  const convertHex = () => {
    try {
      if (hexMode === 'encode') {
        // 文本转16进制
        const hex = '0x' + Buffer.from(textInput, 'utf8').toString('hex')
        setHexOutput(hex)
        log(`文本转16进制: ${textInput.slice(0, 20)}... → ${hex.slice(0, 20)}...`)
      } else {
        // 16进制转文本
        const cleanHex = hexInput.startsWith('0x') ? hexInput.slice(2) : hexInput
        const text = Buffer.from(cleanHex, 'hex').toString('utf8')
        setHexOutput(text)
        log(`16进制转文本: ${hexInput.slice(0, 20)}... → ${text.slice(0, 20)}...`)
      }
      toast.success('转换成功')
    } catch (error: any) {
      toast.error('转换失败: ' + error.message)
      logError('16进制转换失败: ' + error.message)
    }
  }
  
  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制')
  }
  
  // 渲染卡片内容
  const renderCardContent = (card: ToolCard) => {
    switch (card.type) {
      case 'snipe':
        return (
          <div className="space-y-4">
            {/* 钱包选择 */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">使用钱包:</label>
              <select
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(parseInt(e.target.value))}
                className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value={-1}>-- 选择钱包 --</option>
                {wallets.map((w, i) => (
                  <option key={w.id} value={i}>
                    {w.name} ({truncateAddress(w.address)})
                  </option>
                ))}
              </select>
            </div>
            
            {/* 脚本模版选择 */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">脚本模版:</label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  const idx = parseInt(e.target.value)
                  setSelectedTemplate(idx)
                  setScriptCode(snipeTemplates[idx].code)
                }}
                className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
              >
                {snipeTemplates.map((t, i) => (
                  <option key={i} value={i}>{t.name}</option>
                ))}
              </select>
            </div>
            
            {/* 模版说明 */}
            <div className="text-xs text-gray-500 bg-surface-100 p-2 rounded">
              {snipeTemplates[selectedTemplate].description}
            </div>
            
            {/* 代码编辑器 */}
            <div className="relative">
              <Textarea
                value={scriptCode}
                onChange={setScriptCode}
                rows={12}
                className="font-mono text-xs"
                placeholder="脚本代码..."
              />
              <button
                onClick={() => copyToClipboard(scriptCode)}
                className="absolute top-2 right-2 p-1.5 bg-surface-200 rounded hover:bg-surface-100 text-gray-400 hover:text-white"
                title="复制代码"
              >
                <Copy size={14} />
              </button>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (selectedWallet < 0) {
                    toast.error('请先选择钱包')
                    return
                  }
                  const wallet = wallets[selectedWallet]
                  // 替换模版中的变量
                  let code = scriptCode
                    .replace('{{RPC_URL}}', currentChain.rpcUrl)
                    .replace('{{PRIVATE_KEY}}', wallet.privateKey)
                  
                  setScriptCode(code)
                  log(`已填入钱包信息: ${wallet.name}`)
                  toast.success('已填入配置')
                }}
                disabled={selectedWallet < 0}
              >
                <Wallet size={14} className="mr-1" /> 填入配置
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(scriptCode)}
              >
                <Copy size={14} className="mr-1" /> 复制
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setScriptCode(snipeTemplates[selectedTemplate].code)
                  toast.success('已重置代码')
                }}
              >
                <RefreshCw size={14} className="mr-1" /> 重置
              </Button>
            </div>
            
            {/* 使用说明 */}
            <div className="text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
              ⚠️ 使用说明:
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>脚本需要在本地 Node.js 环境运行</li>
                <li>请在测试网先验证脚本功能</li>
                <li>注意 gas 费用和滑点设置</li>
                <li>私钥仅在本地使用，请妥善保管</li>
              </ul>
            </div>
          </div>
        )
        
      case 'analysis':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {analysisLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 bg-surface-100 rounded-lg hover:bg-primary-500/10 transition-colors group"
                >
                  <ExternalLink size={14} className="text-gray-500 group-hover:text-primary-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{link.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{link.desc}</div>
                  </div>
                </a>
              ))}
            </div>
            
            {/* 自定义链接 */}
            <div className="border-t border-white/5 pt-3">
              <div className="text-xs text-gray-400 mb-2">快速搜索</div>
              <div className="flex gap-2">
                <Input
                  value={contractAddress}
                  onChange={setContractAddress}
                  placeholder="输入代币地址或名称..."
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (contractAddress) {
                      window.open(`https://dexscreener.com/search?q=${contractAddress}`, '_blank')
                    }
                  }}
                >
                  搜索
                </Button>
              </div>
            </div>
          </div>
        )
        
      case 'hex':
        return (
          <div className="space-y-4">
            {/* 模式选择 */}
            <div className="flex gap-2">
              <button
                onClick={() => setHexMode('encode')}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  hexMode === 'encode'
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-100 text-gray-400 hover:text-white'
                )}
              >
                文本 → 16进制
              </button>
              <button
                onClick={() => setHexMode('decode')}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  hexMode === 'decode'
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-100 text-gray-400 hover:text-white'
                )}
              >
                16进制 → 文本
              </button>
            </div>
            
            {/* 输入 */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                {hexMode === 'encode' ? '输入文本:' : '输入16进制:'}
              </label>
              {hexMode === 'encode' ? (
                <Textarea
                  value={textInput}
                  onChange={setTextInput}
                  rows={3}
                  placeholder="输入要转换的文本..."
                />
              ) : (
                <Textarea
                  value={hexInput}
                  onChange={setHexInput}
                  rows={3}
                  placeholder="输入16进制数据 (0x...)..."
                />
              )}
            </div>
            
            {/* 转换按钮 */}
            <Button variant="primary" size="sm" onClick={convertHex} className="w-full">
              <ArrowRightLeft size={14} className="mr-1" /> 转换
            </Button>
            
            {/* 输出 */}
            {hexOutput && (
              <div className="relative">
                <label className="text-xs text-gray-400 mb-1 block">转换结果:</label>
                <div className="bg-dark-900 border border-white/10 rounded-lg p-3 font-mono text-sm break-all">
                  {hexOutput}
                </div>
                <button
                  onClick={() => copyToClipboard(hexOutput)}
                  className="absolute top-6 right-2 p-1.5 bg-surface-200 rounded hover:bg-surface-100 text-gray-400 hover:text-white"
                  title="复制"
                >
                  <Copy size={14} />
                </button>
              </div>
            )}
            
            {/* 快捷工具 */}
            <div className="border-t border-white/5 pt-3">
              <div className="text-xs text-gray-400 mb-2">快捷工具</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const hex = '0x' + Math.floor(Date.now() / 1000).toString(16)
                    setHexOutput(hex)
                    toast.success('已生成时间戳 (16进制)')
                  }}
                  className="p-2 bg-surface-100 rounded text-xs text-gray-400 hover:text-white hover:bg-primary-500/10"
                >
                  <Timer size={14} className="mx-auto mb-1" />
                  时间戳
                </button>
                <button
                  onClick={() => {
                    const hex = '0x' + uuid().replace(/-/g, '')
                    setHexOutput(hex)
                    toast.success('已生成 UUID')
                  }}
                  className="p-2 bg-surface-100 rounded text-xs text-gray-400 hover:text-white hover:bg-primary-500/10"
                >
                  <Layers size={14} className="mx-auto mb-1" />
                  UUID
                </button>
                <button
                  onClick={() => {
                    const hex = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')
                    setHexOutput(hex)
                    toast.success('已生成随机哈希')
                  }}
                  className="p-2 bg-surface-100 rounded text-xs text-gray-400 hover:text-white hover:bg-primary-500/10"
                >
                  <Zap size={14} className="mx-auto mb-1" />
                  随机哈希
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.readText().then(text => {
                      if (hexMode === 'encode') {
                        setTextInput(text)
                      } else {
                        setHexInput(text)
                      }
                      toast.success('已粘贴')
                    })
                  }}
                  className="p-2 bg-surface-100 rounded text-xs text-gray-400 hover:text-white hover:bg-primary-500/10"
                >
                  <Copy size={14} className="mx-auto mb-1" />
                  粘贴
                </button>
              </div>
            </div>
          </div>
        )
        
      case 'contract':
        return (
          <div className="space-y-4">
            <Input
              label="合约地址"
              value={contractAddress}
              onChange={setContractAddress}
              placeholder="0x..."
            />
            <Input
              label="方法签名"
              value={contractMethod}
              onChange={setContractMethod}
              placeholder="transfer(address,uint256)"
            />
            <Textarea
              label="参数 (JSON数组)"
              value={contractParams}
              onChange={setContractParams}
              rows={2}
              placeholder='["0x...", "1000000"]'
            />
            <Input
              label="发送金额 (ETH)"
              value={contractValue}
              onChange={setContractValue}
              placeholder="0"
            />
            
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (selectedWallet < 0) {
                    toast.error('请先选择钱包')
                    return
                  }
                  if (!contractAddress || !contractMethod) {
                    toast.error('请填写合约地址和方法')
                    return
                  }
                  // 构建 calldata
                  const methodId = contractMethod.slice(0, 10) // 简化版
                  log(`准备调用合约: ${contractAddress}`)
                  log(`方法: ${contractMethod}`)
                  log(`参数: ${contractParams || '无'}`)
                  toast.success('已准备交易数据')
                }}
                disabled={selectedWallet < 0}
              >
                <Play size={14} className="mr-1" /> 构建交易
              </Button>
              <select
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(parseInt(e.target.value))}
                className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value={-1}>-- 选择钱包 --</option>
                {wallets.map((w, i) => (
                  <option key={w.id} value={i}>
                    {w.name} ({truncateAddress(w.address)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )
      
      case 'webtest':
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              测试部署的 Web3 网页应用
            </div>
            
            {/* 铭文铸造测试 */}
            <a
              href="/mint"
              className="block p-4 bg-surface-100 rounded-lg hover:bg-primary-500/10 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xl">
                    🎫
                  </div>
                  <div>
                    <div className="font-medium text-white">币安人生 铭文铸造</div>
                    <div className="text-xs text-gray-500">Sepolia 测试网 · Free Mint</div>
                  </div>
                </div>
                <ExternalLink size={16} className="text-gray-500 group-hover:text-primary-400" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-dark-900 rounded text-center">
                  <div className="text-gray-500">总量</div>
                  <div className="text-white font-medium">21,000</div>
                </div>
                <div className="p-2 bg-dark-900 rounded text-center">
                  <div className="text-gray-500">每张</div>
                  <div className="text-white font-medium">1,000</div>
                </div>
                <div className="p-2 bg-dark-900 rounded text-center">
                  <div className="text-gray-500">限制</div>
                  <div className="text-yellow-400 font-medium">5次/钱包</div>
                </div>
              </div>
            </a>
            
            {/* 合约信息 */}
            <div className="p-3 bg-surface-100 rounded-lg">
              <div className="text-xs text-gray-400 mb-2">合约地址 (Sepolia)</div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-primary-400 bg-dark-900 px-2 py-1 rounded flex-1 truncate">
                  0x86bc751FED4f53d51D3463637985FB1d6F7b0dB6
                </code>
                <a 
                  href="https://sepolia.etherscan.io/address/0x86bc751FED4f53d51D3463637985FB1d6F7b0dB6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-surface-200 rounded text-gray-500 hover:text-white"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
            
            {/* 提示 */}
            <div className="text-xs text-yellow-500 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
              ⚠️ 测试说明：
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>需要 Sepolia 测试网 ETH</li>
                <li>点击上方卡片进入铸造页面</li>
                <li>每个钱包最多 mint 5 次</li>
              </ul>
            </div>
          </div>
        )
        
      default:
        return null
    }
  }
  
  return (
    <div className="space-y-4 animate-fade-in">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">工具箱</h1>
          <span className="text-sm text-gray-500">打新 · 分析 · 转换</span>
        </div>
        <Button variant="ghost" size="sm" onClick={resetCards}>
          <RefreshCw size={14} className="mr-1" /> 重置布局
        </Button>
      </div>
      
      {/* 可拖动卡片列表 */}
      <div className="space-y-4">
        {cards.map(card => (
          <div
            key={card.id}
            draggable
            onDragStart={(e) => handleDragStart(e, card.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, card.id)}
            className={clsx(
              'transition-all',
              draggingId === card.id && 'opacity-50 scale-95'
            )}
          >
            <Card className="overflow-hidden">
              {/* 卡片标题栏 */}
              <div 
                className="flex items-center justify-between px-4 py-2 bg-surface-200 cursor-move"
                onClick={() => toggleCollapse(card.id)}
              >
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-gray-500" />
                  <span className="font-medium text-white">{card.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeCard(card.id)
                    }}
                    className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                    title="删除卡片"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCollapse(card.id)
                    }}
                    className="p-1 rounded hover:bg-surface-100 text-gray-400"
                  >
                    {card.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>
              </div>
              
              {/* 卡片内容 */}
              {!card.collapsed && (
                <div className="p-4">
                  {renderCardContent(card)}
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
      
      {/* 空状态 */}
      {cards.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-gray-500 mb-4">所有卡片已删除</div>
          <Button variant="secondary" onClick={resetCards}>
            <RefreshCw size={14} className="mr-1" /> 恢复默认卡片
          </Button>
        </Card>
      )}
    </div>
  )
}
