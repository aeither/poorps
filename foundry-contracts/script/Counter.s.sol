// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";
import {CounterProxy} from "../src/CounterProxy.sol";

contract CounterScript is Script {
    Counter public counter;
    CounterProxy public counterProxy;

    // You can override these values via environment variables or keep defaults
    address public expectedAuthor = 0x298418B27013E4E0A04F5695F5326D98c2370c36;
    // "my-workflow" encoded as bytes10
    bytes10 public expectedWorkflowName = 0x6d792d776f726b666c6f; 

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // 1. Deploy the Counter (Target)
        counter = new Counter();

        // 2. Deploy the Proxy with the Counter address and workflow config
        counterProxy = new CounterProxy(
            address(counter),
            expectedAuthor,
            expectedWorkflowName
        );

        vm.stopBroadcast();
    }
}
