import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

const maker = '0x955bc37114f42F0ABf209C81E41FEf5Cc53Cb51f' as `0x${string}`;
const taker = '0x0DBA585a86bb828708b14d2F83784564Ae03a5d0' as `0x${string}`;
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`; // Sepolia USDC
const WETH = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9' as `0x${string}`; // Sepolia WETH

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http()
});

async function checkBalances() {
  const accounts = [
    { name: 'Maker', address: maker },
    { name: 'Taker', address: taker }
  ];

  for (const account of accounts) {
    const ethBalance = await publicClient.getBalance({ address: account.address });
    console.log(`${account.name} ETH Balance: ${formatEther(ethBalance)} ETH`);

    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view'
        }
      ],
      functionName: 'balanceOf',
      args: [account.address]
    });
    console.log(`${account.name} USDC Balance: ${usdcBalance} (wei)`);

    // Check WETH balance
    const wethBalance = await publicClient.readContract({
      address: WETH,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view'
        }
      ],
      functionName: 'balanceOf',
      args: [account.address]
    });
    console.log(`${account.name} WETH Balance: ${wethBalance} (wei)`);
    console.log('---');
  }
}

checkBalances().catch(console.error);