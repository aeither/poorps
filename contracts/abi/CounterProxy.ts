export const CounterProxy = [
  {
    inputs: [
      {
        internalType: "bytes",
        name: "metadata",
        type: "bytes"
      },
      {
        internalType: "bytes",
        name: "report",
        type: "bytes"
      }
    ],
    name: "onReport",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "counter",
    outputs: [
      {
        internalType: "contract Counter",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const


