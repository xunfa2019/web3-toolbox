import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// BscInscription 合约 ABI 和 Bytecode
const CONTRACT_ABI = [
  "function mint() external",
  "function mintBatch(uint256 count) external",
  "function getMintCount(address minter) external view returns (uint256)",
  "function getRemainingMints(address minter) external view returns (uint256)",
  "function totalMinted() external view returns (uint256)",
  "function MAX_SUPPLY() external view returns (uint256)",
  "function MAX_PER_WALLET() external view returns (uint256)",
  "function AMOUNT_PER_INSCRIPTION() external view returns (uint256)",
  "event InscriptionMinted(uint256 indexed id, address indexed minter, uint256 amount, string inscriptionData, uint256 timestamp)"
];

// Sepolia RPC
const SEPOLIA_RPC = "https://eth-sepolia.api.onfinality.io/public";

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
    console.error("余额不足，请先获取 Sepolia ETH");
    console.log("获取方式: https://sepoliafaucet.com/");
    process.exit(1);
  }

  // 合约字节码（需要从 Solidity 编译）
  // 这里使用简化版本，实际需要编译
  console.log("\n⚠️ 注意: 需要先编译合约获取字节码");
  console.log("请运行: npx hardhat compile");
  console.log("然后从 artifacts/contracts/BscInscription.sol/BscInscription.json 获取 bytecode");
  
  // 读取编译后的合约
  try {
    const artifact = JSON.parse(
      fs.readFileSync("artifacts/contracts/BscInscription.sol/BscInscription.json", "utf8")
    );
    
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
    
    // 验证合约信息
    console.log("\n📋 合约信息:");
    console.log("- MAX_SUPPLY:", (await contract.MAX_SUPPLY()).toString());
    console.log("- MAX_PER_WALLET:", (await contract.MAX_PER_WALLET()).toString());
    console.log("- AMOUNT_PER_INSCRIPTION:", (await contract.AMOUNT_PER_INSCRIPTION()).toString());
    
  } catch (error) {
    console.log("\n❌ 未找到编译产物，请先编译合约:");
    console.log("npx hardhat compile");
  }
}

main().catch(console.error);
