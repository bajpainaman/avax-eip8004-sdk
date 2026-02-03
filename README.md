# Avalanche-Native EIP-8004: Trustless AI Agents

## TL;DR

AI agents need a way to prove they're trustworthy without a central authority. EIP-8004 creates three on-chain registries (identity, reputation, validation) that let agents build verifiable track records. Our Avalanche implementation lets each L1 run its own registry while using ICM to verify agents across chains—no syncing, no caching, just ask the source.

---

## ELI5 (Explain Like I'm 5)

Imagine you want to hire a robot helper, but there are millions of robots and you don't know which ones are good.

**The problem**: How do you know if a robot is trustworthy? Right now, you'd have to trust a company (like "RobotStore") to tell you. But what if RobotStore lies? Or goes away?

**The solution**: What if every robot had a public report card that anyone could read, and that report card was stored on a blockchain so nobody could fake it or delete it?

That's EIP-8004:
- **Identity Registry** = Robot's ID card (proves who they are)
- **Reputation Registry** = Robot's report card (what people said about them)
- **Validation Registry** = Robot's test scores (verified by trusted testers)

**The Avalanche twist**: Avalanche has many different "neighborhoods" (L1s). Instead of forcing all robots to register in one place, each neighborhood keeps its own list. If someone in Neighborhood A wants to check a robot from Neighborhood B, they just ask Neighborhood B directly using Avalanche's built-in phone system (ICM).

---

## The Big Picture: Why This Matters

### The Problem We're Solving

AI agents are becoming economic actors. They:
- Execute trades
- Manage funds
- Perform services for payment
- Interact with other agents

But there's no trustless way to answer: **"Should I trust this agent with my money?"**

Current solutions require trusting:
- Centralized registries (single point of failure)
- Platform reputation systems (walled gardens)
- Self-reported credentials (easily faked)

### What EIP-8004 Provides

A **permissionless, on-chain trust layer** for AI agents:

| Registry | What It Stores | Who Writes |
|----------|---------------|------------|
| **Identity** | Agent ID (NFT), metadata URI, wallet address | Agent owner |
| **Reputation** | Feedback scores, tags, reviewer addresses | Service users |
| **Validation** | Test results, validator attestations | Third-party validators |

Anyone can:
- Register an agent (permissionless)
- Leave feedback (if they interacted with the agent)
- Query any agent's full history (transparent)

Nobody can:
- Delete negative feedback
- Fake their identity
- Manipulate their reputation without real interactions

### Why Avalanche?

Ethereum's EIP-8004 works, but it's monolithic—one registry for everyone on one chain.

Avalanche's L1 architecture enables something better:

1. **Sovereignty**: A gaming L1 might require agents to stake tokens. A DeFi L1 might require KYC validators. Each L1 sets its own rules.

2. **Scalability**: Agents register where they operate. No global state bloat.

3. **Cross-chain trust**: ICM provides cryptographically verified cross-chain queries. When L1-A asks "is this agent legit on C-Chain?", the answer is signed by P-Chain validators—not some oracle.

---

## Deployed Contracts (Fuji Testnet)

| Contract | Address |
|----------|---------|
| **AgentIdentityRegistry** | `0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563` |
| **AgentReputationRegistry** | `0x7EeAD666a44eca750709318714009B371C768e76` |
| **AgentValidationRegistry** | `0xb88d6560AB21820a75Be3ac8806df8cCb9389604` |
| **CrossChainAgentVerifier** | `0xEd8233F1072685C938De42FFDff9cfd979cec28F` |
| **AgentRegistryResponder** | `0xc6bbb778f9d187200f291EA3CCccAd01a662d9d8` |

**Chain ID:** 43113 (Avalanche Fuji)
**Teleporter:** `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf`

---

## Design Philosophy

**Avalanche's actual superpower**: L1 sovereignty + ICM verification when you need cross-chain trust.

**Not**: Using every feature because it exists.

---

## The Elegant Solution

### Core Principle: Authoritative Source + On-Demand Verification

