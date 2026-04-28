import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SEPOLIA_RPC = 'https://eth-sepolia.api.onfinality.io/public';
const CONTRACT_ADDRESS = '0x86bc751FED4f53d51D3463637985FB1d6F7b0dB6';
const CONTRACT_ABI = [
  'function mint() external',
  'function totalMinted() external view returns (uint256)',
  'function getMintCount(address minter) external view returns (uint256)',
];

// 每个钱包发送0.02 ETH（足够5次mint + 余量）
const ETH_PER_WALLET = '0.02';

async function main() {
  // 读取测试钱包
  const wallets = JSON.parse(fs.readFileSync('./test-wallets.json', 'utf8'));
  
  // 主钱包（用于分发ETH）
  const privateKey = process.env.PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const mainWallet = new ethers.Wallet(privateKey, provider);
  
  console.log('主钱包:', mainWallet.address);
  const mainBalance = await provider.getBalance(mainWallet.address);
  console.log('主钱包余额:', ethers.formatEther(mainBalance), 'ETH');
  
  // 计算需要的总ETH
  const totalNeeded = ethers.parseEther(ETH_PER_WALLET) * BigInt(wallets.length);
  console.log(`\n需要分发: ${ethers.formatEther(totalNeeded)} ETH (${ETH_PER_WALLET} x ${wallets.length})`);
  
  if (mainBalance < totalNeeded + ethers.parseEther('0.01')) {
    console.error('❌ 主钱包余额不足');
    process.exit(1);
  }
  
  // 步骤1: 分发ETH到10个钱包
  console.log('\n📤 步骤1: 分发ETH到10个钱包...');
  for (const wallet of wallets) {
    try {
      const tx = await mainWallet.sendTransaction({
        to: wallet.address,
        value: ethers.parseEther(ETH_PER_WALLET),
      });
      console.log(`✓ 已发送 ${ETH_PER_WALLET} ETH 到 ${wallet.name} (${wallet.address.slice(0, 10)}...)`);
      await tx.wait();
    } catch (error) {
      console.error(`✗ 发送失败: ${wallet.name}`, error.message);
    }
  }
  
  // 步骤2: 每个钱包执行5次mint
  console.log('\n🎫 步骤2: 每个钱包执行5次mint...');
  
  const results = [];
  
  for (const wallet of wallets) {
    console.log(`\n处理 ${wallet.name}...`);
    
    const walletSigner = new ethers.Wallet(wallet.privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, walletSigner);
    
    let minted = 0;
    let failed = 0;
    
    for (let i = 0; i < 5; i++) {
      try {
        // 检查当前mint次数
        const count = await contract.getMintCount(wallet.address);
        if (count >= 5) {
          console.log(`  ✓ 已达上限 (${count}/5)`);
          break;
        }
        
        console.log(`  Mint ${i + 1}/5...`);
        const tx = await contract.mint();
        await tx.wait();
        
        minted++;
        console.log(`  ✓ Mint成功! Tx: ${tx.hash.slice(0, 16)}...`);
        
        // 等待一下避免nonce问题
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (error) {
        failed++;
        console.error(`  ✗ Mint失败:`, error.message.slice(0, 50));
      }
    }
    
    results.push({
      wallet: wallet.name,
      address: wallet.address,
      minted,
      failed,
    });
  }
  
  // 打印结果汇总
  console.log('\n' + '='.repeat(50));
  console.log('📊 执行结果汇总:');
  console.log('='.repeat(50));
  
  let totalMinted = 0;
  let totalFailed = 0;
  
  results.forEach(r => {
    console.log(`${r.wallet}: Mint ${r.minted}/5, 失败 ${r.failed}`);
    totalMinted += r.minted;
    totalFailed += r.failed;
  });
  
  console.log('='.repeat(50));
  console.log(`总计: 成功 ${totalMinted} 次, 失败 ${totalFailed} 次`);
  
  // 保存结果
  fs.writeFileSync('./mint-results.json', JSON.stringify(results, null, 2));
  console.log('\n结果已保存到 mint-results.json');
}

main().catch(console.error);
