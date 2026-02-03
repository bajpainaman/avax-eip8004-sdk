#!/usr/bin/env node
/**
 * Avalanche Agent MCP Server
 *
 * Gives AI agents the ability to:
 * - Register as EIP-8004 agents
 * - Get wallets and manage balances
 * - Swap tokens on DEXes
 * - Execute contract calls
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  parseUnits,
  encodeFunctionData,
  type Address,
  type Hash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji, avalanche } from 'viem/chains';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
const NETWORK = process.env.AVAX_NETWORK || 'fuji';

const FUJI_CONTRACTS = {
  identityRegistry: '0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563' as const,
  reputationRegistry: '0x7EeAD666a44eca750709318714009B371C768e76' as const,
  validationRegistry: '0xb88d6560AB21820a75Be3ac8806df8cCb9389604' as const,
};

// Common token addresses on Fuji
const FUJI_TOKENS: Record<string, Address> = {
  WAVAX: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c',
  USDC: '0x5425890298aed601595a70AB815c96711a31Bc65',
  USDT: '0x134Dc38AE8C853D1aa2103d5047591acDAA16682',
};

// Trader Joe Router V2 on Fuji
const TRADER_JOE_ROUTER = '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30' as const;

// ═══════════════════════════════════════════════════════════════════════════
// ABIs
// ═══════════════════════════════════════════════════════════════════════════

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalAgents',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentExists',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const ROUTER_ABI = [
  {
    type: 'function',
    name: 'swapExactAVAXForTokens',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'swapExactTokensForAVAX',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'swapExactTokensForTokens',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAmountsOut',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT SETUP
// ═══════════════════════════════════════════════════════════════════════════

function getClients() {
  if (!PRIVATE_KEY) {
    throw new Error('AGENT_PRIVATE_KEY environment variable required');
  }

  const chain = NETWORK === 'mainnet' ? avalanche : avalancheFuji;
  const rpcUrl =
    NETWORK === 'mainnet'
      ? 'https://api.avax.network/ext/bc/C/rpc'
      : 'https://api.avax-test.network/ext/bc/C/rpc';

  const account = privateKeyToAccount(PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain,
    transport: http(rpcUrl),
    account,
  });

  return { publicClient, walletClient, account, chain };
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TOOLS = [
  {
    name: 'get_wallet_info',
    description:
      'Get the current agent wallet address and AVAX balance. Use this to check your available funds.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_token_balance',
    description:
      'Get the balance of a specific ERC20 token. Supported tokens: WAVAX, USDC, USDT or any token address.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: {
          type: 'string',
          description: 'Token symbol (WAVAX, USDC, USDT) or contract address',
        },
      },
      required: ['token'],
    },
  },
  {
    name: 'transfer_avax',
    description: 'Transfer AVAX to another address.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient address',
        },
        amount: {
          type: 'string',
          description: 'Amount of AVAX to send (e.g., "0.1")',
        },
      },
      required: ['to', 'amount'],
    },
  },
  {
    name: 'transfer_token',
    description: 'Transfer ERC20 tokens to another address.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: {
          type: 'string',
          description: 'Token symbol or contract address',
        },
        to: {
          type: 'string',
          description: 'Recipient address',
        },
        amount: {
          type: 'string',
          description: 'Amount to send (in human readable format)',
        },
      },
      required: ['token', 'to', 'amount'],
    },
  },
  {
    name: 'get_swap_quote',
    description:
      'Get a quote for swapping tokens. Returns expected output amount.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tokenIn: {
          type: 'string',
          description: 'Input token symbol or address (use "AVAX" for native)',
        },
        tokenOut: {
          type: 'string',
          description: 'Output token symbol or address',
        },
        amountIn: {
          type: 'string',
          description: 'Amount to swap (in human readable format)',
        },
      },
      required: ['tokenIn', 'tokenOut', 'amountIn'],
    },
  },
  {
    name: 'swap_tokens',
    description:
      'Swap tokens using Trader Joe DEX. Supports AVAX <-> Token swaps.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tokenIn: {
          type: 'string',
          description: 'Input token symbol or address (use "AVAX" for native)',
        },
        tokenOut: {
          type: 'string',
          description: 'Output token symbol or address',
        },
        amountIn: {
          type: 'string',
          description: 'Amount to swap (in human readable format)',
        },
        slippagePercent: {
          type: 'number',
          description: 'Maximum slippage tolerance (default: 1%)',
          default: 1,
        },
      },
      required: ['tokenIn', 'tokenOut', 'amountIn'],
    },
  },
  {
    name: 'register_agent',
    description:
      'Register as an EIP-8004 agent on the Avalanche identity registry. Returns your agent ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentURI: {
          type: 'string',
          description: 'URI pointing to agent metadata (IPFS or HTTP)',
        },
      },
      required: ['agentURI'],
    },
  },
  {
    name: 'get_agent_info',
    description: 'Get information about a registered EIP-8004 agent.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: {
          type: 'number',
          description: 'The agent ID to look up',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'set_agent_metadata',
    description: 'Set metadata for your registered agent.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: {
          type: 'number',
          description: 'Your agent ID',
        },
        key: {
          type: 'string',
          description: 'Metadata key (e.g., "model", "version", "capabilities")',
        },
        value: {
          type: 'string',
          description: 'Metadata value',
        },
      },
      required: ['agentId', 'key', 'value'],
    },
  },
  {
    name: 'call_contract',
    description:
      'Execute an arbitrary contract call. For advanced users who know the contract ABI.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        contractAddress: {
          type: 'string',
          description: 'Contract address to call',
        },
        functionSignature: {
          type: 'string',
          description:
            'Function signature (e.g., "transfer(address,uint256)")',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Function arguments as strings',
        },
        value: {
          type: 'string',
          description: 'AVAX value to send (optional)',
        },
      },
      required: ['contractAddress', 'functionSignature', 'args'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// TOOL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function resolveToken(token: string): Address {
  if (token.startsWith('0x')) {
    return token as Address;
  }
  const upper = token.toUpperCase();
  if (upper === 'AVAX') {
    return FUJI_TOKENS.WAVAX;
  }
  const addr = FUJI_TOKENS[upper];
  if (!addr) {
    throw new Error(`Unknown token: ${token}. Use address or: WAVAX, USDC, USDT`);
  }
  return addr;
}

async function getWalletInfo(): Promise<string> {
  const { publicClient, account } = getClients();
  const balance = await publicClient.getBalance({ address: account.address });

  return JSON.stringify({
    address: account.address,
    network: NETWORK,
    balance: formatEther(balance),
    balanceWei: balance.toString(),
  });
}

async function getTokenBalance(token: string): Promise<string> {
  const { publicClient, account } = getClients();
  const tokenAddress = resolveToken(token);

  const [balance, decimals, symbol] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }),
  ]);

  const formatted = Number(balance) / 10 ** decimals;

  return JSON.stringify({
    token: symbol,
    address: tokenAddress,
    balance: formatted.toString(),
    balanceRaw: balance.toString(),
    decimals,
  });
}

async function transferAvax(to: string, amount: string): Promise<string> {
  const { walletClient, publicClient, account } = getClients();

  const hash = await walletClient.sendTransaction({
    to: to as Address,
    value: parseEther(amount),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return JSON.stringify({
    success: receipt.status === 'success',
    hash,
    from: account.address,
    to,
    amount,
    gasUsed: receipt.gasUsed.toString(),
  });
}

async function transferToken(
  token: string,
  to: string,
  amount: string
): Promise<string> {
  const { walletClient, publicClient, account } = getClients();
  const tokenAddress = resolveToken(token);

  const decimals = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  const amountRaw = parseUnits(amount, decimals);

  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as Address, amountRaw],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return JSON.stringify({
    success: receipt.status === 'success',
    hash,
    token: tokenAddress,
    from: account.address,
    to,
    amount,
    gasUsed: receipt.gasUsed.toString(),
  });
}

async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<string> {
  const { publicClient } = getClients();

  const isAvaxIn = tokenIn.toUpperCase() === 'AVAX';
  const isAvaxOut = tokenOut.toUpperCase() === 'AVAX';

  const tokenInAddr = isAvaxIn ? FUJI_TOKENS.WAVAX : resolveToken(tokenIn);
  const tokenOutAddr = isAvaxOut ? FUJI_TOKENS.WAVAX : resolveToken(tokenOut);

  const decimalsIn = isAvaxIn
    ? 18
    : await publicClient.readContract({
        address: tokenInAddr,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });

  const decimalsOut = isAvaxOut
    ? 18
    : await publicClient.readContract({
        address: tokenOutAddr,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });

  const amountInRaw = parseUnits(amountIn, decimalsIn);
  const path = [tokenInAddr, tokenOutAddr];

  const amounts = await publicClient.readContract({
    address: TRADER_JOE_ROUTER,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [amountInRaw, path],
  });

  const amountOut = Number(amounts[1]) / 10 ** decimalsOut;

  return JSON.stringify({
    tokenIn: isAvaxIn ? 'AVAX' : tokenInAddr,
    tokenOut: isAvaxOut ? 'AVAX' : tokenOutAddr,
    amountIn,
    amountOut: amountOut.toString(),
    path,
    rate: (amountOut / Number(amountIn)).toString(),
  });
}

async function swapTokens(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippagePercent: number = 1
): Promise<string> {
  const { walletClient, publicClient, account } = getClients();

  const isAvaxIn = tokenIn.toUpperCase() === 'AVAX';
  const isAvaxOut = tokenOut.toUpperCase() === 'AVAX';

  const tokenInAddr = isAvaxIn ? FUJI_TOKENS.WAVAX : resolveToken(tokenIn);
  const tokenOutAddr = isAvaxOut ? FUJI_TOKENS.WAVAX : resolveToken(tokenOut);

  const decimalsIn = isAvaxIn
    ? 18
    : await publicClient.readContract({
        address: tokenInAddr,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });

  const amountInRaw = parseUnits(amountIn, decimalsIn);
  const path = [tokenInAddr, tokenOutAddr];
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min

  // Get quote for slippage calculation
  const amounts = await publicClient.readContract({
    address: TRADER_JOE_ROUTER,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [amountInRaw, path],
  });

  const amountOutMin =
    (amounts[1] * BigInt(100 - slippagePercent)) / BigInt(100);

  let hash: Hash;

  if (isAvaxIn) {
    // Swap AVAX for tokens
    hash = await walletClient.writeContract({
      address: TRADER_JOE_ROUTER,
      abi: ROUTER_ABI,
      functionName: 'swapExactAVAXForTokens',
      args: [amountOutMin, path, account.address, deadline],
      value: amountInRaw,
    });
  } else if (isAvaxOut) {
    // Approve router first
    await walletClient.writeContract({
      address: tokenInAddr,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [TRADER_JOE_ROUTER, amountInRaw],
    });

    // Swap tokens for AVAX
    hash = await walletClient.writeContract({
      address: TRADER_JOE_ROUTER,
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForAVAX',
      args: [amountInRaw, amountOutMin, path, account.address, deadline],
    });
  } else {
    // Approve router first
    await walletClient.writeContract({
      address: tokenInAddr,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [TRADER_JOE_ROUTER, amountInRaw],
    });

    // Swap tokens for tokens
    hash = await walletClient.writeContract({
      address: TRADER_JOE_ROUTER,
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [amountInRaw, amountOutMin, path, account.address, deadline],
    });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return JSON.stringify({
    success: receipt.status === 'success',
    hash,
    tokenIn: isAvaxIn ? 'AVAX' : tokenInAddr,
    tokenOut: isAvaxOut ? 'AVAX' : tokenOutAddr,
    amountIn,
    slippage: `${slippagePercent}%`,
    gasUsed: receipt.gasUsed.toString(),
  });
}

async function registerAgent(agentURI: string): Promise<string> {
  const { walletClient, publicClient, account } = getClients();

  const hash = await walletClient.writeContract({
    address: FUJI_CONTRACTS.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const totalAgents = await publicClient.readContract({
    address: FUJI_CONTRACTS.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'totalAgents',
  });

  return JSON.stringify({
    success: receipt.status === 'success',
    hash,
    agentId: totalAgents.toString(),
    owner: account.address,
    agentURI,
  });
}

async function getAgentInfo(agentId: number): Promise<string> {
  const { publicClient } = getClients();

  const [exists, owner, uri] = await Promise.all([
    publicClient.readContract({
      address: FUJI_CONTRACTS.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'agentExists',
      args: [BigInt(agentId)],
    }),
    publicClient
      .readContract({
        address: FUJI_CONTRACTS.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'ownerOf',
        args: [BigInt(agentId)],
      })
      .catch(() => null),
    publicClient
      .readContract({
        address: FUJI_CONTRACTS.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'tokenURI',
        args: [BigInt(agentId)],
      })
      .catch(() => ''),
  ]);

  return JSON.stringify({
    agentId,
    exists,
    owner,
    uri,
    registry: FUJI_CONTRACTS.identityRegistry,
  });
}

async function setAgentMetadata(
  agentId: number,
  key: string,
  value: string
): Promise<string> {
  const { walletClient, publicClient } = getClients();

  // Convert value to hex bytes
  const valueHex = `0x${Buffer.from(value).toString('hex')}` as Hex;

  const hash = await walletClient.writeContract({
    address: FUJI_CONTRACTS.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'setMetadata',
    args: [BigInt(agentId), key, valueHex],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return JSON.stringify({
    success: receipt.status === 'success',
    hash,
    agentId,
    key,
    value,
  });
}

async function callContract(
  contractAddress: string,
  functionSignature: string,
  args: string[],
  value?: string
): Promise<string> {
  const { walletClient, publicClient, account } = getClients();

  // Parse function signature to get name and types
  const match = functionSignature.match(/^(\w+)\((.*)\)$/);
  if (!match) {
    throw new Error(
      'Invalid function signature. Use format: functionName(type1,type2)'
    );
  }

  const [, funcName, typesStr] = match;
  const types = typesStr ? typesStr.split(',') : [];

  // Build minimal ABI
  const abi = [
    {
      type: 'function' as const,
      name: funcName,
      inputs: types.map((t, i) => ({ name: `arg${i}`, type: t.trim() })),
      outputs: [],
      stateMutability: value ? 'payable' : 'nonpayable',
    },
  ];

  // Parse args based on types
  const parsedArgs = args.map((arg, i) => {
    const type = types[i]?.trim();
    if (type?.includes('uint') || type?.includes('int')) {
      return BigInt(arg);
    }
    if (type === 'bool') {
      return arg.toLowerCase() === 'true';
    }
    return arg;
  });

  const hash = await walletClient.writeContract({
    address: contractAddress as Address,
    abi,
    functionName: funcName,
    args: parsedArgs,
    value: value ? parseEther(value) : undefined,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return JSON.stringify({
    success: receipt.status === 'success',
    hash,
    contract: contractAddress,
    function: functionSignature,
    args,
    gasUsed: receipt.gasUsed.toString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SERVER
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const server = new Server(
    {
      name: 'avax-agent-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'get_wallet_info':
          result = await getWalletInfo();
          break;

        case 'get_token_balance':
          result = await getTokenBalance(args?.token as string);
          break;

        case 'transfer_avax':
          result = await transferAvax(args?.to as string, args?.amount as string);
          break;

        case 'transfer_token':
          result = await transferToken(
            args?.token as string,
            args?.to as string,
            args?.amount as string
          );
          break;

        case 'get_swap_quote':
          result = await getSwapQuote(
            args?.tokenIn as string,
            args?.tokenOut as string,
            args?.amountIn as string
          );
          break;

        case 'swap_tokens':
          result = await swapTokens(
            args?.tokenIn as string,
            args?.tokenOut as string,
            args?.amountIn as string,
            (args?.slippagePercent as number) ?? 1
          );
          break;

        case 'register_agent':
          result = await registerAgent(args?.agentURI as string);
          break;

        case 'get_agent_info':
          result = await getAgentInfo(args?.agentId as number);
          break;

        case 'set_agent_metadata':
          result = await setAgentMetadata(
            args?.agentId as number,
            args?.key as string,
            args?.value as string
          );
          break;

        case 'call_contract':
          result = await callContract(
            args?.contractAddress as string,
            args?.functionSignature as string,
            args?.args as string[],
            args?.value as string | undefined
          );
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Avalanche Agent MCP server running on stdio');
}

main().catch(console.error);
