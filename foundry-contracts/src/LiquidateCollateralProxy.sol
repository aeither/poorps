// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IReceiverTemplate.sol";
import "./Liquidator.sol";

contract LiquidateCollateralProxy is IReceiverTemplate {
    Liquidator public liquidator;

    constructor(
        address _liquidator,
        address expectedAuthor,
        bytes10 expectedWorkflowName
    ) IReceiverTemplate(expectedAuthor, expectedWorkflowName) {
        liquidator = Liquidator(_liquidator);
    }

    /// @inheritdoc IReceiverTemplate
    /// @notice Override onReport to skip metadata validation
    function onReport(
        bytes calldata /* metadata */,
        bytes calldata report
    ) external override {
        _processReport(report);
    }

    /// @inheritdoc IReceiverTemplate
    function _processReport(bytes calldata report) internal override {
        (address user) = abi.decode(report, (address));
        liquidator.liquidateCollateral(user);
    }
}

