# Avalanche-Native EIP-8004: Trustless Agents Architecture Plan

## Executive Summary

This document outlines the architecture for implementing EIP-8004 (Trustless Agents) natively on Avalanche, leveraging **Interchain Messaging (ICM)** and **Interchain Token Transfer (ICTT)** for cross-L1 agent discovery, reputation, and payments.

---

## 1. Understanding the Problem

### What EIP-8004 Does (Ethereum)
Three lightweight registries for AI agent trust:

| Registry | Purpose | Storage |
|----------|---------|---------|
| **Identity Registry** | ERC-721 based agent IDs with metadata | Agent URI, wallet, endpoints |
| **Reputation Registry** | Feedback signals from clients | Scores, tags, on-chain summary |
| **Validation Registry** | Third-party validation results | Validator responses, scores |

### The Avalanche Opportunity
On Ethereum, these registries live on a single chain. On Avalanche, we can make agents **truly cross-chain native**:

- Agent registered on C-Chain can serve requests on any L1
- Reputation aggregates across all L1s
- Payments work seamlessly via ICTT
- Validation can be distributed across validators

---

## 2. Architecture Decision: Hub-and-Spoke Model

### Why Hub-and-Spoke?

| Option | Pros | Cons |
|--------|------|------|
| **Hub-and-Spoke** | Leverages ICTT pattern, single source of truth, simple queries | Home chain is central point |
| **Federated** | Fully decentralized | Complex sync, split-brain risks |
| **P-Chain Native** | Most "Avalanche-native" | Requires AvalancheGo consensus changes |

**Recommendation: Hub-and-Spoke** - mirrors proven ICTT architecture, can evolve to federated later.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           P-CHAIN                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Validator Registry (existing)                               │   │
│  │  - Node IDs, BLS public keys, stake weights                  │   │
│  │  - Used by ICM for message verification                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ICM (Warp Messages)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        C-CHAIN (HOME)                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ AgentIdentity    │  │ AgentReputation  │  │ AgentValidation  │  │
│  │ RegistryHome     │  │ RegistryHome     │  │ RegistryHome     │  │
│  │                  │  │                  │  │                  │  │
│  │ - ERC721 tokens  │  │ - All feedback   │  │ - All validation │  │
│  │ - Agent URIs     │  │ - Cross-L1 agg   │  │ - Validator data │  │
│  │ - Wallet mapping │  │ - Summary calcs  │  │ - Score history  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│           │                     │                     │             │
│           └─────────────────────┼─────────────────────┘             │
│                                 │                                   │
│                    ┌────────────┴────────────┐                      │
│                    │   TeleporterMessenger   │                      │
│                    │   0x253b...5fcf         │                      │
│                    └────────────┬────────────┘                      │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│      L1-A           │ │      L1-B           │ │      L1-C           │
│  ┌───────────────┐  │ │  ┌───────────────┐  │ │  ┌───────────────┐  │
│  │ AgentRegistry │  │ │  │ AgentRegistry │  │ │  │ AgentRegistry │  │
│  │ Remote        │  │ │  │ Remote        │  │ │  │ Remote        │  │
│  │               │  │ │  │               │  │ │  │               │  │
│  │ - Cache agent │  │ │  │ - Cache agent │  │ │  │ - Cache agent │  │
│  │   data        │  │ │  │   data        │  │ │  │   data        │  │
│  │ - Local       │  │ │  │ - Local       │  │ │  │ - Local       │  │
│  │   feedback    │  │ │  │   feedback    │  │ │  │   feedback    │  │
│  │ - ICTT wallet │  │ │  │ - ICTT wallet │  │ │  │ - ICTT wallet │  │
│  └───────────────┘  │ │  └───────────────┘  │ │  └───────────────┘  │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

---

## 3. Contract Architecture

### 3.1 Identity Registry

#### AgentIdentityRegistryHome (C-Chain)

```solidity
// Extends ERC721 + TeleporterReceiver
interface IAgentIdentityRegistryHome {
    // Core registration (same as EIP-8004)
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId);

    // Avalanche-specific: Cross-chain wallet registration
    function setAgentWalletMultiChain(
        uint256 agentId,
        bytes32 destinationBlockchainID,
        address walletOnDestination,
        uint256 deadline,
        bytes calldata signature
    ) external;

    // ICM: Push agent data to remote
    function syncAgentToRemote(
        uint256 agentId,
        bytes32 destinationBlockchainID
    ) external payable;

    // ICM: Handle remote queries
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external;
}
```

#### AgentIdentityRegistryRemote (L1s)

```solidity
interface IAgentIdentityRegistryRemote {
    // Local cache of agent data
    function getAgent(uint256 agentId) external view returns (AgentData memory);

    // Request fresh data from home
    function requestAgentSync(uint256 agentId) external payable;

    // Check if agent exists (locally cached)
    function agentExists(uint256 agentId) external view returns (bool);

    // Get wallet for this chain specifically
    function getAgentWalletOnThisChain(uint256 agentId) external view returns (address);
}
```

