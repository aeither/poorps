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
    function _processReport(bytes calldata report) internal override {
        // Assuming the report encodes a uint256 to set the counter
        uint256 newNumber = abi.decode(report, (uint256));
        counter.setNumber(newNumber);
    }
}

