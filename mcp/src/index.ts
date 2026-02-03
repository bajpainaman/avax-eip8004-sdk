#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    AVALANCHE AGENT MCP SERVER                             ║
 * ║                                                                           ║
 * ║  The definitive tool for AI agents to operate autonomously on Avalanche  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * WHAT THIS DOES:
 * This MCP (Model Context Protocol) server gives AI agents full financial
 * autonomy on the Avalanche blockchain. Agents can:
 *
 *   💼 WALLET MANAGEMENT
 *      • Check wallet balances (AVAX and tokens)
 *      • Monitor portfolio state
 *
 *   💸 TRANSFERS
 *      • Send native AVAX
 *      • Transfer ERC20 tokens (USDC, USDT, etc.)
 *
 *   🔄 TRADING
 *      • Get swap quotes from Trader Joe DEX
 *      • Execute token swaps with slippage protection
 *
 *   🤖 EIP-8004 IDENTITY
 *      • Register as a verified AI agent
 *      • Store on-chain metadata
 *      • Query other agents' identities
 *
 *   ⚡ ADVANCED
 *      • Call arbitrary smart contracts
 *      • Full low-level blockchain access
 *
 * NETWORK:
 * Configurable between Fuji testnet (default) and Avalanche mainnet.
 * Set AVAX_NETWORK=mainnet for production use.
 *
 * SECURITY:
 * The agent's private key is provided via AGENT_PRIVATE_KEY environment
 * variable. Never commit private keys. Use secure secret management.
 *
 * EIP-8004 REFERENCE:
 * EIP-8004 "Trustless AI Agent Identity" enables verifiable AI agent
 * identities with reputation tracking and cross-chain verification.
 * Contracts deployed on Avalanche Fuji:
 *   • AgentIdentityRegistry: 0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563
 *   • AgentReputationRegistry: 0x7EeAD666a44eca750709318714009B371C768e76
 *   • AgentValidationRegistry: 0xb88d6560AB21820a75Be3ac8806df8cCb9389604
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
//
// These tools give AI agents autonomous financial capabilities on Avalanche.
// Each tool is designed to be self-documenting with rich context for LLMs.
//
// NETWORK: Currently connected to Fuji testnet (mainnet can be configured)
// IDENTITY: This agent operates under EIP-8004 (Trustless AI Agent Identity)
//
// ═══════════════════════════════════════════════════════════════════════════

