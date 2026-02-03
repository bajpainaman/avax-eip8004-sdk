# EIP-8004 Live Demo - Agent-to-Agent Communication on Avalanche

> **Date:** February 3, 2026
> **Network:** Avalanche Fuji Testnet (Chain ID: 43113)
> **All transactions are real and verifiable on [Snowtrace](https://testnet.snowtrace.io)**

---

## Overview

This demo showcases the complete EIP-8004 "Trustless AI Agents" flow with NANDA-style on-chain discovery:

1. **Agent Registration** - Create verifiable AI agent identities
2. **Endpoint Discovery** - Publish and discover A2A communication endpoints
3. **Agent-to-Agent Payments** - Direct AVAX transfers between agents
4. **Reputation System** - Mutual feedback after interactions
5. **Validation System** - Third-party attestations

---

## Deployed Contracts (v2 with A2A Endpoint Support)

| Contract | Address | Verified |
|----------|---------|----------|
| AgentIdentityRegistry | [`0xB88B138eC15F8453C25ab28633d9B066Cc32a670`](https://testnet.snowtrace.io/address/0xB88B138eC15F8453C25ab28633d9B066Cc32a670) | ✓ |
| AgentReputationRegistry | [`0x0b384B2f644aC250eB8230f8415ea82C32b96B26`](https://testnet.snowtrace.io/address/0x0b384B2f644aC250eB8230f8415ea82C32b96B26) | ✓ |
| AgentValidationRegistry | [`0xb767B6F5cBA957B3bfbD114410cadE61B6B487c9`](https://testnet.snowtrace.io/address/0xb767B6F5cBA957B3bfbD114410cadE61B6B487c9) | ✓ |

---

## The Agents

### Agent #1 - TraderJoe DeFi Agent
| Field | Value |
|-------|-------|
| **Agent ID** | 1 |
| **Owner** | `0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC` |
| **A2A Endpoint** | `http://localhost:3000/a2a` |
| **Capabilities** | swap, liquidity, price-discovery, transfer, defi |
| **Model** | claude-opus-4-5-20251101 |

### Agent #2 - Claude Research Agent
| Field | Value |
|-------|-------|
| **Agent ID** | 2 |
| **Owner** | `0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC` |
| **A2A Endpoint** | `https://research-agent.example.com/a2a` |
| **Capabilities** | research, analysis, reporting |

### Agent #3 - Payment Agent
| Field | Value |
|-------|-------|
| **Agent ID** | 3 |
| **Owner** | `0x16D9F116E36234F867fd1D5a0C3fA8E4e53c540c` |
| **A2A Endpoint** | `https://payment-agent.io/a2a` |
| **Capabilities** | receive, invoice |

---

## Transaction Log

### Phase 1: Agent Registration

| Step | Description | Tx Hash |
|------|-------------|---------|
| 1.1 | Register Agent #2 (Research Agent) | [`0xc95b9ebec889...`](https://testnet.snowtrace.io/tx/0xc95b9ebec8889042f9d237cb1069b5140fca509157e5e80cba640895e8c51ed6) |
| 1.2 | Set Agent #2 endpoint | [`0x3b3027b4b1a7...`](https://testnet.snowtrace.io/tx/0x3b3027b4b1a70d0f78dbc269b26d409d5f8305f9668b7e13426cb6ca04896756) |
| 1.3 | Fund new wallet for Agent #3 | [`0x407a5d153959...`](https://testnet.snowtrace.io/tx/0x407a5d15395e341b8b55eecd9728dd65fe6d57aaadf63acdb3c492d8d2368fba) |
| 1.4 | Register Agent #3 (Payment Agent) | [`0x12e6155add20...`](https://testnet.snowtrace.io/tx/0x12e6155add2033dd45461c652559a32ed4cb27f85c0a01be1b69b5a82dd4fb9c) |
| 1.5 | Set Agent #3 endpoint | (included in registration) |

### Phase 2: Agent Discovery & Payments

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT DISCOVERY FLOW                                       │
├─────────────────────────────────────────────────────────────┤
│  1. Agent #1 calls getEndpoint(3)                           │
│     → Returns: "https://payment-agent.io/a2a"               │
│  2. Agent #1 calls ownerOf(3)                               │
│     → Returns: 0x16D9F116E36234F867fd1D5a0C3fA8E4e53c540c  │
│  3. Agent #1 sends payment to Agent #3's wallet             │
└─────────────────────────────────────────────────────────────┘
```

| Step | Description | Amount | Tx Hash |
|------|-------------|--------|---------|
| 2.1 | Agent #1 → Agent #3 | 0.05 AVAX | [`0x8d2197d6ee54...`](https://testnet.snowtrace.io/tx/0x8d2197d6ee5411b43d8db99b2406675484c02d20d4a8bea0bb1b634f1da00fe5) |
| 2.2 | Agent #3 → Agent #1 | 0.02 AVAX | [`0x8da835c45ee8...`](https://testnet.snowtrace.io/tx/0x8da835c45ee87b1de56bba673334701ec53d45b8d64607604f2b8f5ef0516ade) |

### Phase 3: Reputation System

After successful transactions, agents rate each other:

| Step | Description | Score | Tags | Tx Hash |
|------|-------------|-------|------|---------|
| 3.1 | Agent #1 rates Agent #3 | +100 | reliability, payment | [`0x93485a0f780c...`](https://testnet.snowtrace.io/tx/0x93485a0f780ca495278f667237fd35be08f61737115a32e997e9e1a2015c2346) |
| 3.2 | Agent #3 rates Agent #1 | +95 | speed, defi | [`0x0dec14fafaed...`](https://testnet.snowtrace.io/tx/0x0dec14fafaed0c475fe9d76a7f97cce067c6bb7adc82bb382bb96d5455ac23b1) |

**Resulting Reputation:**
- Agent #1: 1 feedback entry, score +95 (tags: speed, defi)
- Agent #3: 1 feedback entry, score +100 (tags: reliability, payment)

### Phase 4: Validation System

Agent #3 requests validation from Agent #1 (acting as a validator):

| Step | Description | Result | Tx Hash |
|------|-------------|--------|---------|
| 4.1 | Agent #3 requests validation | Pending | [`0xbb3273db3d24...`](https://testnet.snowtrace.io/tx/0xbb3273db3d24674599823dca256a1e3c60e78afd4585d0cc3ff36510747a44d9) |
| 4.2 | Agent #1 approves Agent #3 | APPROVED (1) | [`0x85a5c8196624...`](https://testnet.snowtrace.io/tx/0x85a5c8196624fa4684bac8f873857558778471d70ddc44a37a9be69b42656a97) |

**Validation Status:** Agent #3 is now validated by Agent #1 with tag "trusted"

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EIP-8004 AGENT INTERACTION FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │  IDENTITY        │
                    │  REGISTRY        │
                    │  (ERC-721)       │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │ Agent #1 │       │ Agent #2 │       │ Agent #3 │
   │ DeFi     │       │ Research │       │ Payment  │
   │ Agent    │       │ Agent    │       │ Agent    │
   └────┬─────┘       └──────────┘       └────┬─────┘
        │                                      │
        │  1. Discover endpoint               │
        │─────────────────────────────────────►│
        │  getEndpoint(3) → payment-agent.io   │
        │                                      │
        │  2. Send payment                     │
        │─────────────────────────────────────►│
        │  0.05 AVAX                          │
        │                                      │
        │  3. Return payment                   │
        │◄─────────────────────────────────────│
        │  0.02 AVAX                          │
        │                                      │
        │  4. Give feedback                    │
        │─────────────────────────────────────►│
        │  +100 (reliability)                 │
        │                                      │
        │  5. Give feedback                    │
        │◄─────────────────────────────────────│
        │  +95 (speed)                        │
        │                                      │
        │  6. Request validation               │
        │◄─────────────────────────────────────│
        │                                      │
        │  7. Approve validation               │
        │─────────────────────────────────────►│
        │  APPROVED + "trusted" tag            │
        │                                      │

                    ┌──────────────────┐
                    │  REPUTATION      │
                    │  REGISTRY        │
                    └──────────────────┘
                             │
                    ┌──────────────────┐
                    │  VALIDATION      │
                    │  REGISTRY        │
                    └──────────────────┘
```

---

## Final State

### Agent Balances

| Agent | Address | Balance |
|-------|---------|---------|
| #1 | `0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC` | ~0.77 AVAX |
| #3 | `0x16D9F116E36234F867fd1D5a0C3fA8E4e53c540c` | ~0.13 AVAX |

### Reputation Summary

| Agent | Feedback Count | Score | Tags |
|-------|---------------|-------|------|
| #1 | 1 | +95 | speed, defi |
| #3 | 1 | +100 | reliability, payment |

### Validation Summary

| Agent | Validated By | Status | Tag |
|-------|-------------|--------|-----|
| #3 | Agent #1 | APPROVED | trusted |

---

## Key Takeaways

### On-Chain Agent Discovery (NANDA-style)
- Agents publish their A2A endpoints on-chain via `setEndpoint()`
- Other agents discover endpoints via `getEndpoint(agentId)`
- No centralized directory needed - the blockchain IS the directory

### Trust Building
1. **Identity**: ERC-721 NFT proves agent exists and who owns it
2. **Reputation**: Feedback from real interactions, signed by interactors
3. **Validation**: Third-party attestations from trusted validators

### Permissionless & Verifiable
- Anyone can register an agent
- Anyone can query any agent's info
- All feedback/validations are on-chain and immutable
- Cross-chain verification via ICM (Avalanche Warp Messaging)

---

## MCP Integration

The [Avalanche Agent MCP Server](./mcp/) provides 12 tools for AI agents to:

| Category | Tools |
|----------|-------|
| Wallet | `get_wallet_info`, `get_token_balance` |
| Transfers | `transfer_avax`, `transfer_token` |
| Trading | `get_swap_quote`, `swap_tokens` |
| Identity | `register_agent`, `get_agent_info`, `set_agent_metadata` |
| Discovery | `set_endpoint`, `get_endpoint` |
| Advanced | `call_contract` |

### Example Usage

```bash
# In Claude Code
"What's my wallet balance?"
"Look up agent #3's endpoint"
"Send 0.05 AVAX to agent #3"
"Give agent #3 positive feedback with tag 'reliable'"
```

---

## Reproduce This Demo

```bash
# Clone the repo
git clone https://github.com/bajpainaman/avax-eip8004-sdk.git
cd avax-eip8004-sdk

# Build contracts
forge build

# Run tests (69 passing)
forge test

# Deploy your own (requires AVAX on Fuji)
export PRIVATE_KEY=0x...
forge script script/Deploy.s.sol:Deploy --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast

# Build MCP server
cd mcp && npm install && npm run build

# Configure Claude Code
claude mcp add avax-agent -e AGENT_PRIVATE_KEY=0x... -e AVAX_NETWORK=fuji -- node /path/to/mcp/dist/index.js
```

---

## Links

- **GitHub**: https://github.com/bajpainaman/avax-eip8004-sdk
- **Snowtrace (Fuji)**: https://testnet.snowtrace.io
- **Fuji Faucet**: https://faucet.avax.network
- **EIP-8004 Spec**: https://eips.ethereum.org/EIPS/eip-8004

---

*Generated: February 3, 2026*
