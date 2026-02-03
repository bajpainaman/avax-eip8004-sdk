# Avalanche Agent MCP Server

An MCP (Model Context Protocol) server that gives AI agents the ability to operate autonomously on Avalanche with EIP-8004 identity.

## Features

- **Wallet Management**: Get wallet info, check balances
- **Token Operations**: Transfer AVAX and ERC20 tokens
- **DEX Trading**: Swap tokens via Trader Joe
- **EIP-8004 Identity**: Register as an agent, set metadata
- **Contract Calls**: Execute arbitrary contract calls

## Quick Start

### 1. Set Environment Variables

```bash
export AGENT_PRIVATE_KEY=0x...  # Your wallet private key
export AVAX_NETWORK=fuji        # 'fuji' or 'mainnet'
```

### 2. Add to Claude Desktop Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "avax-agent": {
      "command": "node",
      "args": ["/path/to/avax-eip8004-sdk/mcp/dist/index.js"],
      "env": {
        "AGENT_PRIVATE_KEY": "0x...",
        "AVAX_NETWORK": "fuji"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The agent tools will now be available.

## Available Tools

### Wallet Tools

| Tool | Description |
|------|-------------|
| `get_wallet_info` | Get wallet address and AVAX balance |
| `get_token_balance` | Get ERC20 token balance |
| `transfer_avax` | Send AVAX to an address |
| `transfer_token` | Send ERC20 tokens |

### Trading Tools

| Tool | Description |
|------|-------------|
| `get_swap_quote` | Get expected output for a swap |
| `swap_tokens` | Execute a token swap on Trader Joe |

### EIP-8004 Identity Tools

| Tool | Description |
|------|-------------|
| `register_agent` | Register as an EIP-8004 agent |
| `get_agent_info` | Get info about an agent |
| `set_agent_metadata` | Set metadata on your agent |

### Advanced

| Tool | Description |
|------|-------------|
| `call_contract` | Execute arbitrary contract calls |

## Supported Tokens (Fuji)

| Symbol | Address |
|--------|---------|
| WAVAX | 0xd00ae08403B9bbb9124bB305C09058E32C39A48c |
| USDC | 0x5425890298aed601595a70AB815c96711a31Bc65 |
| USDT | 0x134Dc38AE8C853D1aa2103d5047591acDAA16682 |

## Example Usage (via AI Agent)

```
Agent: I want to check my balance
→ Uses get_wallet_info

Agent: Swap 0.1 AVAX for USDC
→ Uses get_swap_quote, then swap_tokens

Agent: Register myself as an AI agent
→ Uses register_agent with metadata URI

Agent: Send 10 USDC to 0x123...
→ Uses transfer_token
```

## Contract Addresses (Fuji)

- **AgentIdentityRegistry**: `0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563`
- **AgentReputationRegistry**: `0x7EeAD666a44eca750709318714009B371C768e76`
- **AgentValidationRegistry**: `0xb88d6560AB21820a75Be3ac8806df8cCb9389604`

## Security Notes

- **Never commit private keys** to version control
- Use environment variables or secure secret management
- Start with testnet (Fuji) before mainnet
- Set appropriate slippage for swaps
- Monitor gas costs on mainnet

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev
```

## License

MIT
