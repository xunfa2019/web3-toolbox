import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// Sepolia 测试网 RPC
const SEPOLIA_RPC = "https://eth-sepolia.api.onfinality.io/public";

// BscInscription 合约 ABI
const ABI = [
  "function mint() external",
  "function mintBatch(uint256 count) external",
  "function getMintCount(address minter) external view returns (uint256)",
  "function getRemainingMints(address minter) external view returns (uint256)",
  "function totalMinted() external view returns (uint256)",
  "function MAX_SUPPLY() external view returns (uint256)",
  "function MAX_PER_WALLET() external view returns (uint256)",
  "function AMOUNT_PER_INSCRIPTION() external view returns (uint256)",
  "function mintRecords(uint256) external view returns (uint256 id, address minter, uint256 timestamp, string inscriptionData)",
  "event InscriptionMinted(uint256 indexed id, address indexed minter, uint256 amount, string inscriptionData, uint256 timestamp)"
];

// 合约字节码（简化版，直接编码合约逻辑）
// 这是一个简化版本，完整版本需要编译 Solidity
const BYTECODE = "0x608060405234801561001057600080fd5b50610001806100206000396000f3fe";

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("请在 .env 文件中设置 PRIVATE_KEY");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("开始部署 BscInscription 合约到 Sepolia...");
  console.log("部署账户:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");
  
  console.log("\n⚠️ 注意：需要先编译合约");
  console.log("请在另一个终端运行：");
  console.log("cd ~/Desktop/web3-toolbox && npx hardhat compile");
  console.log("\n然后我会读取编译产物并部署。");
}

main().catch(console.error);