### 3.2 Reputation Registry

#### AgentReputationRegistryHome (C-Chain)

```solidity
interface IAgentReputationRegistryHome {
    // Aggregate feedback from all chains
    struct CrossChainFeedback {
        bytes32 sourceChainID;
        address client;
        int128 value;
        uint8 decimals;
        bytes32 tag1;
        bytes32 tag2;
        string endpoint;
        bool revoked;
    }

    // Receive feedback via ICM from remotes
    function receiveCrossChainFeedback(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external;

    // Get aggregated reputation across all chains
    function getCrossChainSummary(
        uint256 agentId,
        bytes32[] calldata chainIDs,
        bytes32 tag1,
        bytes32 tag2
    ) external view returns (
        uint256 totalCount,
        int256 aggregateValue,
        uint8 decimals
    );
}
```

#### AgentReputationRegistryRemote (L1s)

```solidity
interface IAgentReputationRegistryRemote {
    // Give feedback locally (auto-syncs to home)
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 decimals,
        bytes32 tag1,
        bytes32 tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    // Query local reputation (subset)
    function getLocalSummary(
        uint256 agentId,
        bytes32 tag1,
        bytes32 tag2
    ) external view returns (uint256 count, int256 value, uint8 decimals);
}
```

### 3.3 Validation Registry

#### AgentValidationRegistryHome (C-Chain)

```solidity
interface IAgentValidationRegistryHome {
    // Register a validator (could be linked to P-Chain validator!)
    function registerValidator(
        address validatorAddress,
        string calldata validatorURI,
        bytes32[] calldata supportedChains
    ) external;

    // P-Chain integration: Link to actual network validator
    function linkToPChainValidator(
        address validatorAddress,
        bytes32 nodeID
    ) external;

    // Cross-chain validation aggregation
    function getCrossChainValidationSummary(
        uint256 agentId,
        bytes32 tag
    ) external view returns (
        uint256 totalValidations,
        uint256 averageScore,
        bytes32[] memory chains
    );
}
```

### 3.4 Payment Integration (ICTT)

```solidity
interface IAgentPaymentBridge {
    // Pay agent on their preferred chain using ICTT
    function payAgent(
        uint256 agentId,
        uint256 amount,
        bytes32 preferredChainID  // Agent's preferred chain
    ) external payable;

    // Uses ICTT sendAndCall for atomic payment + service invocation
    function payAndInvokeAgent(
        uint256 agentId,
        uint256 amount,
        bytes calldata serviceCalldata,
        address fallbackRecipient
    ) external payable;
}
```

---

## 4. P-Chain Integration Options

### Option A: Soft Integration (Recommended First)
- Validators can **optionally** register as Agent Validators
- Uses existing P-Chain data via ICM for validator identity verification
- No consensus changes required

```solidity
// In AgentValidationRegistryHome
function verifyPChainValidator(
    address validatorAddress,
    bytes32 nodeID,
    bytes calldata pChainProof  // Warp message from P-Chain
) external returns (bool);
```

### Option B: Deep Integration (Future)
- Agents registered on P-Chain itself
- Requires ACP (Avalanche Community Proposal)
- Similar to how subnets/L1s are registered

```
// Hypothetical P-Chain transaction type
RegisterAgentTx {
    agentID: [32]byte
    owner: Address
    metadataHash: [32]byte
    initialWeight: uint64
}
```

### Recommendation
Start with **Option A** - it's achievable with current infrastructure and can be upgraded to Option B via an ACP if there's ecosystem demand.

---

## 5. Message Flows

### 5.1 Agent Registration (Cross-Chain Sync)

```
User                C-Chain Home              L1-A Remote
  │                      │                         │
  │──register()─────────>│                         │
  │                      │                         │
  │                      │──[ICM: AgentCreated]───>│
  │                      │                         │
  │                      │                         │──cache agent data
  │                      │                         │
  │<─────agentId─────────│                         │
```

### 5.2 Cross-Chain Reputation Feedback

```
Client on L1-B      L1-B Remote           C-Chain Home
      │                  │                      │
      │──giveFeedback()─>│                      │
      │                  │                      │
      │                  │──[ICM: Feedback]────>│
      │                  │                      │
      │                  │                      │──aggregate
      │                  │                      │
      │                  │<─[ICM: Updated]──────│
      │                  │                      │
      │<────receipt──────│                      │
```

### 5.3 Cross-Chain Payment via ICTT

```
Payer on L1-A    ICTT TokenRemote    ICTT TokenHome    Agent Wallet (L1-B)
      │                │                   │                   │
      │──payAgent()───>│                   │                   │
      │                │                   │                   │
      │                │──[ICM: Lock]─────>│                   │
      │                │                   │                   │
      │                │                   │──[ICM: Mint]─────>│
      │                │                   │                   │
      │                │                   │                   │──receive tokens
```

---

## 6. Implementation Phases

### Phase 1: Core Contracts (4-6 weeks)

