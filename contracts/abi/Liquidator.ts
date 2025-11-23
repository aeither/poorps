export const Liquidator = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "bool", "name": "liquidatable", "type": "bool" }
    ],
    "name": "LiquidatableStateChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "int256", "name": "size", "type": "int256" },
      { "indexed": false, "internalType": "uint256", "name": "exitValue", "type": "uint256" },
      { "indexed": false, "internalType": "int256", "name": "pnl", "type": "int256" }
    ],
    "name": "PositionClosed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "collateralAmount", "type": "uint256" }
    ],
    "name": "PositionLiquidated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "int256", "name": "size", "type": "int256" },
      { "indexed": false, "internalType": "uint256", "name": "entryValue", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "collateral", "type": "uint256" }
    ],
    "name": "PositionOpened",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "closePosition",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getVirtualPrice",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "isLiquidatable",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "k",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "liquidateCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "int256", "name": "sizeDelta", "type": "int256" },
      { "internalType": "uint256", "name": "collateral", "type": "uint256" }
    ],
    "name": "openPosition",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "positions",
    "outputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "bool", "name": "liquidatable", "type": "bool" },
      { "internalType": "uint256", "name": "collateralAmount", "type": "uint256" },
      { "internalType": "int256", "name": "size", "type": "int256" },
      { "internalType": "uint256", "name": "entryValue", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "bool", "name": "_isLiquidatable", "type": "bool" },
      { "internalType": "uint256", "name": "collateralAmount", "type": "uint256" }
    ],
    "name": "setPosition",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "vEthReserve",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "vUsdcReserve",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const
