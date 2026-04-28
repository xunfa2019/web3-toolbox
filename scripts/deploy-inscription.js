import { ethers, network } from "hardhat";

async function main() {
  const networkName = network.name;
  console.log(`开始部署 BscInscription 合约到 ${networkName}...`);
  
  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  
  // 检查余额
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), networkName === "sepolia" ? "ETH" : "BNB");
  
  if (balance < ethers.parseEther("0.001")) {
    console.error("余额不足，请确保账户有足够的 ETH 支付 gas");
    process.exit(1);
  }
  
  // 部署合约
  console.log("\n正在部署 BscInscription 合约...");
  const BscInscription = await ethers.getContractFactory("BscInscription");
  const inscription = await BscInscription.deploy();
  
  await inscription.waitForDeployment();
  const contractAddress = await inscription.getAddress();
  
  console.log("\n✅ 部署成功!");
  console.log("合约地址:", contractAddress);
  console.log("交易哈希:", inscription.deploymentTransaction().hash);
  console.log("网络:", networkName);
  
  // 等待确认
  console.log("\n等待区块确认...");
  await inscription.deploymentTransaction().wait(3);
  
  console.log("\n📋 合约信息:");
  console.log("- 协议:", await inscription.PROTOCOL());
  console.log("- 代币符号:", await inscription.TICKER());
  console.log("- 单次 mint 数量:", (await inscription.AMOUNT_PER_INSCRIPTION()).toString());
  console.log("- 最大供应量:", (await inscription.MAX_SUPPLY()).toString());
  console.log("- 每钱包限制:", (await inscription.MAX_PER_WALLET()).toString());
  
  // 区块浏览器链接
  let explorerUrl;
  if (networkName === "sepolia") {
    explorerUrl = `https://sepolia.etherscan.io/address/${contractAddress}`;
  } else if (networkName === "bsc") {
    explorerUrl = `https://bscscan.com/address/${contractAddress}`;
  } else if (networkName === "bscTestnet") {
    explorerUrl = `https://testnet.bscscan.com/address/${contractAddress}`;
  }
  
  console.log("\n🔗 区块浏览器链接:");
  console.log(explorerUrl);
  
  console.log("\n⚠️ 请更新前端配置:");
  console.log(`在 BscInscriptionMint.tsx 中将 contractAddress 更新为: ${contractAddress}`);
  
  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
