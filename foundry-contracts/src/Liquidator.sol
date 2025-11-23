// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

contract Liquidator {
    struct Position {
        address owner;
        bool liquidatable;
        uint256 collateralAmount;
        int256 size;        // Positive for Long, Negative for Short (in vETH)
        uint256 entryValue; // For Long: Cost to buy. For Short: Value received from sell.
    }

    // Map user address to position
    mapping(address => Position) public positions;

    // Virtual Reserves
    uint256 public vEthReserve;
    uint256 public vUsdcReserve;
    uint256 public k;

    // Events
    event LiquidatableStateChanged(address indexed user, bool liquidatable);
    event PositionLiquidated(address indexed user, uint collateralAmount);
    event PositionOpened(address indexed user, int256 size, uint256 entryValue, uint256 collateral);
    event PositionClosed(address indexed user, int256 size, uint256 exitValue, int256 pnl);

    constructor() {
        // Initialize vAMM with some liquidity
        // 100 ETH @ 2000 USDC/ETH
        vEthReserve = 100 * 1e18; 
        vUsdcReserve = 200000 * 1e18;
        k = vEthReserve * vUsdcReserve;
    }

    // Create or update a position and set liquidatable state (Legacy/Mock)
    function setPosition(address user, bool _isLiquidatable, uint collateralAmount) external {
        Position storage pos = positions[user];
        pos.owner = user;
        pos.liquidatable = _isLiquidatable;
        pos.collateralAmount = collateralAmount;
        // Preserve existing size/entryValue if this is just an update to flags
        emit LiquidatableStateChanged(user, _isLiquidatable);
    }

    // Read if a position is liquidatable
    function isLiquidatable(address user) external view returns (bool) {
        return positions[user].liquidatable;
    }

    // Liquidate the collateral if liquidatable
    function liquidateCollateral(address user) external {
        require(positions[user].liquidatable, "Position not liquidatable");
        uint collateral = positions[user].collateralAmount;
        // Reset position
        delete positions[user]; // Clears everything including size
        emit PositionLiquidated(user, collateral);
    }

    // --- vAMM Logic ---

    // Open a position
    // sizeDelta: Amount of vETH to buy (+) or sell (-)
    // collateral: Collateral to add
    function openPosition(int256 sizeDelta, uint256 collateral) external {
        require(sizeDelta != 0, "Size cannot be zero");
        
        Position storage pos = positions[msg.sender];
        pos.owner = msg.sender;
        pos.collateralAmount += collateral;

        uint256 costOrCredit;

        if (sizeDelta > 0) {
            // Long: Buy vETH
            uint256 dx = uint256(sizeDelta);
            require(dx < vEthReserve, "Not enough liquidity");
            
            uint256 newVEth = vEthReserve - dx;
            uint256 newVUsdc = k / newVEth;
            uint256 cost = newVUsdc - vUsdcReserve;
            
            vEthReserve = newVEth;
            vUsdcReserve = newVUsdc;
            
            pos.entryValue += cost;
            costOrCredit = cost;
        } else {
            // Short: Sell vETH
            uint256 dx = uint256(-sizeDelta);
            
            uint256 newVEth = vEthReserve + dx;
            uint256 newVUsdc = k / newVEth;
            uint256 credit = vUsdcReserve - newVUsdc;
            
            vEthReserve = newVEth;
            vUsdcReserve = newVUsdc;
            
            pos.entryValue += credit;
            costOrCredit = credit;
        }

        pos.size += sizeDelta;
        
        // For demo, assume position is open implies not liquidatable immediately unless logic added
        // pos.liquidatable = false; 

        emit PositionOpened(msg.sender, sizeDelta, costOrCredit, pos.collateralAmount);
    }

    // Close position
    function closePosition() external {
        Position storage pos = positions[msg.sender];
        require(pos.size != 0, "No position");
        
        int256 currentSize = pos.size;
        uint256 exitValue;
        int256 pnl;

        if (currentSize > 0) {
            // Closing Long: Sell vETH
            uint256 dx = uint256(currentSize);
            uint256 newVEth = vEthReserve + dx;
            uint256 newVUsdc = k / newVEth;
            exitValue = vUsdcReserve - newVUsdc;
            
            vEthReserve = newVEth;
            vUsdcReserve = newVUsdc;

            // PnL = Exit Value - Entry Cost
            if (exitValue >= pos.entryValue) {
                pnl = int256(exitValue - pos.entryValue);
            } else {
                pnl = -int256(pos.entryValue - exitValue);
            }
        } else {
            // Closing Short: Buy vETH
            uint256 dx = uint256(-currentSize);
            require(dx < vEthReserve, "Not enough liquidity to close short"); // Should be fine if k is constant

            uint256 newVEth = vEthReserve - dx;
            uint256 newVUsdc = k / newVEth;
            uint256 costToBuyBack = newVUsdc - vUsdcReserve;
            
            vEthReserve = newVEth;
            vUsdcReserve = newVUsdc;

            // PnL = Entry Credit - Cost to Buy Back
            if (pos.entryValue >= costToBuyBack) {
                pnl = int256(pos.entryValue - costToBuyBack);
            } else {
                pnl = -int256(costToBuyBack - pos.entryValue);
            }
        }

        // Settle PnL
        if (pnl > 0) {
            pos.collateralAmount += uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            if (loss > pos.collateralAmount) {
                pos.collateralAmount = 0; // Bankrupt
            } else {
                pos.collateralAmount -= loss;
            }
        }

        emit PositionClosed(msg.sender, currentSize, exitValue, pnl);

        // Reset position details
        pos.size = 0;
        pos.entryValue = 0;
    }

    function getVirtualPrice() external view returns (uint256) {
        return (vUsdcReserve * 1e18) / vEthReserve;
    }
}