```
┌─────────────────────────────────────────────────────────────────┐
│  Each chain is AUTHORITATIVE for agents registered on it        │
│  Cross-chain trust = ICM query to authoritative source          │
│  No sync. No caches. No stale data. No coordination.            │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture

```
   C-Chain                    L1-Gaming                 L1-DeFi
  ┌─────────────┐            ┌─────────────┐          ┌─────────────┐
  │ EIP-8004    │            │ EIP-8004    │          │ EIP-8004    │
  │ Registries  │            │ Registries  │          │ Registries  │
  │             │            │             │          │             │
  │ Agent #1    │◄─ICM query─│ "Is Agent#1 │          │ Agent #3    │
  │ Agent #2    │───reply───►│  legit?"    │          │ Agent #4    │
  └─────────────┘            └─────────────┘          └─────────────┘
        │                                                    ▲
        │                                                    │
        └──────────────────ICM query─────────────────────────┘
                        "What's Agent#4's reputation?"
```

**That's it.** Each L1 runs standard EIP-8004 registries. Cross-chain verification is a single ICM round-trip to the authoritative chain.

---

## What Makes This "Avalanche-Native"

### 1. ICM-Verified Cross-Chain Queries

```solidity
interface IAgentRegistryVerifier {
    /// @notice Query another chain's registry via ICM
    /// @dev Returns are cryptographically verified by P-Chain validators
    function verifyAgent(
        bytes32 sourceChain,
        uint256 agentId
    ) external returns (AgentVerification memory);

    /// @notice Check reputation on authoritative chain
    function queryReputation(
        bytes32 sourceChain,
        uint256 agentId,
        bytes32 tag
    ) external returns (ReputationSummary memory);
}
```

**Why this is elegant:**
- P-Chain validators already verify ICM messages - free trust anchor
- No new infrastructure, just uses existing Warp messaging
- Caller pays for cross-chain query only when they need it
- Zero stale data - always queries authoritative source

### 2. L1 Sovereignty Preserved

Each L1 can:
- Run vanilla EIP-8004 (identical to Ethereum deployment)
- Add custom stake requirements for local agents
- Implement chain-specific reputation rules
- Choose which other chains' agents to trust

```solidity
// L1-Gaming might require agents to stake their native token
contract GamingAgentRegistry is AgentIdentityRegistry {
    uint256 public constant REQUIRED_STAKE = 1000 ether;

    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external payable override returns (uint256) {
        require(msg.value >= REQUIRED_STAKE, "Insufficient stake");
        return super.register(agentURI, metadata);
    }
}
```

---

## Installation

### Solidity Contracts

```bash
forge install
forge build
forge test  # 69 tests passing
```

### TypeScript SDK

```bash
cd sdk
pnpm install
pnpm build
pnpm test  # 9 tests passing
```

---

## Quick Start

### Register an AI Agent (Solidity)

```solidity
import {AgentIdentityRegistry} from "./registries/AgentIdentityRegistry.sol";

// Register with metadata URI
uint256 agentId = registry.register("ipfs://QmAgent...");

// Add on-chain metadata
registry.setMetadata(agentId, "version", abi.encode("1.0.0"));
```

### TypeScript SDK Usage

```typescript
import { AgentSDK, createFujiConfig } from '@avax/eip8004-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http()
});

const walletClient = createWalletClient({
  chain: avalancheFuji,
  transport: http(),
  account: privateKeyToAccount('0x...')
});

const sdk = new AgentSDK({
  chain: createFujiConfig({
    identityRegistry: '0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563',
    reputationRegistry: '0x7EeAD666a44eca750709318714009B371C768e76',
    validationRegistry: '0xb88d6560AB21820a75Be3ac8806df8cCb9389604',
    crossChainVerifier: '0xEd8233F1072685C938De42FFDff9cfd979cec28F',
  }),
}, publicClient, walletClient);

// Register an agent
const txHash = await sdk.identity.register({
  agentURI: 'ipfs://QmAgentMetadata...'
});

// Give feedback to an agent
await sdk.reputation.giveFeedback({
  agentId: 1n,
  value: 100n,  // Positive score
  tag1: 'quality',
});

