import { createPublicClient, http, encodeAbiParameters, keccak256 } from 'viem';
import { sepolia } from 'viem/chains';

const maker = '0x955bc37114f42F0ABf209C81E41FEf5Cc53Cb51f' as `0x${string}`;
const app = '0x48393f1D300671CA9c8a8Ec7cfD973B4f87059E0' as `0x${string}`; // XYCSwap
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`; // Sepolia USDC
const WETH = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9' as `0x${string}`; // Sepolia WETH

const strategyData = {
  maker,
  token0: WETH,
  token1: USDC,
  feeBps: 0n,
  salt: '0x0000000000000000000000000000000000000000000000000000000000000013' as `0x${string}`
};

const strategy = encodeAbiParameters(
  [
    {
      name: 'strategy',
      type: 'tuple',
      components: [
        { name: 'maker', type: 'address' },
        { name: 'token0', type: 'address' },
        { name: 'token1', type: 'address' },
        { name: 'feeBps', type: 'uint256' },
        { name: 'salt', type: 'bytes32' }
      ]
    }
  ],
  [strategyData]
);

const strategyHash = keccak256(strategy);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http()
});

async function getAquaAddress() {
  const aquaAddress = await publicClient.readContract({
    address: app,
    abi: [
      {
        type: 'function',
        name: 'AQUA',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view'
      }
    ],
    functionName: 'AQUA'
  });
  return aquaAddress;
}

async function checkState() {
  const aquaAddress = await getAquaAddress();
  console.log('Aqua Address:', aquaAddress);
  const code = await publicClient.getCode({ address: aquaAddress as `0x${string}` });
  console.log('Aqua contract code length:', code?.length || 0);
  if (!code || code.length <= 2) {
    console.log('No contract deployed at this address.');
    return;
  }
  const tokens = [USDC, WETH];
  for (const token of tokens) {
    const result = await publicClient.readContract({
      address: aquaAddress,
      abi: [
        {
          type: 'function',
          name: 'rawBalances',
          inputs: [
            { name: 'maker', type: 'address' },
            { name: 'app', type: 'address' },
            { name: 'strategyHash', type: 'bytes32' },
            { name: 'token', type: 'address' }
          ],
          outputs: [
            { name: 'balance', type: 'uint248' },
            { name: 'tokensCount', type: 'uint8' }
          ],
          stateMutability: 'view'
        }
      ],
      functionName: 'rawBalances',
      args: [maker, app, strategyHash, token]
    });
    console.log(`Token: ${token}, Balance: ${result[0]}, TokensCount: ${result[1]}`);
  }
}

checkState().catch(console.error);