// ═══════════════════════════════════════════════════════════════════════════
// MAIN SDK
// ═══════════════════════════════════════════════════════════════════════════

export { AgentSDK, createReadOnlySDK, createSDK } from './AgentSDK';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // Core types
  MetadataEntry,
  Feedback,
  ValidationRequest,
  Summary,
  AgentVerification,
  // Configuration
  ContractAddresses,
  ChainConfig,
  SDKConfig,
  // Parameters
  RegisterAgentParams,
  GiveFeedbackParams,
  ValidationRequestParams,
  ValidationResponseParams,
  WalletLinkParams,
  VerifyAgentParams,
  QueryReputationParams,
  // Results
  TransactionResult,
  TransactionReceipt,
  RegisterAgentResult,
  VerifyAgentResult,
} from './types';

export { ResponseCode } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// CHAIN UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export {
  AvalancheBlockchainId,
  TeleporterAddress,
  createFujiConfig,
  createCChainConfig,
  createCustomL1Config,
  createLocalConfig,
} from './utils/chains';

// ═══════════════════════════════════════════════════════════════════════════
// EIP-712 UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export type { WalletLinkDomain, WalletLinkMessage } from './utils/eip712';

export {
  WALLET_LINK_TYPES,
  createWalletLinkDomain,
  computeWalletLinkStructHash,
  getWalletLinkTypedData,
  prepareWalletLink,
} from './utils/eip712';

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT CLIENTS (for advanced usage)
// ═══════════════════════════════════════════════════════════════════════════

export {
  IdentityRegistryClient,
  AgentIdentityRegistryABI,
} from './contracts/identity';

export {
  ReputationRegistryClient,
  AgentReputationRegistryABI,
} from './contracts/reputation';

export {
  ValidationRegistryClient,
  AgentValidationRegistryABI,
} from './contracts/validation';

export {
  CrossChainVerifierClient,
  CrossChainAgentVerifierABI,
} from './contracts/crosschain';
