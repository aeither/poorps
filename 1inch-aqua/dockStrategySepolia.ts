import {
  AquaProtocolContract,
  Address,
  HexString,
    NetworkEnum,

  AQUA_CONTRACT_ADDRESSES
} from '@1inch/aqua-sdk';
import { encodeAbiParameters, http, createWalletClient, isHex } from 'viem';
import { privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import assert from 'node:assert';
import 'dotenv/config';

// Load environment variables
const makerPrivateKey = process.env.MAKER_PRIVATE_KEY as unknown as `0x${string}`;
assert(isHex(makerPrivateKey));
const maker = privateKeyToAddress(makerPrivateKey);

// Sepolia addresses
const WETH = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const APP = '0x1Edf00c015D42E5fD9e8226a45830e9069888A6a'; // Replace with deployed XYCSwap app address

// Strategy data
const strategyData = {
  maker,
  token0: WETH,
  token1: USDC,
  feeBps: 0n,
  salt: '0x0000000000000000000000000000000000000000000000000000000000000007'
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

//const aquaProtocolAddress = "0x69e79c21063140781680d4ffDC980520876aaEE6" as unknown as Address;
//const aqua = new AquaProtocolContract(aquaProtocolAddress);
const aqua = new AquaProtocolContract(AQUA_CONTRACT_ADDRESSES[NetworkEnum.ETHEREUM]);


async function main() {
  // Dock liquidity
  const dockTx = aqua.dock({
    app: new Address(APP),
    strategyHash: AquaProtocolContract.calculateStrategyHash(new HexString(strategy)),
    tokens: [new Address(USDC), new Address(WETH)]
  });

  const makerWallet = createWalletClient({
    chain: sepolia,
    transport: http(),
    account: privateKeyToAccount(makerPrivateKey)
  });

  const dockReceipt = await makerWallet.sendTransaction(dockTx);
  console.log('Dock tx sent:', dockReceipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
