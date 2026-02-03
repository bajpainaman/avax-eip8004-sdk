import type {
  Address,
  Hash,
  Hex,
  PublicClient,
  WalletClient,
} from 'viem';
import type { Feedback, GiveFeedbackParams, Summary } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// ABI
// ═══════════════════════════════════════════════════════════════════════════

export const AgentReputationRegistryABI = [
  // Read functions
  {
    type: 'function',
    name: 'getFeedbackCount',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getClientFeedbackCount',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'client', type: 'address' },
    ],
    outputs: [{ type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'readFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'client', type: 'address' },
      { name: 'index', type: 'uint64' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'client', type: 'address' },
          { name: 'value', type: 'int128' },
          { name: 'valueDecimals', type: 'uint8' },
          { name: 'tag1', type: 'string' },
          { name: 'tag2', type: 'string' },
          { name: 'endpoint', type: 'string' },
          { name: 'feedbackURI', type: 'string' },
          { name: 'feedbackHash', type: 'bytes32' },
          { name: 'responseURI', type: 'string' },
          { name: 'responseHash', type: 'bytes32' },
          { name: 'timestamp', type: 'uint64' },
          { name: 'revoked', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSummary',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clients', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'count', type: 'uint64' },
          { name: 'value', type: 'int128' },
          { name: 'decimals', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'giveFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'index', type: 'uint64' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'appendResponse',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'client', type: 'address' },
      { name: 'index', type: 'uint64' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'FeedbackGiven',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'index', type: 'uint64', indexed: true },
      { name: 'value', type: 'int128', indexed: false },
      { name: 'tag1', type: 'string', indexed: false },
      { name: 'tag2', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FeedbackRevoked',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'index', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ResponseAppended',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'index', type: 'uint64', indexed: false },
    ],
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reputation Registry client for feedback management
 */
export class ReputationRegistryClient {
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
   * Get total feedback count for an agent
   */
  async getFeedbackCount(agentId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentReputationRegistryABI,
      functionName: 'getFeedbackCount',
      args: [agentId],
    }) as Promise<bigint>;
  }

  /**
   * Get feedback count from a specific client
   */
  async getClientFeedbackCount(
    agentId: bigint,
    client: Address
  ): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentReputationRegistryABI,
      functionName: 'getClientFeedbackCount',
      args: [agentId, client],
    }) as Promise<bigint>;
  }

  /**
   * Read a specific feedback entry
   */
  async readFeedback(
    agentId: bigint,
    client: Address,
    index: bigint
  ): Promise<Feedback> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: AgentReputationRegistryABI,
      functionName: 'readFeedback',
      args: [agentId, client, index],
    });

    // Map tuple to Feedback type
    const fb = result as {
      client: Address;
      value: bigint;
      valueDecimals: number;
      tag1: string;
      tag2: string;
      endpoint: string;
      feedbackURI: string;
      feedbackHash: Hash;
      responseURI: string;
      responseHash: Hash;
      timestamp: bigint;
      revoked: boolean;
    };

    return {
      client: fb.client,
      value: fb.value,
      valueDecimals: fb.valueDecimals,
      tag1: fb.tag1,
      tag2: fb.tag2,
      endpoint: fb.endpoint,
      feedbackURI: fb.feedbackURI,
      feedbackHash: fb.feedbackHash,
      responseURI: fb.responseURI,
      responseHash: fb.responseHash,
      timestamp: fb.timestamp,
      revoked: fb.revoked,
    };
  }

  /**
   * Get aggregated summary for an agent
   */
  async getSummary(
    agentId: bigint,
    clients: readonly Address[],
    tag1 = '',
    tag2 = ''
  ): Promise<Summary> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: AgentReputationRegistryABI,
      functionName: 'getSummary',
      args: [agentId, clients as Address[], tag1, tag2],
    });

    const summary = result as {
      count: bigint;
      value: bigint;
      decimals: number;
    };

    return {
      count: summary.count,
      value: summary.value,
      decimals: summary.decimals,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WRITE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new Error('WalletClient required for write operations');
    }
    return this.walletClient;
  }

  /**
   * Give feedback to an agent
   */
  async giveFeedback(params: GiveFeedbackParams): Promise<Hash> {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();

    return wallet.writeContract({
      chain: wallet.chain,
      account,
      address: this.address,
      abi: AgentReputationRegistryABI,
      functionName: 'giveFeedback',
      args: [
        params.agentId,
        params.value,
        params.valueDecimals ?? 2,
        params.tag1 ?? '',
        params.tag2 ?? '',
        params.endpoint ?? '',
        params.feedbackURI ?? '',
        params.feedbackHash ?? ('0x' + '0'.repeat(64)) as Hash,
      ],
    });
  }

  /**
   * Revoke previously given feedback
   */
  async revokeFeedback(agentId: bigint, index: bigint): Promise<Hash> {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();

    return wallet.writeContract({
      chain: wallet.chain,
      account,
      address: this.address,
      abi: AgentReputationRegistryABI,
      functionName: 'revokeFeedback',
      args: [agentId, index],
    });
  }

  /**
   * Append a response to feedback (agent owner only)
   */
  async appendResponse(
    agentId: bigint,
    client: Address,
    index: bigint,
    responseURI: string,
    responseHash: Hash
  ): Promise<Hash> {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();

    return wallet.writeContract({
      chain: wallet.chain,
      account,
      address: this.address,
      abi: AgentReputationRegistryABI,
      functionName: 'appendResponse',
      args: [agentId, client, index, responseURI, responseHash],
    });
  }
}
