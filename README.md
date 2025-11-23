
<div align="center">
    <img src="https://github.com/user-attachments/assets/6236ffc4-c476-4f5b-ae6e-50177f60d91b" alt="Logo" width="600">
</div>

# Poorps 🚀

> A decentralized perpetual futures platform for memecoins featuring 1Inch Aqua and Pyth-powered vAMM.

1Inch Aqua Folder in `1inch-aqua`

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
- **Liquidator.sol**: The core vAMM engine. Manages virtual reserves (`vEthReserve`, `vUsdcReserve`), position tracking, and PnL calculations.
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

## 🛠 How it's made

Poorps (vAMM Version) is built on a **Virtual Automated Market Maker (vAMM)** architecture inspired by the constant product formula ($x \cdot y = k$). We used **Solidity** to implement the core engine (`Liquidator`), which manages virtual reserves and tracks user positions (Long/Short) without requiring physical liquidity providers.

The automation layer is powered by the **Chainlink Runtime Environment (CRE)**. We wrote a custom TypeScript workflow that acts as an autonomous keeper. It periodically fetches real-time memecoin prices (SHIB, PEPE, DEGEN) from **Pyth Network**, checks the health of on-chain positions on **Base Sepolia**, and executes liquidations or updates seamlessly.

**Partner Technologies:**
*   **Chainlink CRE:** Enabled us to move complex logic (price fetching + health checks) off-chain, saving gas and allowing easy integration with Web2 services like Telegram for real-time alerts.
*   **Pyth Network:** Provided the sub-second latency price feeds required to handle the extreme volatility of memecoins.
*   **1inch Aqua:** Utilized in our credit-based version (separate repo) to solve liquidity fragmentation. It allows for shared liquidity strategies where assets remain in user wallets, maximizing capital efficiency for leveraged memecoin trading without locking funds in traditional pools. 

**Notable/Hacky:**
We implemented a "virtual" bonding curve where the price discovery mechanism is mathematically decoupled from the collateral vault. The hackiest part is our simulation loop: the CRE workflow toggles the smart contract between "opening positions" and "liquidating" them, creating a self-sustaining demo that showcases the entire lifecycle live without waiting for actual market crashes.

## Implementation

https://github.com/aeither/poorps/blob/6c74fde69b042e2b24629d1ff69fd20c316df62f/poorps-workflow/main.ts#L101

we implemented pyth pricing, for liquididation and for user notification