// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {TestLiquidator} from "../src/TestLiquidator.sol";
import {SetPositionProxy} from "../src/SetPositionProxy.sol";
import {LiquidateCollateralProxy} from "../src/LiquidateCollateralProxy.sol";

contract LiquidatorScript is Script {
    TestLiquidator public liquidator;
    SetPositionProxy public setPositionProxy;
    LiquidateCollateralProxy public liquidateCollateralProxy;

    // You can override these values via environment variables or keep defaults
    address public expectedAuthor = 0x298418B27013E4E0A04F5695F5326D98c2370c36;
    // "my-workflow" encoded as bytes10
    bytes10 public expectedWorkflowName = 0x6d792d776f726b666c6f; 

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // 1. Deploy the Liquidator (Target)
        liquidator = new TestLiquidator();

        // 2. Deploy the Proxies
        setPositionProxy = new SetPositionProxy(
            address(liquidator),
            expectedAuthor,
            expectedWorkflowName
        );

        liquidateCollateralProxy = new LiquidateCollateralProxy(
            address(liquidator),
            expectedAuthor,
            expectedWorkflowName
        );

        vm.stopBroadcast();
    }
}
