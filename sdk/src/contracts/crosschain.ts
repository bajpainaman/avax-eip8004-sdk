import type {
  Address,
  Hash,
  PublicClient,
  WalletClient,
} from 'viem';
import type {
  AgentVerification,
  QueryReputationParams,
  VerifyAgentParams,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// ABI
// ═══════════════════════════════════════════════════════════════════════════

export const CrossChainAgentVerifierABI = [
  // Read functions
  {
    type: 'function',
    name: 'remoteRegistries',
    inputs: [{ name: 'chainId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingRequests',
    inputs: [{ name: 'requestId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRequestPending',
    inputs: [{ name: 'requestId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVerificationResult',
    inputs: [{ name: 'requestId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'exists', type: 'bool' },
          { name: 'owner', type: 'address' },
          { name: 'agentURI', type: 'string' },
          { name: 'reputationScore', type: 'int256' },
          { name: 'feedbackCount', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'requiredGasLimit',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'verifyAgent',
    inputs: [
      { name: 'sourceChain', type: 'bytes32' },
      { name: 'agentId', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'queryReputation',
    inputs: [
      { name: 'sourceChain', type: 'bytes32' },
      { name: 'agentId', type: 'uint256' },
      { name: 'clients', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'configureRegistry',
    inputs: [
      { name: 'chainId', type: 'bytes32' },
      { name: 'registry', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setRequiredGasLimit',
    inputs: [{ name: 'gasLimit', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'VerificationRequested',
    inputs: [
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'sourceChain', type: 'bytes32', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'requester', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VerificationReceived',
    inputs: [
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'exists', type: 'bool', indexed: false },
      { name: 'reputationScore', type: 'int256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReputationQueried',
    inputs: [
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'sourceChain', type: 'bytes32', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ReputationReceived',
    inputs: [
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'feedbackCount', type: 'uint64', indexed: false },
      { name: 'aggregateScore', type: 'int128', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RegistryConfigured',
    inputs: [
      { name: 'chainId', type: 'bytes32', indexed: true },
      { name: 'registry', type: 'address', indexed: false },
    ],
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cross-chain verifier client for remote agent verification
 */
export class CrossChainVerifierClient {
  private readonly address: Address;
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;

  constructor(
    address: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ) {
    this.address = address;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // READ FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the configured registry address for a chain
   */
  async getRemoteRegistry(chainId: Hash): Promise<Address> {
    return this.publicClient.readContract({
      address: this.address,
      abi: CrossChainAgentVerifierABI,
      functionName: 'remoteRegistries',
      args: [chainId],
    }) as Promise<Address>;
  }

  /**
   * Check if a verification request is pending
   */
  async isRequestPending(requestId: Hash): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.address,
      abi: CrossChainAgentVerifierABI,
      functionName: 'isRequestPending',
      args: [requestId],
    }) as Promise<boolean>;
  }

  /**
   * Get the verification result for a completed request
   */
  async getVerificationResult(requestId: Hash): Promise<AgentVerification> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: CrossChainAgentVerifierABI,
      functionName: 'getVerificationResult',
      args: [requestId],
    });

    const verification = result as {
      exists: boolean;
      owner: Address;
      agentURI: string;
      reputationScore: bigint;
      feedbackCount: bigint;
    };

    return {
      exists: verification.exists,
      owner: verification.owner,
      agentURI: verification.agentURI,
      reputationScore: verification.reputationScore,
      feedbackCount: verification.feedbackCount,
    };
  }

  /**
   * Get the required gas limit for cross-chain messages
   */
  async getRequiredGasLimit(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.address,
      abi: CrossChainAgentVerifierABI,
      functionName: 'requiredGasLimit',
    }) as Promise<bigint>;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WRITE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new Error('WalletClient required for write operations');
    }
    if (!this.walletClient.account) {
      throw new Error('WalletClient must have an account for signing');
    }
    return this.walletClient;
  }

  /**
   * Request verification of an agent on a remote chain
   * @returns The request ID for tracking the verification
   */
  async verifyAgent(params: VerifyAgentParams): Promise<Hash> {
    const wallet = this.requireWallet();

    return wallet.writeContract({
      chain: wallet.chain,
      account: wallet.account!,
      address: this.address,
      abi: CrossChainAgentVerifierABI,
      functionName: 'verifyAgent',
      args: [params.sourceChain, params.agentId],
    });
  }

  /**
   * Query reputation of an agent on a remote chain
   * @returns The request ID for tracking the query
   */
  async queryReputation(params: QueryReputationParams): Promise<Hash> {
    const wallet = this.requireWallet();

    return wallet.writeContract({
      chain: wallet.chain,
      account: wallet.account!,
      address: this.address,
      abi: CrossChainAgentVerifierABI,
      functionName: 'queryReputation',
      args: [
        params.sourceChain,
        params.agentId,
        params.clients ?? [],
        params.tag1 ?? '',
        params.tag2 ?? '',
      ],
    });
  }

  /**
   * Configure a remote registry address (owner only)
   */
  async configureRegistry(chainId: Hash, registry: Address): Promise<Hash> {
    const wallet = this.requireWallet();

    return wallet.writeContract({
      chain: wallet.chain,
      account: wallet.account!,
      address: this.address,
      abi: CrossChainAgentVerifierABI,
      functionName: 'configureRegistry',
      args: [chainId, registry],
    });
  }

  /**
   * Set the required gas limit for messages (owner only)
   */
  async setRequiredGasLimit(gasLimit: bigint): Promise<Hash> {
    const wallet = this.requireWallet();

    return wallet.writeContract({
      chain: wallet.chain,
      account: wallet.account!,
      address: this.address,
      abi: CrossChainAgentVerifierABI,
      functionName: 'setRequiredGasLimit',
      args: [gasLimit],
    });
  }
}
