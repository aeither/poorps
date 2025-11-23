import {
    AquaProtocolContract,
    AQUA_CONTRACT_ADDRESSES,
    Address,
    HexString,
    NetworkEnum
} from '@1inch/aqua-sdk';
import { encodeAbiParameters } from 'viem';
import 'dotenv/config';

// Load environment variables
const makerPrivateKey = process.env.MAKER_PRIVATE_KEY as unknown as `0x${string}`;
import { privateKeyToAddress } from 'viem/accounts';
const maker = privateKeyToAddress(makerPrivateKey);

// Sepolia addresses
const WETH = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const XYCSwap = '0x48393f1D300671CA9c8a8Ec7cfD973B4f87059E0'; // XYCSwap contract address
const AQUA = '0x499943E74FB0cE105688beeE8Ef2ABec5D936d31'; // Aqua contract address (Sepolia)

// Strategy data
const strategyData = {
    maker,
    token0: WETH,
    token1: USDC,
    feeBps: 0n,
    salt: '0x0000000000000000000000000000000000000000000000000000000000000010'
} as const;

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


import { http, createPublicClient } from 'viem';
import { sepolia } from 'viem/chains';

const publicClient = createPublicClient({ chain: sepolia, transport: http() });

const aquaAbi = [
        {
            type: 'function',
            name: 'safeBalances',
            inputs: [
                { name: 'maker', type: 'address' },
                { name: 'app', type: 'address' },
                { name: 'strategyHash', type: 'bytes32' },
                { name: 'token0', type: 'address' },
                { name: 'token1', type: 'address' }
            ],
            outputs: [
                { name: 'balance0', type: 'uint256' },
                { name: 'balance1', type: 'uint256' }
            ],
            stateMutability: 'view'
        }
    ];
    


async function main() {

    // Calculate strategy hash
    const strategyHash = AquaProtocolContract.calculateStrategyHash(new HexString(strategy)).toString();

    // Debug: Print rawBalances for both tokens
    const rawBalance0 = await publicClient.readContract({
        address: AQUA,
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
        args: [maker, XYCSwap, strategyHash, WETH]
    }) as [bigint, number];

    const rawBalance1 = await publicClient.readContract({
        address: AQUA,
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
        args: [maker, XYCSwap, strategyHash, USDC]
    }) as [bigint, number];
    console.log('Raw balances:', {
        WETH: rawBalance0,
        USDC: rawBalance1
    });

    // (removed duplicate declaration)

    // Aqua ABI fragment for safeBalances
    const aquaAbi = [
        {
            type: 'function',
            name: 'safeBalances',
            inputs: [
                { name: 'maker', type: 'address' },
                { name: 'app', type: 'address' },
                { name: 'strategyHash', type: 'bytes32' },
                { name: 'token0', type: 'address' },
                { name: 'token1', type: 'address' }
            ],
            outputs: [
                { name: 'balance0', type: 'uint256' },
                { name: 'balance1', type: 'uint256' }
            ],
            stateMutability: 'view'
        }
    ];

    // Call safeBalances using viem
    const [balance0, balance1] = await publicClient.readContract({
        address: AQUA,
        abi: aquaAbi,
        functionName: 'safeBalances',
        args: [maker, XYCSwap, strategyHash, WETH, USDC]
    }) as [bigint, bigint];
    console.log('Strategy balances:', {
        WETH: balance0.toString(),
        USDC: balance1.toString()
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
