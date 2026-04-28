import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// Sepolia RPC
const SEPOLIA_RPC = "https://eth-sepolia.api.onfinality.io/public";

// 合约 ABI 和字节码需要编译后获取
// 这里先创建一个简单版本

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("请在 .env 文件中设置 PRIVATE_KEY");
    process.exit(1);
  }

  // 连接到 Sepolia
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("部署账户:", wallet.address);
  
  // 检查余额
  const balance = await provider.getBalance(wallet.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.001")) {
    console.log("\n⚠️ 余额不足!");
    console.log("请访问以下水龙头获取 Sepolia ETH:");
    console.log("- https://sepoliafaucet.com/");
    console.log("- https://www.alchemy.com/faucets/ethereum-sepolia");
    console.log("- https://sepolia-faucet.pk910.de/");
    process.exit(1);
  }

  console.log("\n✅ 余额充足，可以部署合约");
  console.log("请运行: npx hardhat compile && npx hardhat run scripts/deploy.js --network sepolia");
}

main().catch(console.error);
