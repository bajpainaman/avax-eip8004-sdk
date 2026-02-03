import type {
  Address,
  Hash,
  PublicClient,
  WalletClient,
} from 'viem';
import type {
  Summary,
  ValidationRequest,
  ValidationRequestParams,
  ValidationResponseParams,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// ABI
// ═══════════════════════════════════════════════════════════════════════════

export const AgentValidationRegistryABI = [
  // Read functions
  {
    type: 'function',
    name: 'getValidationStatus',
    inputs: [{ name: 'requestHash', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'requester', type: 'address' },
          { name: 'validator', type: 'address' },
          { name: 'agentId', type: 'uint256' },
          { name: 'requestURI', type: 'string' },
          { name: 'requestHash', type: 'bytes32' },
          { name: 'response', type: 'uint8' },
          { name: 'responseURI', type: 'string' },
          { name: 'responseHash', type: 'bytes32' },
          { name: 'tag', type: 'string' },
          { name: 'timestamp', type: 'uint64' },
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
      { name: 'validators', type: 'address[]' },
      { name: 'tag', type: 'string' },
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
  {
    type: 'function',
    name: 'getAgentValidations',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'validationRequest',
    inputs: [
      { name: 'validator', type: 'address' },
      { name: 'agentId', type: 'uint256' },
      { name: 'requestURI', type: 'string' },
      { name: 'requestHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'validationResponse',
    inputs: [
      { name: 'requestHash', type: 'bytes32' },
      { name: 'response', type: 'uint8' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
      { name: 'tag', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'ValidationRequested',
    inputs: [
      { name: 'requestHash', type: 'bytes32', indexed: true },
      { name: 'validator', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'requester', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ValidationResponded',
    inputs: [
      { name: 'requestHash', type: 'bytes32', indexed: true },
      { name: 'response', type: 'uint8', indexed: false },
      { name: 'tag', type: 'string', indexed: false },
    ],
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validation Registry client for third-party validations
 */
export class ValidationRegistryClient {
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
   * Get the status of a validation request
   */
  async getValidationStatus(requestHash: Hash): Promise<ValidationRequest> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: AgentValidationRegistryABI,
      functionName: 'getValidationStatus',
      args: [requestHash],
    });

    const req = result as {
      requester: Address;
      validator: Address;
      agentId: bigint;
      requestURI: string;
      requestHash: Hash;
      response: number;
      responseURI: string;
      responseHash: Hash;
      tag: string;
      timestamp: bigint;
    };

    return {
      requester: req.requester,
      validator: req.validator,
      agentId: req.agentId,
      requestURI: req.requestURI,
      requestHash: req.requestHash,
      response: req.response,
      responseURI: req.responseURI,
      responseHash: req.responseHash,
      tag: req.tag,
      timestamp: req.timestamp,
    };
  }

  /**
   * Get aggregated validation summary for an agent
   */
  async getSummary(
    agentId: bigint,
    validators: readonly Address[] = [],
    tag = ''
  ): Promise<Summary> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: AgentValidationRegistryABI,
      functionName: 'getSummary',
      args: [agentId, validators as Address[], tag],
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

  /**
   * Get all validation request hashes for an agent
   */
  async getAgentValidations(agentId: bigint): Promise<readonly Hash[]> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentValidationRegistryABI,
      functionName: 'getAgentValidations',
      args: [agentId],
    }) as Promise<readonly Hash[]>;
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
   * Create a validation request
   */
  async validationRequest(params: ValidationRequestParams): Promise<Hash> {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();

    return wallet.writeContract({
      chain: wallet.chain,
      account,
      address: this.address,
      abi: AgentValidationRegistryABI,
      functionName: 'validationRequest',
      args: [
        params.validator,
        params.agentId,
        params.requestURI ?? '',
        params.requestHash,
      ],
    });
  }

  /**
   * Respond to a validation request (validator only)
   */
  async validationResponse(params: ValidationResponseParams): Promise<Hash> {
    const wallet = this.requireWallet();
    const [account] = await wallet.getAddresses();

    return wallet.writeContract({
      chain: wallet.chain,
      account,
      address: this.address,
      abi: AgentValidationRegistryABI,
      functionName: 'validationResponse',
      args: [
        params.requestHash,
        params.response,
        params.responseURI ?? '',
        params.responseHash ?? ('0x' + '0'.repeat(64)) as Hash,
        params.tag ?? '',
      ],
    });
  }
}
