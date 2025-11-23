export const TestLiquidator = [
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address"
      }
    ],
    name: "isLiquidatable",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address"
      }
    ],
    name: "liquidateCollateral",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address"
      },
      {
        internalType: "bool",
        name: "isLiquidatable",
        type: "bool"
      },
      {
        internalType: "uint256",
        name: "collateralAmount",
        type: "uint256"
      }
    ],
    name: "setPosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "positions",
    outputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        internalType: "bool",
        name: "liquidatable",
        type: "bool"
      },
      {
        internalType: "uint256",
        name: "collateralAmount",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address"
      },
      {
        indexed: false,
        internalType: "bool",
        name: "liquidatable",
        type: "bool"
      }
    ],
    name: "LiquidatableStateChanged",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "collateralAmount",
        type: "uint256"
      }
    ],
    name: "PositionLiquidated",
    type: "event"
  }
] as const

