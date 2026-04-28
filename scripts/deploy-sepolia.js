import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const SEPOLIA_RPC = "https://eth-sepolia.api.onfinality.io/public";

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("请在 .env 文件中设置 PRIVATE_KEY");
    process.exit(1);
  }

  // 连接 Sepolia
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("开始部署 BscInscription 合约到 Sepolia...");
  console.log("部署账户:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");
  
  // 读取编译产物
  const artifactPath = "artifacts/contracts/BscInscription.sol/BscInscription.json";
  if (!fs.existsSync(artifactPath)) {
    console.error("未找到编译产物，请先运行: npx hardhat compile");
    process.exit(1);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  
  // 部署合约
  const ContractFactory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );
  
  console.log("\n正在部署合约...");
  const contract = await ContractFactory.deploy();
  
  console.log("交易哈希:", contract.deploymentTransaction().hash);
  console.log("等待确认...");
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log("\n✅ 部署成功!");
  console.log("合约地址:", address);
  console.log("Sepolia Etherscan:", `https://sepolia.etherscan.io/address/${address}`);
  
  // 验证合约
  console.log("\n📋 合约信息:");
  console.log("- MAX_SUPPLY:", (await contract.MAX_SUPPLY()).toString());
  console.log("- MAX_PER_WALLET:", (await contract.MAX_PER_WALLET()).toString());
  console.log("- AMOUNT_PER_INSCRIPTION:", (await contract.AMOUNT_PER_INSCRIPTION()).toString());
  
  console.log("\n⚠️ 请更新前端配置:");
  console.log(`contractAddress: "${address}"`);
}

main().catch(console.error);