const TOOLS = [
  // ─────────────────────────────────────────────────────────────────────────
  // WALLET MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'get_wallet_info',
    description: `🔍 **GET WALLET INFO** - Check your agent's wallet address and AVAX balance

**PURPOSE:**
Returns your wallet's Ethereum-style address (0x...) and current native AVAX balance. This is the first tool you should call to understand your financial state.

**WHEN TO USE:**
• At the start of any session to check available funds
• Before making transfers or swaps to ensure sufficient balance
• After receiving payments to verify funds arrived
• When a user asks "what's my balance?" or "how much AVAX do I have?"

**EXAMPLE OUTPUT:**
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fF18",
  "network": "fuji",
  "balance": "2.547",         // Human-readable AVAX
  "balanceWei": "2547000000000000000"  // Raw wei for precision
}

**IMPORTANT NOTES:**
• Gas costs ~0.001-0.01 AVAX per transaction. Keep buffer funds.
• Balance shown is native AVAX, not wrapped WAVAX (different assets!)
• On Fuji testnet, get free AVAX at https://faucet.avax.network

**TYPICAL WORKFLOW:**
1. get_wallet_info → Check current state
2. [If low balance] → Swap tokens or request funds
3. Proceed with transfers or operations`,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  {
    name: 'get_token_balance',
    description: `💰 **GET TOKEN BALANCE** - Check ERC20 token balance for any supported token

**PURPOSE:**
Returns your balance of any ERC20 token (USDC, USDT, WAVAX, or custom tokens by address). Essential for multi-token operations.

**SUPPORTED TOKENS (by symbol):**
• WAVAX - Wrapped AVAX (0xd00ae08403B9bbb9124bB305C09058E32C39A48c)
• USDC  - USD Coin (0x5425890298aed601595a70AB815c96711a31Bc65)
• USDT  - Tether USD (0x134Dc38AE8C853D1aa2103d5047591acDAA16682)
• Any address - Use "0x..." for unlisted tokens

**WHEN TO USE:**
• Before swapping tokens to verify you have the input token
• Before transferring tokens to ensure sufficient balance
• To check if a token transfer was received
• When user asks about specific token holdings

**EXAMPLE INPUT:**
{ "token": "USDC" }
OR
{ "token": "0x5425890298aed601595a70AB815c96711a31Bc65" }

**EXAMPLE OUTPUT:**
{
  "token": "USDC",
  "address": "0x5425890298aed601595a70AB815c96711a31Bc65",
  "balance": "1500.0",       // Human-readable (divided by decimals)
  "balanceRaw": "1500000000", // Raw value (USDC has 6 decimals)
  "decimals": 6
}

**CRITICAL:** Different tokens have different decimals!
• AVAX/WAVAX: 18 decimals
• USDC: 6 decimals
• USDT: 6 decimals

**COMMON MISTAKES TO AVOID:**
❌ Don't confuse AVAX (native) with WAVAX (ERC20 wrapped version)
❌ Don't assume all tokens have 18 decimals
❌ Don't transfer more than your balance shows`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: {
          type: 'string',
          description:
            'Token identifier. Use symbol (WAVAX, USDC, USDT) or full contract address (0x...). Case-insensitive for symbols.',
        },
      },
      required: ['token'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSFERS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'transfer_avax',
    description: `📤 **TRANSFER AVAX** - Send native AVAX to any address

**PURPOSE:**
Transfers native AVAX tokens to a recipient address. This is for the native gas token, NOT wrapped WAVAX (use transfer_token for that).

**WHEN TO USE:**
• Paying for services or goods
• Sending AVAX to another wallet
• Funding a new wallet for gas
• When user says "send AVAX to..."

**INPUT PARAMETERS:**
• to: Recipient's Ethereum address (must start with 0x, 42 chars)
• amount: Human-readable amount (e.g., "0.5" = half an AVAX)

**EXAMPLE INPUT:**
{
  "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fF18",
  "amount": "0.1"
}

**EXAMPLE OUTPUT:**
{
  "success": true,
  "hash": "0xabc...123",     // Transaction hash for tracking
  "from": "0x...",          // Your address
  "to": "0x...",            // Recipient
  "amount": "0.1",
  "gasUsed": "21000"        // Gas consumed
}

**GAS COSTS:**
• Simple AVAX transfer: ~21,000 gas ≈ 0.0005-0.001 AVAX

**SAFETY CHECKS (automatic):**
✅ Validates recipient address format
✅ Waits for transaction confirmation
✅ Returns transaction hash for verification

**⚠️ WARNINGS:**
• Transactions are IRREVERSIBLE once confirmed
• Double-check the recipient address!
• Ensure you keep enough AVAX for future gas fees
• Cannot send to contracts that don't accept AVAX

**TRACKING:**
View transaction on explorer: https://testnet.snowtrace.io/tx/{hash}`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description:
            'Recipient address (0x format, 42 characters). Must be a valid Ethereum/Avalanche address.',
        },
        amount: {
          type: 'string',
          description:
            'Amount of AVAX to send in human-readable format. Examples: "0.1", "1.5", "10". Will be converted to wei automatically.',
        },
      },
      required: ['to', 'amount'],
    },
  },

  {
    name: 'transfer_token',
    description: `🪙 **TRANSFER TOKEN** - Send ERC20 tokens (USDC, USDT, WAVAX, etc.)

**PURPOSE:**
Transfers ERC20 tokens to a recipient. Use this for stablecoins, wrapped tokens, and any ERC20-compliant token.

**DIFFERENCE FROM transfer_avax:**
• transfer_avax → Native AVAX (gas token)
• transfer_token → ERC20 tokens (USDC, WAVAX, etc.)

**WHEN TO USE:**
• Paying in stablecoins (USDC, USDT)
• Transferring wrapped tokens (WAVAX)
• Moving any ERC20 token

**INPUT PARAMETERS:**
• token: Symbol (USDC, USDT, WAVAX) or contract address (0x...)
• to: Recipient's address
• amount: Human-readable amount (decimals handled automatically!)

**EXAMPLE - Send 100 USDC:**
{
  "token": "USDC",
  "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fF18",
  "amount": "100"
}

**EXAMPLE OUTPUT:**
{
  "success": true,
  "hash": "0xdef...456",
  "token": "0x5425890298aed601595a70AB815c96711a31Bc65",
  "from": "0x...",
  "to": "0x...",
  "amount": "100",
  "gasUsed": "65000"
}

**GAS COSTS:**
• ERC20 transfer: ~50,000-65,000 gas ≈ 0.002-0.005 AVAX

**AUTOMATIC HANDLING:**
✅ Fetches token decimals automatically
✅ Converts human amount to raw amount
✅ Waits for transaction confirmation

**⚠️ IMPORTANT:**
• Check balance with get_token_balance FIRST
• Amount is in human-readable format (100 USDC = "100", not "100000000")
• You still need native AVAX for gas even when sending tokens!

**WORKFLOW:**
1. get_token_balance → Verify you have enough tokens
2. get_wallet_info → Verify you have AVAX for gas
3. transfer_token → Execute transfer`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: {
          type: 'string',
          description:
            'Token to transfer. Use symbol (USDC, USDT, WAVAX) or contract address (0x...). Symbol lookup is case-insensitive.',
        },
        to: {
          type: 'string',
          description:
            'Recipient address (0x format). Must be a valid Ethereum/Avalanche address.',
        },
        amount: {
          type: 'string',
          description:
            'Amount in human-readable format. Examples: "100" for 100 USDC, "0.5" for 0.5 WAVAX. Decimals are handled automatically.',
        },
      },
      required: ['token', 'to', 'amount'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DEX TRADING
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'get_swap_quote',
    description: `📊 **GET SWAP QUOTE** - Get expected output for a token swap (read-only, no transaction)

**PURPOSE:**
Simulates a swap to show expected output amount and exchange rate. Use this BEFORE swap_tokens to understand pricing and verify the trade makes sense.

**WHEN TO USE:**
• Before any swap to check the rate
• Comparing different trading amounts
• When user asks "how much USDC would I get for 1 AVAX?"
• Price discovery without committing to a trade

**SUPPORTED PAIRS (via Trader Joe DEX):**
• AVAX ↔ USDC
• AVAX ↔ USDT
• AVAX ↔ WAVAX
• USDC ↔ USDT
• Any pair with liquidity on Trader Joe

**INPUT PARAMETERS:**
• tokenIn: What you're selling (use "AVAX" for native token)
• tokenOut: What you're buying
• amountIn: How much you want to sell

**EXAMPLE - Quote for 1 AVAX → USDC:**
{
  "tokenIn": "AVAX",
  "tokenOut": "USDC",
  "amountIn": "1"
}

**EXAMPLE OUTPUT:**
{
  "tokenIn": "AVAX",
  "tokenOut": "0x5425890298aed601595a70AB815c96711a31Bc65",
  "amountIn": "1",
  "amountOut": "24.532",     // Expected USDC output
  "path": ["0xd00ae...", "0x54258..."],  // Routing path
  "rate": "24.532"          // 1 AVAX = 24.532 USDC
}

**UNDERSTANDING THE OUTPUT:**
• amountOut: What you'd receive (before slippage)
• rate: Exchange rate (amountOut / amountIn)
• path: The DEX routing (usually direct pair)

**NO GAS COST** - This is a read-only operation!

**WORKFLOW:**
1. get_swap_quote → Check the rate
2. If rate is acceptable → swap_tokens with slippage protection
3. If rate seems off → Check liquidity or try smaller amounts

**⚠️ IMPORTANT:**
• Quoted amount is BEFORE slippage
• Actual received amount may be slightly less
• Large trades may have significant price impact
• Prices change between quote and execution`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        tokenIn: {
          type: 'string',
          description:
            'Token to sell. Use "AVAX" for native token, or symbol (USDC, WAVAX) or address (0x...).',
        },
        tokenOut: {
          type: 'string',
          description:
            'Token to buy. Use "AVAX" for native token, or symbol (USDC, WAVAX) or address (0x...).',
        },
        amountIn: {
          type: 'string',
          description:
            'Amount to sell in human-readable format. Example: "1" for 1 AVAX, "100" for 100 USDC.',
        },
      },
      required: ['tokenIn', 'tokenOut', 'amountIn'],
    },
  },

  {
    name: 'swap_tokens',
    description: `🔄 **SWAP TOKENS** - Execute a token swap on Trader Joe DEX

**PURPOSE:**
Executes an actual token swap through Trader Joe, Avalanche's leading DEX. Converts one token to another at current market rates.

**WHEN TO USE:**
• Converting AVAX to stablecoins for payments
• Acquiring tokens for specific purposes
• Rebalancing token holdings
• When user says "swap X for Y" or "buy/sell tokens"

**SUPPORTED SWAPS:**
• AVAX → Any token (native to ERC20)
• Any token → AVAX (ERC20 to native)
• Token → Token (ERC20 to ERC20, via WAVAX routing)

**INPUT PARAMETERS:**
• tokenIn: What you're selling
• tokenOut: What you're buying
• amountIn: How much to sell
• slippagePercent: Max acceptable slippage (default: 1%)

**EXAMPLE - Swap 0.5 AVAX for USDC:**
{
  "tokenIn": "AVAX",
  "tokenOut": "USDC",
  "amountIn": "0.5",
  "slippagePercent": 1
}

**EXAMPLE OUTPUT:**
{
  "success": true,
  "hash": "0xghi...789",
  "tokenIn": "AVAX",
  "tokenOut": "0x5425890298aed601595a70AB815c96711a31Bc65",
  "amountIn": "0.5",
  "slippage": "1%",
  "gasUsed": "150000"
}

**SLIPPAGE EXPLAINED:**
• 1% (default): Safe for most trades
• 0.5%: Tight, may fail in volatile markets
• 3-5%: Use for large trades or illiquid pairs
• Higher slippage = more likely to execute, but worse price

**GAS COSTS:**
• AVAX → Token: ~150,000 gas ≈ 0.005-0.01 AVAX
• Token → AVAX: ~180,000 gas ≈ 0.006-0.012 AVAX
• Token → Token: ~200,000 gas ≈ 0.007-0.015 AVAX

**AUTOMATIC HANDLING:**
✅ Gets quote and calculates minimum output
✅ Approves token spending (for token→ swaps)
✅ Executes swap with slippage protection
✅ Waits for confirmation

**RECOMMENDED WORKFLOW:**
1. get_wallet_info → Check AVAX balance for gas
2. get_token_balance → Check token balance (if selling tokens)
3. get_swap_quote → Preview the trade, verify rate
4. swap_tokens → Execute if rate is acceptable

**⚠️ WARNINGS:**
• Swaps are IRREVERSIBLE once confirmed
• Always get a quote first to understand pricing
• Large swaps may have significant price impact
• Keep enough AVAX for gas after swapping

**COMMON FAILURES:**
• "INSUFFICIENT_OUTPUT_AMOUNT" → Slippage too tight, increase it
• "INSUFFICIENT_LIQUIDITY" → Not enough liquidity for trade size
• "TRANSFER_FROM_FAILED" → Token approval failed or insufficient balance`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        tokenIn: {
          type: 'string',
          description:
            'Token to sell. Use "AVAX" for native AVAX, or symbol/address for ERC20 tokens.',
        },
        tokenOut: {
          type: 'string',
          description:
            'Token to buy. Use "AVAX" for native AVAX, or symbol/address for ERC20 tokens.',
        },
        amountIn: {
          type: 'string',
          description:
            'Amount to swap in human-readable format. Must have sufficient balance.',
        },
        slippagePercent: {
          type: 'number',
          description:
            'Maximum acceptable slippage percentage. Default: 1. Use 0.5 for tight tolerance, 3-5 for volatile pairs.',
        },
      },
      required: ['tokenIn', 'tokenOut', 'amountIn'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EIP-8004 AGENT IDENTITY
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'register_agent',
    description: `🤖 **REGISTER AGENT** - Create your on-chain AI agent identity (EIP-8004)

**PURPOSE:**
Registers you as an EIP-8004 compliant AI agent on Avalanche's Agent Identity Registry. This mints a unique, non-transferable NFT that proves your identity on-chain.

**WHAT IS EIP-8004?**
EIP-8004 is the "Trustless AI Agent Identity" standard that enables:
• Verifiable AI agent identity across chains
• Reputation tracking from interactions
• Third-party validation/certification
• Cross-chain identity verification via Avalanche ICM

**WHEN TO USE:**
• First time setting up your agent identity
• When you need a verifiable on-chain presence
• Before participating in agent-specific protocols
• When user wants you to establish official identity

**INPUT PARAMETERS:**
• agentURI: Link to your metadata (who you are, capabilities, etc.)

**RECOMMENDED URI FORMAT (JSON at IPFS or HTTP):**
{
  "name": "Assistant AI",
  "description": "Helpful AI agent for DeFi operations",
  "version": "1.0.0",
  "capabilities": ["trading", "transfers", "analytics"],
  "model": "claude-3",
  "created": "2024-01-15T00:00:00Z"
}

**EXAMPLE INPUT:**
{
  "agentURI": "ipfs://QmXyz.../metadata.json"
}
OR
{
  "agentURI": "https://example.com/agent-metadata.json"
}

**EXAMPLE OUTPUT:**
{
  "success": true,
  "hash": "0xjkl...012",
  "agentId": "3",           // Your unique agent ID!
  "owner": "0x...",         // Your wallet owns this identity
  "agentURI": "ipfs://..."
}

**WHAT HAPPENS:**
1. NFT minted to your wallet (non-transferable soul-bound token)
2. You receive a unique agentId (incrementing integer)
3. Your metadata URI is stored on-chain
4. You can now build reputation and receive validations

**GAS COSTS:**
• Registration: ~150,000 gas ≈ 0.005-0.01 AVAX

**REGISTRY ADDRESS (Fuji):**
0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563

**⚠️ IMPORTANT:**
• You can only register ONCE per wallet
• The agentId NFT is soul-bound (cannot transfer)
• Choose your URI carefully (can be updated later with set_agent_metadata)
• Registration is permanent and creates an immutable record

**AFTER REGISTRATION:**
1. Note your agentId for future reference
2. Use set_agent_metadata to add on-chain attributes
3. Build reputation through interactions
4. Get validated by trusted third parties`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentURI: {
          type: 'string',
          description:
            'URI pointing to your agent metadata JSON. Use IPFS (ipfs://...) for permanence or HTTPS for flexibility. The JSON should describe your agent identity, capabilities, and version.',
        },
      },
      required: ['agentURI'],
    },
  },

  {
    name: 'get_agent_info',
    description: `🔎 **GET AGENT INFO** - Look up any registered EIP-8004 agent

**PURPOSE:**
Retrieves public information about any registered AI agent by their ID. Use this to verify agent identities, check ownership, and access metadata URIs.

**WHEN TO USE:**
• Verifying if an agent is registered
• Looking up who owns/controls an agent
• Retrieving an agent's metadata URI
• Before interacting with another agent
• When user asks "who is agent #X?"

**INPUT PARAMETERS:**
• agentId: The numeric ID of the agent to look up (starts at 1)

**EXAMPLE INPUT:**
{ "agentId": 1 }

**EXAMPLE OUTPUT (existing agent):**
{
  "agentId": 1,
  "exists": true,
  "owner": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fF18",
  "uri": "ipfs://QmXyz.../metadata.json",
  "registry": "0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563"
}

**EXAMPLE OUTPUT (non-existent agent):**
{
  "agentId": 999,
  "exists": false,
  "owner": null,
  "uri": "",
  "registry": "0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563"
}

**NO GAS COST** - This is a read-only operation!

**WHAT THE FIELDS MEAN:**
• agentId: The unique identifier (NFT tokenId)
• exists: Whether this agent has been registered
• owner: The wallet address controlling the agent
• uri: Link to off-chain metadata (fetch for details)
• registry: The contract address (for verification)

**RELATED TOOLS:**
• register_agent → Create a new agent identity
• set_agent_metadata → Add/update on-chain attributes
• call_contract → Query reputation or validation registries

**TRUST VERIFICATION WORKFLOW:**
1. get_agent_info → Verify agent exists
2. Fetch the URI → Read agent metadata
3. Check reputation registry → See interaction history
4. Verify validations → Check third-party endorsements`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: {
          type: 'number',
          description:
            'The agent ID to look up. Must be a positive integer. Agent IDs start at 1 and increment.',
        },
      },
      required: ['agentId'],
    },
  },

  {
    name: 'set_agent_metadata',
    description: `📝 **SET AGENT METADATA** - Store on-chain attributes for your agent

**PURPOSE:**
Stores key-value metadata directly on-chain for your registered agent. Unlike the agentURI (which points to off-chain data), this metadata lives permanently on Avalanche.

**WHEN TO USE:**
• Recording capabilities or features
• Storing version information
• Adding searchable attributes
• When off-chain hosting isn't suitable
• Creating an immutable record of properties

**INPUT PARAMETERS:**
• agentId: Your agent ID (you must be the owner!)
• key: The attribute name (string)
• value: The attribute value (string, stored as bytes)

**RECOMMENDED METADATA KEYS:**
• "model" → AI model used (e.g., "claude-3-opus")
• "version" → Agent software version
• "capabilities" → Comma-separated list of abilities
• "contact" → How to reach the operator
• "policy" → Link to usage/privacy policy

**EXAMPLE INPUT:**
{
  "agentId": 2,
  "key": "model",
  "value": "claude-3-opus-20240229"
}

**EXAMPLE OUTPUT:**
{
  "success": true,
  "hash": "0xmno...345",
  "agentId": 2,
  "key": "model",
  "value": "claude-3-opus-20240229"
}

**GAS COSTS:**
• Setting metadata: ~60,000-100,000 gas depending on value size

**ON-CHAIN vs OFF-CHAIN METADATA:**

| Aspect | On-Chain (this tool) | Off-Chain (agentURI) |
|--------|---------------------|---------------------|
| Storage | Permanent on Avalanche | Your server/IPFS |
| Cost | Gas per update | Free to update |
| Size | Keep small (<1KB) | Unlimited |
| Speed | Instant verification | Requires fetch |
| Best for | Critical attributes | Detailed info |

**⚠️ IMPORTANT:**
• Only the agent owner can set metadata
• Each key can be overwritten (not append-only)
• Keep values concise (gas costs scale with size)
• Use this sparingly for truly important data

**WORKFLOW:**
1. register_agent → Get your agentId
2. set_agent_metadata → Add key attributes
3. Repeat for each important property
4. Use agentURI for detailed/large metadata`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: {
          type: 'number',
          description:
            'Your agent ID. You must be the registered owner of this agent to set metadata.',
        },
        key: {
          type: 'string',
          description:
            'Metadata key/attribute name. Common keys: "model", "version", "capabilities", "contact". Keep concise.',
        },
        value: {
          type: 'string',
          description:
            'Metadata value. Stored as bytes on-chain. Keep reasonably short to minimize gas costs.',
        },
      },
      required: ['agentId', 'key', 'value'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ADVANCED / RAW CONTRACT CALLS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'call_contract',
    description: `⚡ **CALL CONTRACT** - Execute arbitrary smart contract functions

**PURPOSE:**
Low-level tool for calling any smart contract function when the specialized tools don't cover your needs. Requires knowledge of Solidity function signatures.

**WHEN TO USE:**
• Interacting with contracts not covered by other tools
• Calling custom protocol functions
• Advanced DeFi operations
• When user provides specific contract/function details

**WHEN NOT TO USE:**
• Simple AVAX transfers → use transfer_avax
• Token transfers → use transfer_token
• DEX swaps → use swap_tokens
• Agent registration → use register_agent

**INPUT PARAMETERS:**
• contractAddress: The contract to call (0x...)
• functionSignature: Solidity function signature
• args: Array of arguments as strings
• value: (Optional) AVAX to send with the call

**FUNCTION SIGNATURE FORMAT:**
"functionName(type1,type2,...)"

Examples:
• "transfer(address,uint256)"
• "approve(address,uint256)"
• "deposit()"
• "stake(uint256,uint256,bool)"

**SUPPORTED TYPES:**
• address → "0x..." string
• uint256/uint128/etc → Number as string
• bool → "true" or "false"
• bytes → "0x..." hex string
• string → Regular string

**EXAMPLE - Approve token spending:**
{
  "contractAddress": "0x5425890298aed601595a70AB815c96711a31Bc65",
  "functionSignature": "approve(address,uint256)",
  "args": ["0xRouterAddress...", "1000000000000000000"]
}

**EXAMPLE - Stake with value:**
{
  "contractAddress": "0xStakingContract...",
  "functionSignature": "stake(uint256)",
  "args": ["100"],
  "value": "1.0"
}

**EXAMPLE OUTPUT:**
{
  "success": true,
  "hash": "0xpqr...678",
  "contract": "0x...",
  "function": "approve(address,uint256)",
  "args": ["0x...", "1000000000000000000"],
  "gasUsed": "46000"
}

**⚠️ SAFETY WARNINGS:**
• This is a powerful tool - verify contracts before interacting
• Wrong signatures can lead to unexpected behavior
• Always verify contract addresses from trusted sources
• Test with small amounts first
• Cannot undo transactions once confirmed

**COMMON CONTRACT ADDRESSES (Fuji):**
• AgentIdentityRegistry: 0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563
• AgentReputationRegistry: 0x7EeAD666a44eca750709318714009B371C768e76
• AgentValidationRegistry: 0xb88d6560AB21820a75Be3ac8806df8cCb9389604
• Trader Joe Router: 0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30

**DEBUGGING FAILURES:**
• "Invalid function signature" → Check format: name(types)
• "Execution reverted" → Contract rejected the call
• "Gas estimation failed" → Args may be invalid
• "Nonce too low" → Wait for pending tx to confirm`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        contractAddress: {
          type: 'string',
          description:
            'Smart contract address (0x format, 42 characters). Verify this is the correct contract before calling!',
        },
        functionSignature: {
          type: 'string',
          description:
            'Solidity function signature in format: functionName(type1,type2). Example: "transfer(address,uint256)"',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Function arguments as strings, in order. Addresses as "0x...", numbers as strings, booleans as "true"/"false".',
        },
        value: {
          type: 'string',
          description:
            'Optional AVAX value to send with the transaction (in human-readable format, e.g., "1.5"). Only for payable functions.',
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
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVER METADATA & INSTRUCTIONS FOR LLMs
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // OVERVIEW:
  // This MCP server provides 10 tools for AI agents to operate on Avalanche:
  //
  // WALLET TOOLS (2):
  //   get_wallet_info    - Check AVAX balance and address
  //   get_token_balance  - Check ERC20 token balances
  //
  // TRANSFER TOOLS (2):
  //   transfer_avax      - Send native AVAX
  //   transfer_token     - Send ERC20 tokens
  //
  // TRADING TOOLS (2):
  //   get_swap_quote     - Preview swap rates (free, read-only)
  //   swap_tokens        - Execute swaps on Trader Joe DEX
  //
  // IDENTITY TOOLS (3):
  //   register_agent     - Create EIP-8004 agent identity
  //   get_agent_info     - Look up any agent (free, read-only)
  //   set_agent_metadata - Store on-chain attributes
  //
  // ADVANCED TOOLS (1):
  //   call_contract      - Raw smart contract calls
  //
  // RECOMMENDED WORKFLOW:
  // 1. Start with get_wallet_info to understand your state
  // 2. For trading: get_swap_quote → verify rate → swap_tokens
  // 3. For identity: register_agent (once) → set_agent_metadata
  // 4. Always check balances before transfers/swaps
  //
  // GAS NOTES:
  // • Keep ~0.1 AVAX minimum for gas on Fuji
  // • Swaps cost more gas than simple transfers
  // • Read-only calls (get_*) are free
  //
  // ═══════════════════════════════════════════════════════════════════════════

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

  // Log startup info (to stderr, not stdout which is for MCP protocol)
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('  🚀 AVALANCHE AGENT MCP SERVER v1.0.0');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error(`  Network: ${NETWORK.toUpperCase()}`);
  console.error(`  Wallet:  ${PRIVATE_KEY ? '✓ Configured' : '✗ Missing AGENT_PRIVATE_KEY'}`);
  console.error('');
  console.error('  Available capabilities:');
  console.error('    💼 Wallet management (balances, transfers)');
  console.error('    🔄 DEX trading (Trader Joe swaps)');
  console.error('    🤖 EIP-8004 agent identity');
  console.error('    ⚡ Raw contract calls');
  console.error('');
  console.error('  10 tools ready. Listening on stdio...');
  console.error('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