**Deliverables:**
- [ ] `AgentIdentityRegistryHome.sol`
- [ ] `AgentIdentityRegistryRemote.sol`
- [ ] `AgentReputationRegistryHome.sol`
- [ ] `AgentReputationRegistryRemote.sol`
- [ ] `AgentValidationRegistryHome.sol`
- [ ] `AgentValidationRegistryRemote.sol`
- [ ] Comprehensive test suite on local Avalanche network

**Key Dependencies:**
- icm-contracts (TeleporterMessenger, ITeleporterReceiver)
- OpenZeppelin (ERC721, AccessControl, ReentrancyGuard)

### Phase 2: ICTT Payment Integration (2-3 weeks)

**Deliverables:**
- [ ] `AgentPaymentBridge.sol`
- [ ] Integration with existing ICTT TokenHome/TokenRemote
- [ ] Support for native AVAX and ERC20 payments
- [ ] `sendAndCall` integration for atomic pay-and-invoke

### Phase 3: P-Chain Validator Linking (2-3 weeks)

**Deliverables:**
- [ ] Validator registration with optional P-Chain linking
- [ ] Warp message verification for validator identity
- [ ] Uptime-based reputation bonus for validators

### Phase 4: SDK & Tooling (3-4 weeks)

**Deliverables:**
- [ ] TypeScript SDK (`@avax/eip8004-sdk`)
- [ ] Agent registration CLI
- [ ] Cross-chain query utilities
- [ ] React hooks for dApp integration

### Phase 5: Testnet Deployment (2 weeks)

**Deliverables:**
- [ ] Deploy to Fuji C-Chain + 2-3 test L1s
- [ ] Integration tests with real ICM relayers
- [ ] Documentation and examples

---

## 7. Contract Addresses (Planned)

| Contract | Fuji C-Chain | Mainnet C-Chain |
|----------|--------------|-----------------|
| AgentIdentityRegistryHome | TBD | TBD |
| AgentReputationRegistryHome | TBD | TBD |
| AgentValidationRegistryHome | TBD | TBD |
| AgentPaymentBridge | TBD | TBD |

Remote contracts deployed per-L1 as needed.

---

## 8. Key Design Decisions

### Q: Why not register agents directly on P-Chain?

**A:** P-Chain transactions require consensus changes (ACPs). The hub-and-spoke model achieves similar functionality using existing infrastructure. An ACP can be proposed later if there's strong demand for P-Chain native agents.

### Q: Why hub-and-spoke over federated?

**A:** ICTT proves this pattern works at scale. A single source of truth simplifies:
- Agent ID uniqueness
- Reputation aggregation
- Wallet mapping

Federated model can be an evolution, not a starting point.

### Q: How do we handle ICM message fees?

**A:**
- Registration: User pays via `msg.value`
- Feedback sync: Configurable (immediate vs batched)
- Queries: Free reads from cached data, paid for fresh syncs

### Q: What if C-Chain is congested?

**A:** The "home" can be any L1. C-Chain is recommended for network effects and liquidity, but the contracts are chain-agnostic.

---

## 9. Security Considerations

### ICM-Specific Risks

| Risk | Mitigation |
|------|------------|
| Message replay | TeleporterMessenger handles nonces |
| Fake source chain | ICM verifies via P-Chain validator signatures |
| Relayer censorship | Multiple relayers, economic incentives |
| Stale cache data | TTL on remote caches, force-sync option |

### Agent-Specific Risks

| Risk | Mitigation |
|------|------------|
| Sybil agents | Reputation filtering, stake requirements (optional) |
| Fake feedback | Reviewer must not be agent owner |
| Validation gaming | Multiple validators, P-Chain linking |

---

## 10. Open Questions

1. **Should agent registration require staking?**
   - Pro: Sybil resistance
   - Con: Barrier to entry for small agents

2. **Home chain selection?**
   - C-Chain has liquidity but also congestion
   - Dedicated "Agent L1" could optimize for this use case

3. **Reputation algorithm?**
   - Simple average vs time-weighted decay
   - Cross-chain weights (feedback on home worth more?)

4. **Validator incentives?**
   - Slash for incorrect validations?
   - Rewards from agent fees?

---

## 11. References

- [EIP-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [ICM Overview](https://build.avax.network/docs/cross-chain/avalanche-warp-messaging/overview)
- [Teleporter Documentation](https://build.avax.network/docs/cross-chain/teleporter/overview)
- [ICTT Documentation](https://build.avax.network/docs/cross-chain/interchain-token-transfer/overview)
- [Validator Manager Contracts](https://build.avax.network/docs/avalanche-l1s/validator-manager/contract)
- [ICM Contracts GitHub](https://github.com/ava-labs/icm-contracts)

---

## 12. Next Steps

1. **Review this plan** - Get feedback on architecture decisions
2. **Set up Foundry project** - With icm-contracts as dependency
3. **Implement Phase 1** - Core registry contracts
4. **Local testing** - With avalanche-cli multi-L1 setup
5. **Iterate** - Based on testing results

---

*Document Version: 1.0*
*Author: Claude (Code Quality Guardian)*
*Date: 2026-02-03*
