export const CONTRACT_ADDRESSES = {
  donut: "0xAE4a37d554C6D6F3E398546d8566B25052e0169C",
  miner: "0xF69614F4Ee8D4D3879dd53d5A039eB3114C794F6",
  multicall: "0x7a85CA4b4E15df2a7b927Fa56edb050d2399B34c",
  provider: "0x3539bccca86de11575eb70997b136f9b30d21751",
} as const;

export const MULTICALL_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "provider",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "epochId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxPrice",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "uri",
        type: "string",
      },
    ],
    name: "mine",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "epochId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxPaymentTokenAmount",
        type: "uint256",
      },
    ],
    name: "buy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "getMiner",
    outputs: [
      {
        components: [
          {
            internalType: "uint16",
            name: "epochId",
            type: "uint16",
          },
          {
            internalType: "uint192",
            name: "initPrice",
            type: "uint192",
          },
          {
            internalType: "uint40",
            name: "startTime",
            type: "uint40",
          },
          {
            internalType: "uint256",
            name: "glazed",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "dps",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "nextDps",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "miner",
            type: "address",
          },
          {
            internalType: "string",
            name: "uri",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "ethBalance",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "wethBalance",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "donutBalance",
            type: "uint256",
          },
        ],
        internalType: "struct Multicall.MinerState",
        name: "state",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "getAuction",
    outputs: [
      {
        components: [
          {
            internalType: "uint16",
            name: "epochId",
            type: "uint16",
          },
          {
            internalType: "uint192",
            name: "initPrice",
            type: "uint192",
          },
          {
            internalType: "uint40",
            name: "startTime",
            type: "uint40",
          },
          {
            internalType: "address",
            name: "paymentToken",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "paymentTokenPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "wethAccumulated",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "wethBalance",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "paymentTokenBalance",
            type: "uint256",
          },
        ],
        internalType: "struct Multicall.AuctionState",
        name: "state",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
