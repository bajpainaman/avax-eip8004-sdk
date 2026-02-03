# EIP-8004 Trustless AI Agents SDK for Avalanche

Avalanche-native implementation of [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004) with cross-chain verification via ICM (Interchain Messaging).

## TL;DR

On-chain identity, reputation, and validation registries for AI agents. Register your agent, let users rate it, get third-party validations, and verify agents across Avalanche L1s.

## What is EIP-8004?

EIP-8004 defines a standard for **Trustless AI Agents** - autonomous software that can:
- Have verifiable on-chain identity (who made this agent?)
- Build reputation through user feedback (is this agent good?)
- Get validated by trusted third parties (has this agent been audited?)

Think of it as "passports for AI agents" - letting smart contracts and users verify an agent before interacting with it.

## Why Avalanche?

Avalanche's ICM (Interchain Messaging) enables cross-chain agent verification without bridges. An agent registered on one L1 can be verified from any other Avalanche chain through P-Chain validators.

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

## Installation

### Solidity Contracts

```bash
forge install
forge build
forge test
```

### TypeScript SDK

```bash
cd sdk
pnpm install
pnpm build
```

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

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Avalanche L1                        │
├─────────────────────────────────────────────────────────────┤
│  AgentIdentityRegistry    - ERC-721 agent tokens            │
│  AgentReputationRegistry  - Feedback & scoring              │
│  AgentValidationRegistry  - Third-party validations         │
│  CrossChainAgentVerifier  - Query remote chains             │
└──────────────────────┬──────────────────────────────────────┘
                       │ ICM (Teleporter)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    C-Chain / Other L1                        │
├─────────────────────────────────────────────────────────────┤
│  AgentRegistryResponder   - Handles verification queries    │
│  AgentIdentityRegistry    - Authoritative registry          │
│  AgentReputationRegistry  - Authoritative reputation        │
└─────────────────────────────────────────────────────────────┘
```

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

## Testing

```bash
# Run all tests (69 passing)
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

## License

MIT