// Request validation
await sdk.validation.validationRequest({
  validator: '0xTrustedValidator...',
  agentId: 1n,
  requestHash: keccak256('validation-request'),
});
```

---

## Contracts

### AgentIdentityRegistry
- ERC-721 based agent identity
- EIP-712 signed wallet linking
- On-chain metadata storage
- Agent URI for off-chain data

### AgentReputationRegistry
- Signed fixed-point feedback values (int128 + decimals)
- Tag-based filtering
- Revocable feedback
- Agent owner responses

### AgentValidationRegistry
- Request validation from specific validators
- Response codes: APPROVED (1), REJECTED (2), INCONCLUSIVE (3)
- Tag-based categorization

### CrossChainAgentVerifier
- Query agents on remote Avalanche chains
- Uses Teleporter for ICM messaging
- Caches verification results

### AgentRegistryResponder
- Handles incoming ICM queries on authoritative chain
- Queries local registries and sends response

---

## What We're NOT Building

| Rejected Idea | Why |
|---------------|-----|
| Hub-and-spoke sync | Centralizes, defeats L1 sovereignty |
| Remote registry caches | Cache invalidation is unsolved; stale data = trust violations |
| ICTT payment bridge | Agents have addresses. Just send tokens. |
| P-Chain validator linking | Validators validate consensus, not AI quality |
| Push-based reputation sync | Premature optimization for non-existent multi-chain agents |

---

## If This Were an ACP: Protocol-Level Integration

The current design uses smart contracts on existing infrastructure. An ACP would make agent trust a **first-class citizen** of Avalanche at the protocol level.

### What Would Change

| Aspect | Current (Smart Contracts) | ACP (Protocol-Native) |
|--------|--------------------------|----------------------|
| **Agent Registration** | ERC-721 on EVM chains | P-Chain transaction (`RegisterAgentTx`) |
| **Identity Storage** | Contract state | P-Chain state (like validators) |
| **Cross-Chain Queries** | Teleporter round-trip | Native Warp message type |
| **Verification** | Contract call + ICM | VM precompile |
| **Gas Cost** | EVM execution + ICM fees | Minimal (native operation) |
| **Trust Anchor** | P-Chain validators (indirect) | P-Chain validators (direct) |

### P-Chain Agent Registry

```go
// New P-Chain transaction type
type RegisterAgentTx struct {
    AgentID      ids.ID           // Unique identifier
    Owner        ids.ShortID      // Owner address
    MetadataURI  string           // Off-chain metadata location
    MetadataHash [32]byte         // Content hash for verification
    Stake        uint64           // Optional stake requirement
}

// Query via P-Chain API
type GetAgentArgs struct {
    AgentID ids.ID
}

type GetAgentReply struct {
    Owner        ids.ShortID
    MetadataURI  string
    MetadataHash [32]byte
    Reputation   int64            // Aggregated on-chain
    Registered   uint64           // Timestamp
}
```

### Validator-Backed Reputation (The Big One)

This is where an ACP unlocks something smart contracts can't do:

```go
// Validators can submit reputation attestations as part of block production
type AgentAttestationTx struct {
    AgentID     ids.ID
    Score       int8           // -100 to +100
    Evidence    [32]byte       // Hash of interaction proof
    ValidatorID ids.NodeID     // Attesting validator
}
```

**Why this matters**:
- Validators have economic stake (2000+ AVAX)
- Attestations are weighted by validator stake
- Slashing for false attestations
- Creates "validator-verified agents" tier

```
┌─────────────────────────────────────────────────────────┐
│                    TRUST TIERS                          │
├─────────────────────────────────────────────────────────┤
│  Tier 3: Validator-Attested                             │
│  └─ Validators stake reputation on agent quality        │
│  └─ Highest trust, used for high-value transactions     │
│                                                         │
│  Tier 2: Community-Validated                            │
│  └─ Third-party validators (existing EIP-8004)          │
│  └─ Medium trust, standard commercial use               │
│                                                         │
│  Tier 1: Reputation-Only                                │
│  └─ User feedback aggregation                           │
│  └─ Basic trust, low-stakes interactions                │
└─────────────────────────────────────────────────────────┘
```

### The Path Forward

```
Phase 1 (Now)     → Smart contracts + ICM queries
                    Prove the concept, gather usage data

Phase 2 (6-12mo)  → If adoption, propose ACP for:
                    - Native Warp message types
                    - VM precompile for verification

Phase 3 (12-18mo) → If strong adoption, propose ACP for:
                    - P-Chain agent registry
                    - Validator attestations
```

**Bottom line**: The smart contract version is the MVP. An ACP makes sense only after proving real demand and understanding actual usage patterns.

---

## Testing

```bash
# Run all Solidity tests (69 passing)
forge test -vvv

# Run specific test
forge test --match-test testRegisterAgent

# SDK tests (9 passing)
cd sdk && pnpm test
```

## Deployment

```bash
# Set environment
export PRIVATE_KEY=0x...
export FUJI_RPC=https://api.avax-test.network/ext/bc/C/rpc

# Deploy to Fuji
forge script script/Deploy.s.sol:Deploy --rpc-url $FUJI_RPC --broadcast
```

---

## License

MIT

---

*Document Version: 2.1*
*Date: 2026-02-03*
