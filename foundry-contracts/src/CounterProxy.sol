// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IReceiverTemplate.sol";
import "./Counter.sol";

contract CounterProxy is IReceiverTemplate {
    Counter public counter;

    constructor(
        address _counter,
        address expectedAuthor,
        bytes10 expectedWorkflowName
    ) IReceiverTemplate(expectedAuthor, expectedWorkflowName) {
        counter = Counter(_counter);
    }

    /// @inheritdoc IReceiverTemplate
    /// @notice Override onReport to skip metadata validation (like UpdateReservesProxySimplified)
    function onReport(
        bytes calldata metadata,
        bytes calldata report
    ) external override {
        _processReport(report);
    }

    /// @inheritdoc IReceiverTemplate
    function _processReport(bytes calldata report) internal override {
        // Assuming the report encodes a uint256 to set the counter
        uint256 newNumber = abi.decode(report, (uint256));
        counter.setNumber(newNumber);
    }
}

