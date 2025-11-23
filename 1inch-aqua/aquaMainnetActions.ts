import {
    AquaProtocolContract,
    Address,
    HexString,
    AQUA_CONTRACT_ADDRESSES,
    NetworkEnum,
    ShippedEvent,
    PulledEvent,
    PushedEvent,
    DockedEvent
  } from '@1inch/aqua-sdk';
  import {
    encodeAbiParameters,
    parseUnits,
    http,
    createWalletClient,
    isHex,
    encodeFunctionData,
    decodeAbiParameters,
    publicActions,
    createPublicClient
  } from 'viem';
  import { privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
  import { sepolia } from 'viem/chains';
  import assert from 'node:assert';
  import 'dotenv/config';
  
  // Addresses provided previously
  const makerPrivateKey = process.env.MAKER_PRIVATE_KEY as `0x${string}`;
  const takerPrivateKey = process.env.TAKER_PRIVATE_KEY as `0x${string}`;
  assert(isHex(makerPrivateKey));
  assert(isHex(takerPrivateKey));
  const maker = privateKeyToAddress(makerPrivateKey);
  const taker = privateKeyToAddress(takerPrivateKey);
  const app = '0x48393f1D300671CA9c8a8Ec7cfD973B4f87059E0' as `0x${string}`; // XYCSwap
  const routerAddress = '0xDA149F553F7AE3e517A190731d39699B844ba74b' as `0x${string}`; // TestTrader
  const WETH = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9' as `0x${string}`; // Sepolia WETH
  const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`; // Sepolia USDC
  
  // Define aquaAddress at the top of the script
  const aquaAddress = "0x499943e74fb0ce105688beee8ef2abec5d936d31" as `0x${string}`; // Aqua contract address
  
  // Strategy data
  const salt = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`;
  const strategyData = {
    maker,
    token0: WETH,
    token1: USDC,
    feeBps: 0n,
    salt
  } as const;
  
  // Correctly encode strategy using SDK utilities
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
  
  // Revert strategyHash to remain as HexString
  const strategyHash = AquaProtocolContract.calculateStrategyHash(new HexString(strategy));
  
  // Ensure Aqua contract initialization aligns with SDK best practices
  const aqua = new AquaProtocolContract(new Address(aquaAddress));
  
  async function shipLiquidity() {
    const shipTx = aqua.ship({
      app: new Address(app),
      strategy: new HexString(strategy),
      amountsAndTokens: [
        { token: new Address(USDC), amount: parseUnits('5', 6) },
        { token: new Address(WETH), amount: parseUnits('0.02', 18) }
      ]
    });
    const wallet = createWalletClient({
      chain: sepolia,
      transport: http(),
      account: privateKeyToAccount(makerPrivateKey)
    });
  
    // Add detailed debugging logs before and after the ship call
    console.log('Preparing to ship liquidity with the following parameters:');
    console.log('App Address:', app);
    console.log('Strategy:', strategy);
    console.log('Amounts and Tokens:', [
      { token: new Address(USDC), amount: parseUnits('5', 6) },
      { token: new Address(WETH), amount: parseUnits('0.02', 18) }
    ]);
  
    try {
      const receipt = await wallet.sendTransaction(shipTx);
      console.log('Ship transaction sent successfully:', receipt);
    } catch (error) {
      console.error('Ship transaction failed:', error);
      if (error instanceof Error && 'cause' in error) {
        console.error('Error cause:', (error as any).cause);
      }
      throw error;
    }
  }
  
  async function swapLiquidity() {
    const wallet = createWalletClient({
      chain: sepolia,
      transport: http(),
      account: privateKeyToAccount(takerPrivateKey)
    }).extend(publicActions);
  
    const [decodedStrategy] = decodeAbiParameters(
      [
        {
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
      strategy
    );
    const srcAmount = parseUnits('5', 6); // 5 USDC
    const srcToken = USDC;
    const isZeroForOne = decodedStrategy.token0 === srcToken;
    // Add debugging logs before the swap call
    console.log('Decoded Strategy:', decodedStrategy);
    console.log('Source Token:', srcToken);
    console.log('Source Amount:', srcAmount);
    console.log('App Address:', app);
    console.log('Router Address:', routerAddress);
  
    // Check balances in Aqua protocol
    const [balance0, balance1] = await publicClient.readContract({
      address: aquaAddress,
      abi: [
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
      ],
      functionName: 'safeBalances',
      args: [maker, app, strategyHashForArgs, decodedStrategy.token0, decodedStrategy.token1]
    });
    console.log('Aqua Balances:', { balance0, balance1 });
  
    const swapData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'swap',
          inputs: [
            { name: 'app', type: 'address' },
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
            },
            { name: 'zeroForOne', type: 'bool' },
            { name: 'amountIn', type: 'uint256' }
          ],
          outputs: [{ name: 'amountOut', type: 'uint256' }],
          stateMutability: 'nonpayable'
        }
      ],
      functionName: 'swap',
      args: [app, decodedStrategy, isZeroForOne, srcAmount]
    });
    // Add detailed logging for swapData and transaction parameters
    console.log('Swap Data:', swapData);
    console.log('Transaction Parameters:', {
      to: routerAddress,
      data: swapData,
      from: wallet.account.address,
      chain: wallet.chain
    });
    await wallet.writeContract({
      abi: [
        {
          type: 'function',
          name: 'approve',
          inputs: [
            { name: 'spender', type: 'address', internalType: 'address' },
            { name: 'value', type: 'uint256', internalType: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
          stateMutability: 'nonpayable'
        }
      ],
      address: srcToken,
      account: wallet.account,
      functionName: 'approve',
      chain: wallet.chain,
      args: [routerAddress, srcAmount]
    });
    // Add logging to verify token approvals and balances
    console.log('Verifying token approvals and balances...');
    const allowance = await wallet.readContract({
      address: srcToken,
      abi: [
        {
          type: 'function',
          name: 'allowance',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view'
        }
      ],
      functionName: 'allowance',
      args: [wallet.account.address, routerAddress]
    });
    console.log('Allowance for router:', allowance);
    const balance = await wallet.readContract({
      address: srcToken,
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
      args: [wallet.account.address]
    });
    console.log('Balance of source token:', balance);
  
    // Add simulation for swapExactIn to debug the revert reason
    console.log('Simulating swapExactIn...');
    try {
      const simulationResult = await wallet.simulateContract({
        address: routerAddress,
        abi: [
          {
            type: 'function',
            name: 'swapExactIn',
            inputs: [
              { name: 'strategy', type: 'tuple', components: [
                { name: 'maker', type: 'address' },
                { name: 'token0', type: 'address' },
                { name: 'token1', type: 'address' },
                { name: 'feeBps', type: 'uint256' },
                { name: 'salt', type: 'bytes32' }
              ] },
              { name: 'zeroForOne', type: 'bool' },
              { name: 'amountIn', type: 'uint256' },
              { name: 'amountOutMin', type: 'uint256' },
              { name: 'to', type: 'address' },
              { name: 'takerData', type: 'bytes' }
            ],
            outputs: [{ name: 'amountOut', type: 'uint256' }],
            stateMutability: 'nonpayable'
          }
        ],
        functionName: 'swapExactIn',
        args: [decodedStrategy, isZeroForOne, srcAmount, amountOutMin, wallet.account.address, takerData]
      });
      console.log('Simulation successful:', simulationResult);
    } catch (error) {
      console.error('Simulation failed:', error);
    }
  
    const swapTx = await wallet.sendTransaction({
      to: routerAddress,
      data: swapData
    });
    console.log('Swap tx sent:', swapTx);
    await wallet.waitForTransactionReceipt({ hash: swapTx });
  }
  
  async function dockLiquidity() {
    const dockTx = aqua.dock({
      app: new Address(app),
      strategyHash,
      tokens: [new Address(USDC), new Address(WETH)]
    });
    const wallet = createWalletClient({
      chain: sepolia,
      transport: http(),
      account: privateKeyToAccount(makerPrivateKey)
    });
    const receipt = await wallet.sendTransaction(dockTx);
    console.log('Dock tx sent:', receipt);
  }
  
  async function transferWETH() {
    const wallet = createWalletClient({
      chain: sepolia,
      transport: http(),
      account: privateKeyToAccount(takerPrivateKey)
    });
    await wallet.writeContract({
      address: WETH,
      abi: [
        {
          type: 'function',
          name: 'transfer',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ type: 'bool' }]
        }
      ],
      functionName: 'transfer',
      args: [maker, parseUnits('0.02', 18)]
    });
    console.log('Transferred 0.02 WETH from taker to maker');
  }
  
  // Convert strategyHash to string format for args
  const strategyHashForArgs = strategyHash.toString() as `0x${string}`;
  
  // Replace all usages of strategyHash in args with strategyHashForArgs
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http()
  });
  
  // Define missing variables for simulation
  const amountOutMin = 1n; // Minimum acceptable output amount
  const takerData = '0x';
  
  // Define missing variables
  const appAddress = "0x48393f1D300671CA9c8a8Ec7cfD973B4f87059E0";
  const token0 = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
  const token1 = USDC;
  const makerAddress = "0x0dba585a86bb828708b14d2f83784564ae03a5d0";
  const recipientAddress = "0x955bc37114f42f0abf209c81e41fef5cc53cb51f";
  const amount0 = parseUnits('0.02', 18); // 0.02 WETH
  const amount1 = parseUnits('5', 6); // 5 USDC
  
  // Ensure all test functions are defined
  async function testShip() {
      try {
          console.log("Testing ship...");
          // First, approve tokens to Aqua
          const makerWallet = createWalletClient({
              chain: sepolia,
              transport: http(),
              account: privateKeyToAccount(makerPrivateKey)
          });
  
          // Approve WETH
          await makerWallet.writeContract({
              address: WETH,
              abi: [
                  {
                      "inputs": [
                          {"internalType": "address", "name": "spender", "type": "address"},
                          {"internalType": "uint256", "name": "amount", "type": "uint256"}
                      ],
                      "name": "approve",
                      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                      "stateMutability": "nonpayable",
                      "type": "function"
                  }
              ],
              functionName: 'approve',
              args: [aquaAddress, parseUnits('10', 18)]
          });
          console.log("WETH approved");
  
          // Approve USDC
          await makerWallet.writeContract({
              address: USDC,
              abi: [
                  {
                      "inputs": [
                          {"internalType": "address", "name": "spender", "type": "address"},
                          {"internalType": "uint256", "name": "amount", "type": "uint256"}
                      ],
                      "name": "approve",
                      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                      "stateMutability": "nonpayable",
                      "type": "function"
                  }
              ],
              functionName: 'approve',
              args: [aquaAddress, parseUnits('10000', 6)]
          });
          console.log("USDC approved");
  
          const shipTx = aqua.ship({
              app: new Address(appAddress),
              strategy: new HexString(strategy),
              amountsAndTokens: [
                  { token: new Address(token0), amount: amount0 },
                  { token: new Address(token1), amount: amount1 }
              ]
          });
          const receipt = await makerWallet.sendTransaction(shipTx);
          await publicClient.waitForTransactionReceipt({ hash: receipt });
          console.log("Ship successful:", receipt);
      } catch (error) {
          console.error("Ship failed:", error);
      }
  }
  
  async function testDock() {
      try {
          console.log("Testing dock...");
          const makerWallet = createWalletClient({
              chain: sepolia,
              transport: http(),
              account: privateKeyToAccount(makerPrivateKey)
          });
          const dockTx = aqua.dock({
              app: new Address(appAddress),
              strategyHash: strategyHash,
              tokens: [new Address(token0), new Address(token1)]
          });
          const receipt = await makerWallet.sendTransaction(dockTx);
          await publicClient.waitForTransactionReceipt({ hash: receipt });
          console.log("Dock successful:", receipt);
      } catch (error) {
          console.error("Dock failed:", error);
      }
  }
  
  async function testPull() {
      try {
          console.log("Testing pull...");
          const takerWallet = createWalletClient({
              chain: sepolia,
              transport: http(),
              account: privateKeyToAccount(takerPrivateKey)
          });
          const pullTx = await takerWallet.writeContract({
              address: aquaAddress,
              abi: [
                  {
                      "inputs": [
                          {"internalType": "address", "name": "maker", "type": "address"},
                          {"internalType": "address", "name": "app", "type": "address"},
                          {"internalType": "bytes32", "name": "strategyHash", "type": "bytes32"},
                          {"internalType": "address", "name": "token", "type": "address"},
                          {"internalType": "uint256", "name": "amount", "type": "uint256"}
                      ],
                      "name": "pull",
                      "outputs": [],
                      "stateMutability": "nonpayable",
                      "type": "function"
                  }
              ],
              functionName: 'pull',
              args: [maker, appAddress, strategyHashForArgs, WETH, parseUnits('0.02', 18)]
          });
          await publicClient.waitForTransactionReceipt({ hash: pullTx });
          console.log("Pull successful:", pullTx);
      } catch (error) {
          console.error("Pull failed:", error);
      }
  }
  
  async function testPush() {
      try {
          console.log("Testing push...");
          // Check balances before swap
          console.log("Checking balances before swap...");
          const publicClient = createPublicClient({
              chain: sepolia,
              transport: http()
          });
          const balance0 = await publicClient.readContract({
              address: aquaAddress,
              abi: [
                  {
                      "inputs": [
                          {"internalType": "address", "name": "maker", "type": "address"},
                          {"internalType": "address", "name": "app", "type": "address"},
                          {"internalType": "bytes32", "name": "strategyHash", "type": "bytes32"},
                          {"internalType": "address", "name": "token", "type": "address"}
                      ],
                      "name": "rawBalances",
                      "outputs": [
                          {"internalType": "uint248", "name": "balance", "type": "uint248"},
                          {"internalType": "uint8", "name": "tokensCount", "type": "uint8"}
                      ],
                      "stateMutability": "view",
                      "type": "function"
                  }
              ],
              functionName: 'rawBalances',
              args: [maker, appAddress, strategyHash.toString(), token0]
          });
          const balance1 = await publicClient.readContract({
              address: aquaAddress,
              abi: [
                  {
                      "inputs": [
                          {"internalType": "address", "name": "maker", "type": "address"},
                          {"internalType": "address", "name": "app", "type": "address"},
                          {"internalType": "bytes32", "name": "strategyHash", "type": "bytes32"},
                          {"internalType": "address", "name": "token", "type": "address"}
                      ],
                      "name": "rawBalances",
                      "outputs": [
                          {"internalType": "uint248", "name": "balance", "type": "uint248"},
                          {"internalType": "uint8", "name": "tokensCount", "type": "uint8"}
                      ],
                      "stateMutability": "view",
                      "type": "function"
                  }
              ],
              functionName: 'rawBalances',
              args: [maker, appAddress, strategyHash.toString(), token1]
          });
          console.log("WETH balance:", balance0[0].toString());
          console.log("USDC balance:", balance1[0].toString());
          console.log("Tokens count:", balance0[1].toString());
  
          // Check maker WETH balance
          const makerWethBalance = await publicClient.readContract({
              address: WETH,
              abi: [{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
              functionName: 'balanceOf',
              args: [maker]
          });
          console.log("Maker WETH balance:", makerWethBalance.toString());
          if (makerWethBalance < parseUnits('0.01', 18)) {
              throw new Error("Maker has insufficient WETH balance for transfer. Please fund the maker account with at least 0.01 WETH.");
          }
  
          // Transfer some WETH from maker to taker
          const makerWallet = createWalletClient({
              chain: sepolia,
              transport: http(),
              account: privateKeyToAccount(makerPrivateKey)
          });
  
          await makerWallet.writeContract({
              address: WETH,
              abi: [
                  {
                      "inputs": [
                          {"internalType": "address", "name": "to", "type": "address"},
                          {"internalType": "uint256", "name": "amount", "type": "uint256"}
                      ],
                      "name": "transfer",
                      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                      "stateMutability": "nonpayable",
                      "type": "function"
                  }
              ],
              functionName: 'transfer',
              args: [taker, parseUnits('0.01', 18)]
          });
          console.log("WETH transferred to taker");
  
          // Approve AQUA for WETH from taker
          const takerWallet = createWalletClient({
              chain: sepolia,
              transport: http(),
              account: privateKeyToAccount(takerPrivateKey)
          });
  
          const approveTx = await takerWallet.writeContract({
              address: WETH,
              abi: [
                  {
                      "inputs": [
                          {"internalType": "address", "name": "spender", "type": "address"},
                          {"internalType": "uint256", "name": "amount", "type": "uint256"}
                      ],
                      "name": "approve",
                      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                      "stateMutability": "nonpayable",
                      "type": "function"
                  }
              ],
              functionName: 'approve',
              args: [aquaAddress, parseUnits('0.01', 18)]
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
          console.log("WETH approved to AQUA");
  
          // Now call push
          const pushTx = await takerWallet.writeContract({
              address: aquaAddress,
              abi: [
                  {
                      "inputs": [
                          {"internalType": "address", "name": "maker", "type": "address"},
                          {"internalType": "address", "name": "app", "type": "address"},
                          {"internalType": "bytes32", "name": "strategyHash", "type": "bytes32"},
                          {"internalType": "address", "name": "token", "type": "address"},
                          {"internalType": "uint256", "name": "amount", "type": "uint256"}
                      ],
                      "name": "push",
                      "outputs": [],
                      "stateMutability": "nonpayable",
                      "type": "function"
                  }
              ],
              functionName: 'push',
              args: [maker, appAddress, strategyHashForArgs, WETH, parseUnits('0.01', 18)]
          });
          await publicClient.waitForTransactionReceipt({ hash: pushTx });
          console.log("Push successful:", pushTx);
      } catch (error) {
          console.error("Push failed:", error);
      }
  }
  
  (async () => {
      console.log("Starting Aqua actions test...");
      await testShip();
      await testPull();
      await testPush();
      await testDock();
      console.log("Aqua actions test completed.");
  })();
  