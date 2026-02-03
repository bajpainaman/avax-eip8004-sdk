import type { Address, Hash, Hex } from 'viem';

// ═══════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Metadata entry for agent registration
 */
export interface MetadataEntry {
  readonly key: string;
  readonly value: Hex;
}

/**
 * Feedback given to an agent
 */
export interface Feedback {
  readonly client: Address;
  readonly value: bigint;
  readonly valueDecimals: number;
  readonly tag1: string;
  readonly tag2: string;
  readonly endpoint: string;
  readonly feedbackURI: string;
  readonly feedbackHash: Hash;
  readonly responseURI: string;
  readonly responseHash: Hash;
  readonly timestamp: bigint;
  readonly revoked: boolean;
}

/**
 * Validation request for an agent
 */
export interface ValidationRequest {
  readonly requester: Address;
  readonly validator: Address;
  readonly agentId: bigint;
  readonly requestURI: string;
  readonly requestHash: Hash;
  readonly response: number;
  readonly responseURI: string;
  readonly responseHash: Hash;
  readonly tag: string;
  readonly timestamp: bigint;
}

/**
 * Summary of feedback or validations
 */
export interface Summary {
  readonly count: bigint;
  readonly value: bigint;
  readonly decimals: number;
}

/**
 * Cross-chain agent verification result
 */
export interface AgentVerification {
  readonly exists: boolean;
  readonly owner: Address;
  readonly agentURI: string;
  readonly reputationScore: bigint;
  readonly feedbackCount: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE CODES
// ═══════════════════════════════════════════════════════════════════════════

export const ResponseCode = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  INCONCLUSIVE: 3,
} as const;

export type ResponseCode = (typeof ResponseCode)[keyof typeof ResponseCode];

// ═══════════════════════════════════════════════════════════════════════════
// SDK CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contract addresses for a deployment
 */
export interface ContractAddresses {
  readonly identityRegistry: Address;
  readonly reputationRegistry: Address;
  readonly validationRegistry: Address;
  readonly crossChainVerifier?: Address;
  readonly registryResponder?: Address;
}

/**
 * Chain configuration for the SDK
 */
export interface ChainConfig {
  readonly chainId: number;
  readonly name: string;
  readonly blockchainId: Hash; // Avalanche blockchain ID (32 bytes)
  readonly teleporter?: Address;
  readonly contracts: ContractAddresses;
}

/**
 * SDK initialization options
 */
export interface SDKConfig {
  readonly chain: ChainConfig;
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════

export interface RegisterAgentParams {
  readonly agentURI?: string;
  readonly metadata?: readonly MetadataEntry[];
}

export interface GiveFeedbackParams {
  readonly agentId: bigint;
  readonly value: bigint;
  readonly valueDecimals?: number;
  readonly tag1?: string;
  readonly tag2?: string;
  readonly endpoint?: string;
  readonly feedbackURI?: string;
  readonly feedbackHash?: Hash;
}

export interface ValidationRequestParams {
  readonly validator: Address;
  readonly agentId: bigint;
  readonly requestURI?: string;
  readonly requestHash: Hash;
}

export interface ValidationResponseParams {
  readonly requestHash: Hash;
  readonly response: ResponseCode;
  readonly responseURI?: string;
  readonly responseHash?: Hash;
  readonly tag?: string;
}

export interface WalletLinkParams {
  readonly agentId: bigint;
  readonly wallet: Address;
  readonly deadline: bigint;
  readonly signature: Hex;
}

export interface VerifyAgentParams {
  readonly sourceChain: Hash;
  readonly agentId: bigint;
}

export interface QueryReputationParams {
  readonly sourceChain: Hash;
  readonly agentId: bigint;
  readonly clients?: readonly Address[];
  readonly tag1?: string;
  readonly tag2?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION RESULTS
// ═══════════════════════════════════════════════════════════════════════════

export interface TransactionResult {
  readonly hash: Hash;
  readonly wait: () => Promise<TransactionReceipt>;
}

export interface TransactionReceipt {
  readonly blockNumber: bigint;
  readonly blockHash: Hash;
  readonly transactionHash: Hash;
  readonly status: 'success' | 'reverted';
  readonly gasUsed: bigint;
}

export interface RegisterAgentResult extends TransactionResult {
  readonly agentId: bigint;
}

export interface VerifyAgentResult extends TransactionResult {
  readonly requestId: Hash;
}
