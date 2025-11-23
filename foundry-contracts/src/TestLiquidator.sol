// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

contract TestLiquidator {
    struct Position {
        address owner;
        bool liquidatable;
        uint collateralAmount;
    }

    // Map user address to position
    mapping(address => Position) public positions;

    // Events
    event LiquidatableStateChanged(address indexed user, bool liquidatable);
    event PositionLiquidated(address indexed user, uint collateralAmount);

    // Create or update a position and set liquidatable state
    function setPosition(address user, bool _isLiquidatable, uint collateralAmount) external {
        positions[user] = Position(user, _isLiquidatable, collateralAmount);
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
        positions[user].liquidatable = false;
        positions[user].collateralAmount = 0;
        emit PositionLiquidated(user, collateral);
        // Here you would add real liquidation logic to seize collateral and repay debt
    }
}

