import type { PublicClient, WalletClient } from 'viem';

import type { ChainConfig, SDKConfig } from './types';
import { IdentityRegistryClient } from './contracts/identity';
import { ReputationRegistryClient } from './contracts/reputation';
import { ValidationRegistryClient } from './contracts/validation';
import { CrossChainVerifierClient } from './contracts/crosschain';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SDK CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EIP-8004 Agent SDK for Avalanche
 *
 * Provides type-safe access to the agent identity, reputation, and validation
 * registries, as well as cross-chain verification capabilities.
 *
 * @example
 * ```typescript
 * import { createPublicClient, createWalletClient, http } from 'viem';
 * import { avalancheFuji } from 'viem/chains';
 * import { AgentSDK, createFujiConfig } from '@avax/eip8004-sdk';
 *
 * const publicClient = createPublicClient({ chain: avalancheFuji, transport: http() });
 * const walletClient = createWalletClient({ chain: avalancheFuji, transport: http() });
 *
 * const sdk = new AgentSDK({
 *   chain: createFujiConfig({
 *     identityRegistry: '0x...',
 *     reputationRegistry: '0x...',
 *     validationRegistry: '0x...',
 *   }),
 * }, publicClient, walletClient);
 *
 * // Register an agent
 * const txHash = await sdk.identity.register({ agentURI: 'ipfs://...' });
 * ```
 */
export class AgentSDK {
  /**
   * Chain configuration including contract addresses
   */
  public readonly chain: ChainConfig;

  /**
   * Identity registry client for agent registration and management
   */
  public readonly identity: IdentityRegistryClient;

  /**
   * Reputation registry client for feedback management
   */
  public readonly reputation: ReputationRegistryClient;

  /**
   * Validation registry client for third-party validations
   */
  public readonly validation: ValidationRegistryClient;

  /**
   * Cross-chain verifier client (if configured)
   */
  public readonly crosschain: CrossChainVerifierClient | null;

  /**
   * Public client for read operations
   */
  private readonly publicClient: PublicClient;

  /**
   * Wallet client for write operations (optional)
   */
  private readonly walletClient?: WalletClient;

  /**
   * Create a new AgentSDK instance
   *
   * @param config - SDK configuration including chain config
   * @param publicClient - Viem public client for read operations
   * @param walletClient - Optional viem wallet client for write operations
   */
  constructor(
    config: SDKConfig,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ) {
    this.chain = config.chain;
    this.publicClient = publicClient;
    this.walletClient = walletClient;

    const { contracts } = config.chain;

    // Initialize registry clients
    this.identity = new IdentityRegistryClient(
      contracts.identityRegistry,
      publicClient,
      walletClient
    );

    this.reputation = new ReputationRegistryClient(
      contracts.reputationRegistry,
      publicClient,
      walletClient
    );

    this.validation = new ValidationRegistryClient(
      contracts.validationRegistry,
      publicClient,
      walletClient
    );

    // Initialize cross-chain client if verifier is configured
    this.crosschain = contracts.crossChainVerifier
      ? new CrossChainVerifierClient(
          contracts.crossChainVerifier,
          publicClient,
          walletClient
        )
      : null;
  }

  /**
   * Get the current chain ID
   */
  get chainId(): number {
    return this.chain.chainId;
  }

  /**
   * Get the Avalanche blockchain ID (for cross-chain operations)
   */
  get blockchainId(): `0x${string}` {
    return this.chain.blockchainId;
  }

  /**
   * Check if cross-chain operations are available
   */
  get hasCrossChain(): boolean {
    return this.crosschain !== null;
  }

  /**
   * Check if wallet is connected for write operations
   */
  get hasWallet(): boolean {
    return this.walletClient !== undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an AgentSDK instance for read-only operations
 *
 * @param config - SDK configuration
 * @param publicClient - Viem public client
 */
export function createReadOnlySDK(
  config: SDKConfig,
  publicClient: PublicClient
): AgentSDK {
  return new AgentSDK(config, publicClient);
}

/**
 * Create an AgentSDK instance with full write capabilities
 *
 * @param config - SDK configuration
 * @param publicClient - Viem public client
 * @param walletClient - Viem wallet client
 */
export function createSDK(
  config: SDKConfig,
  publicClient: PublicClient,
  walletClient: WalletClient
): AgentSDK {
  return new AgentSDK(config, publicClient, walletClient);
}
