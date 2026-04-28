# Web3 Toolbox

一个功能强大的 Web3 工具集，专为加密货币交易者设计。

## ✨ 功能特性

- **钱包管理**：批量生成/导入 EVM 钱包，按批次分组显示
- **批量转账**：支持 ETH/ERC20 的一对多分发、多对一归集
- **合约交互**：与智能合约轻松交互
- **Dokobot 集成**：读取真实浏览器页面内容

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
npm run preview
```

## 🛠️ 技术栈

- Vite + React + TypeScript
- Tailwind CSS
- ethers.js v6
- Hardhat (合约部署)

## 📂 项目结构

```
web3-toolbox/
├── src/           # 源代码
├── contracts/     # 智能合约
├── scripts/       # 部署脚本
├── public/        # 静态资源
└── batch-transfer.cjs  # 批量转账脚本
```

## ⚡ 批量转账顺序

1. ETH 分发
2. ERC20 分发
3. ERC20 归集
4. ETH 归集

## 📝 License

MIT License - 详见 LICENSE 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
