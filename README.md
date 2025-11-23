# Poorps 🚀

**The Premier Memecoin Leverage Platform**

Poorps is a decentralized perpetual futures platform designed specifically for memecoins. We provide two distinct versions to cater to different trading needs and liquidity sources:

1.  **1Inch Aqua Version**: Leveraging 1Inch's Aqua for deep, credit-based liquidity and efficient execution.
2.  **vAMM Version**: Powered by **Chainlink** and **Pyth Network**, utilizing Virtual Automated Market Maker technology for infinite liquidity without external LPs.

## ⚠️ The Problem

Memecoins are the heartbeat of the crypto culture, but trading them efficiently is painful:
- **Fragmented Liquidity**: Deep liquidity is rare, leading to high slippage.
- **No Leverage**: Most platforms don't offer futures for smaller caps.
- **High Volatility**: Prices swing wildly, making spot trading risky without hedging tools.

## 💡 The Solutions

### Version 1: 1Inch Aqua
By integrating with **1Inch Aqua**, Poorps taps into a vast network of liquidity sources via a credit-based RFQ (Request for Quote) system. This ensures that traders get the best possible prices with minimal slippage, even for volatile memecoins.

### Version 2: Virtual AMMs (vAMM) with Chainlink & Pyth
For a fully decentralized, on-chain approach, our vAMM version allows for:
- **Infinite Liquidity**: Trades are executed against a virtual bonding curve ($x \cdot y = k$). No real assets are swapped, so there's no need for Liquidity Providers (LPs).
- **Price Discovery**: The internal vAMM acts as an independent price discovery mechanism.
- **Collateral Vault**: Users deposit collateral (e.g., USDC) into a vault. PnL is settled from this vault when positions are closed.
- **Oracle Integration**: We use **Pyth Network** for high-fidelity, low-latency price feeds and **Chainlink** for automation to ensure fair settlements and liquidations.

## ✨ Features

- **Long & Short**: Profit from both pumps and dumps.
- **Deep Liquidity**: Access deep markets via Aqua or vAMM.
- **Automated Liquidations**: Keep the protocol healthy with automated keeper bots.
- **Real-time Alerts**: Get Telegram notifications for position updates and liquidations.
- **Multi-Chain**: Built for EVM-compatible chains.

## 🏗 Architecture (vAMM Version)

### Smart Contracts (`foundry-contracts/`)
- **TestLiquidator.sol**: The core vAMM engine. Manages virtual reserves (`vEthReserve`, `vUsdcReserve`), position tracking, and PnL calculations.
- **Proxies**: `SetPositionProxy` and `LiquidateCollateralProxy` handle interactions from the workflow layer.

### Workflows (`poorps-workflow/`)
Powered by the **Chainlink Runtime Environment (CRE)**:
- **Oracle Fetcher**: Pulls real-time prices for SHIB, PEPE, and DEGEN from Pyth.
- **Liquidation Bot**: Monitors user positions on-chain.
- **Notification Service**: Sends updates to a Telegram channel.

## 🚀 Getting Started

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh/) or Node.js

### Smart Contracts

1. **Build Contracts**
   ```bash
   cd foundry-contracts
   forge build
   ```

2. **Run Tests**
   ```bash
   forge test
   ```

3. **Deploy**
   ```bash
   forge script script/Counter.s.sol:LiquidatorScript --rpc-url <your_rpc_url> --private-key <your_key> --broadcast
   ```

### Workflows

1. **Install Dependencies**
   ```bash
   cd poorps-workflow
   bun install
   ```

2. **Run Workflow**
   ```bash
   bun run start
   ```

## 📜 License

MIT
