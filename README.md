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

## Design Philosophy

**Avalanche's actual superpower**: L1 sovereignty + ICM verification when you need cross-chain trust.

**Not**: Using every feature because it exists.

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

### 3. The Only New Contract Needed

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITeleporterMessenger} from "@icm/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "@icm/ITeleporterReceiver.sol";

/**
 * @title CrossChainAgentVerifier
 * @notice Minimal contract for cross-chain agent verification via ICM
 * @dev Deploy on any L1 that needs to verify agents from other chains
 */
contract CrossChainAgentVerifier is ITeleporterReceiver {
    ITeleporterMessenger public immutable teleporter;

    // Remote registry addresses per chain
    mapping(bytes32 chainId => address registry) public registries;

    // Pending verification requests
    mapping(bytes32 requestId => address requester) public pendingRequests;

    event VerificationRequested(bytes32 indexed requestId, bytes32 sourceChain, uint256 agentId);
    event VerificationReceived(bytes32 indexed requestId, bool exists, int256 reputation);

    constructor(address _teleporter) {
        teleporter = ITeleporterMessenger(_teleporter);
    }

    /// @notice Request agent verification from authoritative chain
    function verifyAgent(
        bytes32 sourceChain,
        uint256 agentId
    ) external payable returns (bytes32 requestId) {
        require(registries[sourceChain] != address(0), "Unknown chain");

        requestId = keccak256(abi.encode(sourceChain, agentId, block.number, msg.sender));
        pendingRequests[requestId] = msg.sender;

        teleporter.sendCrossChainMessage{value: msg.value}(
            TeleporterMessageInput({
                destinationBlockchainID: sourceChain,
                destinationAddress: registries[sourceChain],
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: 100_000,
                allowedRelayerAddresses: new address[](0),
                message: abi.encode(requestId, agentId)
            })
        );

        emit VerificationRequested(requestId, sourceChain, agentId);
    }

    /// @notice Receive verification response via ICM
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override {
        require(msg.sender == address(teleporter), "Only teleporter");
        require(originSenderAddress == registries[sourceBlockchainID], "Unknown registry");

        (bytes32 requestId, bool exists, int256 reputation) =
            abi.decode(message, (bytes32, bool, int256));

        emit VerificationReceived(requestId, exists, reputation);
        delete pendingRequests[requestId];
    }
}
```

**~80 lines.** That's the entire "Avalanche-native" layer.

---

## Implementation

### Phase 1: Deploy Standard EIP-8004 on C-Chain

```bash
forge install OpenZeppelin/openzeppelin-contracts
# Deploy the three registries from EIP-8004 reference implementation
```

**Deliverables:**
- `AgentIdentityRegistry.sol` (ERC-721 based)
- `AgentReputationRegistry.sol`
- `AgentValidationRegistry.sol`

No modifications. Vanilla EIP-8004.

### Phase 2: Add Cross-Chain Verifier

```bash
forge install ava-labs/icm-contracts
```

**Deliverables:**
- `CrossChainAgentVerifier.sol` (~80 lines above)
- Handler in registries to respond to ICM queries

### Phase 3: SDK

```typescript
// That's the entire cross-chain verification API
const verification = await verifier.verifyAgent(
  CCHAIN_ID,
  agentId,
  { value: icmFee }
);
```

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

## When to Revisit

Build more infrastructure **only if**:

1. **>1000 agents** registered across multiple L1s with actual cross-chain activity
2. **ICM query latency** becomes a measurable bottleneck (it won't be)
3. **Users complain** about paying ICM fees for verification (they won't - it's cheap)

Until then: **simple wins**.

---

## The Avalanche Value Proposition

**For agents**: Register once on your home chain. Other chains can verify you via ICM.

**For L1s**: Run your own registry with your own rules. Query other chains when needed.

**For users**: Verification is always fresh (no stale caches). Trust is cryptographically proven via P-Chain validators.

This is what "Avalanche-native" should mean: **using ICM's cryptographic trust guarantees, not recreating Ethereum's monolithic state on every L1.**

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

### Native Warp Message Types

Instead of generic Teleporter messages, dedicated Warp payloads:

```go
// Warp message type for agent verification
const AgentVerificationRequest = 0x10
const AgentVerificationResponse = 0x11

type AgentVerificationRequestPayload struct {
    AgentID    ids.ID
    RequestID  [32]byte
    QueryType  uint8  // Identity, Reputation, or Validation
}

type AgentVerificationResponsePayload struct {
    RequestID   [32]byte
    Exists      bool
    Reputation  int64
    LastUpdated uint64
}
```

**Benefit**: No Teleporter contract needed. VMs can verify agents using native Warp primitives.

### VM Precompile for Agent Verification

```solidity
// Precompile at fixed address (e.g., 0x0300000000000000000000000000000000000010)
interface IAgentVerifier {
    /// @notice Verify agent exists on any Avalanche chain
    /// @dev Native precompile - no ICM round-trip needed for cached data
    function verifyAgent(
        bytes32 chainID,
        bytes32 agentID
    ) external view returns (
        bool exists,
        int64 reputation,
        uint64 lastUpdated
    );

    /// @notice Request fresh verification (triggers Warp message)
    function requestVerification(
        bytes32 chainID,
        bytes32 agentID
    ) external returns (bytes32 requestID);
}
```

**Benefit**: Any EVM contract can verify agents with a single precompile call.

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

### What the ACP Would Propose

```markdown
# ACP-XX: Native Agent Registry

## Abstract
Add first-class support for AI agent identity and reputation to Avalanche.

## Motivation
AI agents are becoming economic actors on Avalanche L1s. Current solutions
require smart contract deployments and Teleporter round-trips for cross-chain
verification. Native support would reduce costs, improve UX, and enable
validator-backed trust attestations.

## Specification

### P-Chain Changes
1. New transaction type: `RegisterAgentTx`
2. New transaction type: `AgentAttestationTx`
3. New API endpoints: `platform.getAgent`, `platform.getAgentReputation`
4. Agent state stored alongside validator state

### Warp Message Changes
1. New payload types for agent verification request/response
2. Native routing for agent queries (no Teleporter needed)

### VM Changes (Optional)
1. Agent verification precompile for EVM chains
2. Standard interface for non-EVM VMs

## Security Considerations
- Sybil resistance via optional stake requirements
- Validator attestation slashing conditions
- Rate limiting for reputation submissions

## Backwards Compatibility
- Existing smart contract registries continue to work
- Migration path from contract-based to native registration
```

### Why NOT Do an ACP (Yet)

| Reason | Explanation |
|--------|-------------|
| **Unproven demand** | Ship contracts first, see if anyone uses them |
| **Complexity** | P-Chain changes require network upgrades |
| **Validator burden** | Attestations add validator responsibilities |
| **Flexibility** | Contracts can iterate faster than protocol |

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

*Document Version: 2.1*
*Date: 2026-02-03*
