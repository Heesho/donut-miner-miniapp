export const CONTRACT_ADDRESSES = {
  // Token addresses
  donut: "0xAE4a37d554C6D6F3E398546d8566B25052e0169C",
  weth: "0x4200000000000000000000000000000000000006",
  usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  donutEthLp: "0xD1DbB2E56533C55C3A637D13C53aeEf65c5D5703",

  // Mining contracts (original)
  miner: "0xF69614F4Ee8D4D3879dd53d5A039eB3114C794F6",
  minerMulticall: "0x3ec144554b484C6798A683E34c8e8E222293f323",
  provider: "0xba366c82815983ff130c23ced78bd95e1f2c18ea",

  // LSG (Liquid Signal Governance) contracts
  dao: "0x690C2e187c8254a887B35C0B4477ce6787F92855",
  governanceToken: "0xC78B6e362cB0f48b59E573dfe7C99d92153a16d3", // gDONUT
  voter: "0x9C5Cf3246d7142cdAeBBD5f653d95ACB73DdabA6",
  revenueRouter: "0x4799CBe9782265C0633d24c7311dD029090dED33",
  lsgMulticall: "0xB68F5446F7Cce3a83fa374D232022f21e4C58645",

} as const;

// Original miner multicall ABI
export const MINER_MULTICALL_ABI = [
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
            internalType: "uint256",
            name: "donutPrice",
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

// Keep backward compatibility
export const MULTICALL_ABI = MINER_MULTICALL_ABI;

// LSG Multicall ABI for reading voter/strategy data
export const LSG_MULTICALL_ABI = [
  // getVoterData
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "getVoterData",
    outputs: [
      {
        components: [
          { internalType: "address", name: "governanceToken", type: "address" },
          { internalType: "address", name: "revenueToken", type: "address" },
          { internalType: "address", name: "treasury", type: "address" },
          { internalType: "address", name: "underlyingToken", type: "address" },
          { internalType: "uint8", name: "underlyingTokenDecimals", type: "uint8" },
          { internalType: "uint256", name: "totalWeight", type: "uint256" },
          { internalType: "uint256", name: "strategyCount", type: "uint256" },
          { internalType: "uint256", name: "governanceTokenTotalSupply", type: "uint256" },
          { internalType: "uint256", name: "accountGovernanceTokenBalance", type: "uint256" },
          { internalType: "uint256", name: "accountUnderlyingTokenBalance", type: "uint256" },
          { internalType: "uint256", name: "accountUsedWeights", type: "uint256" },
          { internalType: "uint256", name: "accountLastVoted", type: "uint256" },
        ],
        internalType: "struct Multicall.VoterData",
        name: "data",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getStrategyData
  {
    inputs: [
      { internalType: "address", name: "strategy", type: "address" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "getStrategyData",
    outputs: [
      {
        components: [
          { internalType: "address", name: "strategy", type: "address" },
          { internalType: "address", name: "bribe", type: "address" },
          { internalType: "address", name: "bribeRouter", type: "address" },
          { internalType: "address", name: "paymentToken", type: "address" },
          { internalType: "address", name: "paymentReceiver", type: "address" },
          { internalType: "bool", name: "isAlive", type: "bool" },
          { internalType: "uint8", name: "paymentTokenDecimals", type: "uint8" },
          { internalType: "uint256", name: "strategyWeight", type: "uint256" },
          { internalType: "uint256", name: "votePercent", type: "uint256" },
          { internalType: "uint256", name: "claimable", type: "uint256" },
          { internalType: "uint256", name: "pendingRevenue", type: "uint256" },
          { internalType: "uint256", name: "routerRevenue", type: "uint256" },
          { internalType: "uint256", name: "totalPotentialRevenue", type: "uint256" },
          { internalType: "uint256", name: "epochPeriod", type: "uint256" },
          { internalType: "uint256", name: "priceMultiplier", type: "uint256" },
          { internalType: "uint256", name: "minInitPrice", type: "uint256" },
          { internalType: "uint256", name: "epochId", type: "uint256" },
          { internalType: "uint256", name: "initPrice", type: "uint256" },
          { internalType: "uint256", name: "startTime", type: "uint256" },
          { internalType: "uint256", name: "currentPrice", type: "uint256" },
          { internalType: "uint256", name: "revenueBalance", type: "uint256" },
          { internalType: "uint256", name: "accountVotes", type: "uint256" },
          { internalType: "uint256", name: "accountPaymentTokenBalance", type: "uint256" },
        ],
        internalType: "struct Multicall.StrategyData",
        name: "data",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getAllStrategiesData
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "getAllStrategiesData",
    outputs: [
      {
        components: [
          { internalType: "address", name: "strategy", type: "address" },
          { internalType: "address", name: "bribe", type: "address" },
          { internalType: "address", name: "bribeRouter", type: "address" },
          { internalType: "address", name: "paymentToken", type: "address" },
          { internalType: "address", name: "paymentReceiver", type: "address" },
          { internalType: "bool", name: "isAlive", type: "bool" },
          { internalType: "uint8", name: "paymentTokenDecimals", type: "uint8" },
          { internalType: "uint256", name: "strategyWeight", type: "uint256" },
          { internalType: "uint256", name: "votePercent", type: "uint256" },
          { internalType: "uint256", name: "claimable", type: "uint256" },
          { internalType: "uint256", name: "pendingRevenue", type: "uint256" },
          { internalType: "uint256", name: "routerRevenue", type: "uint256" },
          { internalType: "uint256", name: "totalPotentialRevenue", type: "uint256" },
          { internalType: "uint256", name: "epochPeriod", type: "uint256" },
          { internalType: "uint256", name: "priceMultiplier", type: "uint256" },
          { internalType: "uint256", name: "minInitPrice", type: "uint256" },
          { internalType: "uint256", name: "epochId", type: "uint256" },
          { internalType: "uint256", name: "initPrice", type: "uint256" },
          { internalType: "uint256", name: "startTime", type: "uint256" },
          { internalType: "uint256", name: "currentPrice", type: "uint256" },
          { internalType: "uint256", name: "revenueBalance", type: "uint256" },
          { internalType: "uint256", name: "accountVotes", type: "uint256" },
          { internalType: "uint256", name: "accountPaymentTokenBalance", type: "uint256" },
        ],
        internalType: "struct Multicall.StrategyData[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getBribeData
  {
    inputs: [
      { internalType: "address", name: "strategy", type: "address" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "getBribeData",
    outputs: [
      {
        components: [
          { internalType: "address", name: "strategy", type: "address" },
          { internalType: "address", name: "bribe", type: "address" },
          { internalType: "bool", name: "isAlive", type: "bool" },
          { internalType: "address[]", name: "rewardTokens", type: "address[]" },
          { internalType: "uint8[]", name: "rewardTokenDecimals", type: "uint8[]" },
          { internalType: "uint256[]", name: "rewardsPerToken", type: "uint256[]" },
          { internalType: "uint256[]", name: "accountRewardsEarned", type: "uint256[]" },
          { internalType: "uint256[]", name: "rewardsLeft", type: "uint256[]" },
          { internalType: "uint256", name: "voteWeight", type: "uint256" },
          { internalType: "uint256", name: "votePercent", type: "uint256" },
          { internalType: "uint256", name: "totalSupply", type: "uint256" },
          { internalType: "uint256", name: "accountVote", type: "uint256" },
        ],
        internalType: "struct Multicall.BribeData",
        name: "data",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getAllBribesData
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "getAllBribesData",
    outputs: [
      {
        components: [
          { internalType: "address", name: "strategy", type: "address" },
          { internalType: "address", name: "bribe", type: "address" },
          { internalType: "bool", name: "isAlive", type: "bool" },
          { internalType: "address[]", name: "rewardTokens", type: "address[]" },
          { internalType: "uint8[]", name: "rewardTokenDecimals", type: "uint8[]" },
          { internalType: "uint256[]", name: "rewardsPerToken", type: "uint256[]" },
          { internalType: "uint256[]", name: "accountRewardsEarned", type: "uint256[]" },
          { internalType: "uint256[]", name: "rewardsLeft", type: "uint256[]" },
          { internalType: "uint256", name: "voteWeight", type: "uint256" },
          { internalType: "uint256", name: "votePercent", type: "uint256" },
          { internalType: "uint256", name: "totalSupply", type: "uint256" },
          { internalType: "uint256", name: "accountVote", type: "uint256" },
        ],
        internalType: "struct Multicall.BribeData[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // distribute
  {
    inputs: [{ internalType: "address", name: "strategy", type: "address" }],
    name: "distribute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // distributeAll
  {
    inputs: [],
    name: "distributeAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // distributeAndBuy
  {
    inputs: [
      { internalType: "address", name: "strategy", type: "address" },
      { internalType: "uint256", name: "epochId", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint256", name: "maxPaymentAmount", type: "uint256" },
    ],
    name: "distributeAndBuy",
    outputs: [{ internalType: "uint256", name: "paymentAmount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // distributeAllAndBuy
  {
    inputs: [
      { internalType: "address", name: "strategy", type: "address" },
      { internalType: "uint256", name: "epochId", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint256", name: "maxPaymentAmount", type: "uint256" },
    ],
    name: "distributeAllAndBuy",
    outputs: [{ internalType: "uint256", name: "paymentAmount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getStrategies
  {
    inputs: [],
    name: "getStrategies",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  // getStrategyCount
  {
    inputs: [],
    name: "getStrategyCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Voter contract ABI (for voting functions)
export const VOTER_ABI = [
  // vote
  {
    inputs: [
      { internalType: "address[]", name: "_strategies", type: "address[]" },
      { internalType: "uint256[]", name: "_weights", type: "uint256[]" },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // reset
  {
    inputs: [],
    name: "reset",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // claimBribes
  {
    inputs: [{ internalType: "address[]", name: "_bribes", type: "address[]" }],
    name: "claimBribes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // View functions
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "account_UsedWeights",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "account_LastVoted",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "getStrategyVote",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DURATION",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// GovernanceToken ABI (for staking/unstaking and delegation)
export const GOVERNANCE_TOKEN_ABI = [
  // stake
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "stake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // unstake
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "unstake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ERC20Votes delegation functions
  {
    inputs: [{ internalType: "address", name: "delegatee", type: "address" }],
    name: "delegate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "delegatee", type: "address" },
      { internalType: "uint256", name: "nonce", type: "uint256" },
      { internalType: "uint256", name: "expiry", type: "uint256" },
      { internalType: "uint8", name: "v", type: "uint8" },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "s", type: "bytes32" },
    ],
    name: "delegateBySig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // View functions
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "delegates",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "getVotes",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "underlying",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ERC20 ABI (for approvals)
export const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// cbBTC address on Base
export const CBBTC_ADDRESS = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";

// Payment token symbols for display
export const PAYMENT_TOKEN_SYMBOLS: Record<string, string> = {
  [CONTRACT_ADDRESSES.donut.toLowerCase()]: "DONUT",
  [CONTRACT_ADDRESSES.donutEthLp.toLowerCase()]: "DONUT-ETH LP",
  [CONTRACT_ADDRESSES.usdc.toLowerCase()]: "USDC",
  [CBBTC_ADDRESS.toLowerCase()]: "cbBTC",
};
