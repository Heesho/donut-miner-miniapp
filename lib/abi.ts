export const minerAbi = [
  { inputs: [], name: "getPrice", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getDps", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [],
    name: "getSlot0",
    outputs: [
      {
        components: [
          { name: "locked", type: "uint8" },
          { name: "epochId", type: "uint16" },
          { name: "initPrice", type: "uint192" },
          { name: "startTime", type: "uint40" },
          { name: "dps", type: "uint256" },
          { name: "miner", type: "address" },
          { name: "uri", type: "string" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "miner", type: "address" },
      { name: "provider", type: "address" },
      { name: "epochId", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "maxPrice", type: "uint256" },
      { name: "uri", type: "string" },
    ],
    name: "mine",
    outputs: [{ type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
] as const

export const multicallAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "getMiner",
    outputs: [
      {
        components: [
          { name: "epochId", type: "uint16" },
          { name: "initPrice", type: "uint192" },
          { name: "startTime", type: "uint40" },
          { name: "balance", type: "uint256" },
          { name: "donuts", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "dps", type: "uint256" },
          { name: "nextDps", type: "uint256" },
          { name: "miner", type: "address" },
          { name: "uri", type: "string" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const
