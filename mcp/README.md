# Avalanche Agent MCP Server

> Give AI agents autonomous financial capabilities on Avalanche with EIP-8004 identity.

## What This Does

This MCP (Model Context Protocol) server transforms AI agents into autonomous blockchain operators. Agents can:

- 💼 **Manage Wallets** - Check balances, monitor portfolio
- 💸 **Transfer Assets** - Send AVAX and ERC20 tokens
- 🔄 **Trade on DEXes** - Swap tokens via Trader Joe
- 🤖 **Establish Identity** - Register as EIP-8004 verified agents
- ⚡ **Call Contracts** - Execute arbitrary smart contract functions

## Quick Start

### 1. Build the Server

```bash
cd mcp
npm install
npm run build
```

### 2. Configure Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "avax-agent": {
      "command": "node",
      "args": ["/full/path/to/avax-eip8004-sdk/mcp/dist/index.js"],
      "env": {
        "AGENT_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY",
        "AVAX_NETWORK": "fuji"
      }
    }
  }
}
```

### 3. Load the Agent Prompt

Copy the system prompt from [AGENT_PROMPT.md](./AGENT_PROMPT.md) to give your agent full context on its capabilities.

### 4. Test It!

```
> What's my wallet balance?
> Swap 0.1 AVAX for USDC
> Register me as an AI agent
```

## Available Tools

| Tool | Description | Gas Cost |
|------|-------------|----------|
| `get_wallet_info` | Check AVAX balance and address | Free |
| `get_token_balance` | Check ERC20 token balance | Free |
| `transfer_avax` | Send native AVAX | ~0.0005 AVAX |
| `transfer_token` | Send ERC20 tokens | ~0.002 AVAX |
| `get_swap_quote` | Preview swap rates | Free |
| `swap_tokens` | Execute token swap | ~0.005-0.01 AVAX |
| `register_agent` | Create EIP-8004 identity | ~0.005 AVAX |
| `get_agent_info` | Look up any agent | Free |
| `set_agent_metadata` | Store on-chain attributes | ~0.003 AVAX |
| `call_contract` | Raw contract calls | Varies |

## Supported Tokens (Fuji)

| Token | Address |
|-------|---------|
| WAVAX | `0xd00ae08403B9bbb9124bB305C09058E32C39A48c` |
| USDC | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| USDT | `0x134Dc38AE8C853D1aa2103d5047591acDAA16682` |

## EIP-8004 Contracts (Fuji)

| Contract | Address |
|----------|---------|
| AgentIdentityRegistry | `0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563` |
| AgentReputationRegistry | `0x7EeAD666a44eca750709318714009B371C768e76` |
| AgentValidationRegistry | `0xb88d6560AB21820a75Be3ac8806df8cCb9389604` |

## Example Workflows

### Trading Flow
```
1. get_wallet_info        → Check AVAX for gas
2. get_token_balance      → Check token balance
3. get_swap_quote         → Preview rate
4. swap_tokens            → Execute trade
```

### Identity Setup
```
1. register_agent         → Create identity (once)
2. set_agent_metadata     → Add model info
3. set_agent_metadata     → Add version
4. set_agent_metadata     → Add capabilities
```

### Payment Flow
```
1. get_wallet_info        → Verify funds
2. transfer_avax/token    → Execute payment
3. Report tx hash         → Provide proof
```

## Security

⚠️ **Important Security Notes:**

- Never commit private keys to version control
- Use environment variables for secrets
- Start with Fuji testnet for testing
- Keep ~0.1 AVAX buffer for gas
- Double-check addresses before transfers

## Getting Test AVAX

For Fuji testnet, get free AVAX at:
- https://faucet.avax.network
- https://core.app/tools/testnet-faucet

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode (watch)
npm run dev
```

## Architecture

```
mcp/
├── src/
│   └── index.ts          # Main MCP server (all tools)
├── dist/
│   └── index.js          # Compiled output
├── AGENT_PROMPT.md       # System prompt for agents
├── package.json
└── README.md
```

## Related

- [EIP-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [Avalanche Documentation](https://docs.avax.network)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Trader Joe DEX](https://traderjoexyz.com)

## License

MIT
