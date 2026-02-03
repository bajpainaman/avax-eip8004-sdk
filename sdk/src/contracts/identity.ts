import type {
  Address,
  Hash,
  Hex,
  PublicClient,
  WalletClient,
} from 'viem';
import type {
  MetadataEntry,
  RegisterAgentParams,
  WalletLinkParams,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// ABI
// ═══════════════════════════════════════════════════════════════════════════

export const AgentIdentityRegistryABI = [
  // Read functions
  {
    type: 'function',
    name: 'agentExists',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAgents',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentByWallet',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'register',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'register',
    inputs: [
      { name: 'agentURI', type: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        components: [
          { name: 'key', type: 'string' },
          { name: 'value', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAgentURI',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'agentURI', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAgentWallet',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'wallet', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unsetAgentWallet',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentURIUpdated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'newURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MetadataUpdated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'key', type: 'string', indexed: false },
      { name: 'value', type: 'bytes', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentWalletSet',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'wallet', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentWalletUnset',
    inputs: [{ name: 'agentId', type: 'uint256', indexed: true }],
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identity Registry client for reading and writing agent data
 */
export class IdentityRegistryClient {
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
   * Check if an agent exists
   */
  async agentExists(agentId: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'agentExists',
      args: [agentId],
    }) as Promise<boolean>;
  }

  /**
   * Get the owner of an agent
   */
  async ownerOf(agentId: bigint): Promise<Address> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'ownerOf',
      args: [agentId],
    }) as Promise<Address>;
  }

  /**
   * Get the URI of an agent
   */
  async tokenURI(agentId: bigint): Promise<string> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'tokenURI',
      args: [agentId],
    }) as Promise<string>;
  }

  /**
   * Get the total number of registered agents
   */
  async totalAgents(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'totalAgents',
    }) as Promise<bigint>;
  }

  /**
   * Get the linked wallet for an agent
   */
  async getAgentWallet(agentId: bigint): Promise<Address> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'getAgentWallet',
      args: [agentId],
    }) as Promise<Address>;
  }

  /**
   * Get the agent ID for a linked wallet
   */
  async getAgentByWallet(wallet: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'getAgentByWallet',
      args: [wallet],
    }) as Promise<bigint>;
  }

  /**
   * Get metadata value for an agent
   */
  async getMetadata(agentId: bigint, key: string): Promise<Hex> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'getMetadata',
      args: [agentId, key],
    }) as Promise<Hex>;
  }

  /**
   * Get the EIP-712 domain separator
   */
  async getDomainSeparator(): Promise<Hash> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'DOMAIN_SEPARATOR',
    }) as Promise<Hash>;
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
   * Register a new agent
   */
  async register(params?: RegisterAgentParams): Promise<Hash> {
    const wallet = this.requireWallet();

    if (params?.metadata && params.metadata.length > 0) {
      return wallet.writeContract({
        chain: wallet.chain,
        account: wallet.account!,
        address: this.address,
        abi: AgentIdentityRegistryABI,
        functionName: 'register',
        args: [params.agentURI ?? '', params.metadata as MetadataEntry[]],
      });
    } else if (params?.agentURI) {
      return wallet.writeContract({
        chain: wallet.chain,
        account: wallet.account!,
        address: this.address,
        abi: AgentIdentityRegistryABI,
        functionName: 'register',
        args: [params.agentURI],
      });
    } else {
      return wallet.writeContract({
        chain: wallet.chain,
        account: wallet.account!,
        address: this.address,
        abi: AgentIdentityRegistryABI,
        functionName: 'register',
        args: [],
      });
    }
  }

  /**
   * Update the URI for an agent
   */
  async setAgentURI(agentId: bigint, agentURI: string): Promise<Hash> {
    const wallet = this.requireWallet();

    return wallet.writeContract({
      chain: wallet.chain,
      account: wallet.account!,
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'setAgentURI',
      args: [agentId, agentURI],
    });
  }

  /**
   * Set metadata for an agent
   */
  async setMetadata(
    agentId: bigint,
    key: string,
    value: Hex
  ): Promise<Hash> {
    const wallet = this.requireWallet();

    return wallet.writeContract({
      chain: wallet.chain,
      account: wallet.account!,
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'setMetadata',
      args: [agentId, key, value],
    });
  }

  /**
   * Link a wallet to an agent using EIP-712 signature
   */
  async setAgentWallet(params: WalletLinkParams): Promise<Hash> {
    const wallet = this.requireWallet();

    return wallet.writeContract({
      chain: wallet.chain,
      account: wallet.account!,
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'setAgentWallet',
      args: [params.agentId, params.wallet, params.deadline, params.signature],
    });
  }

  /**
   * Unlink a wallet from an agent
   */
  async unsetAgentWallet(agentId: bigint): Promise<Hash> {
    const wallet = this.requireWallet();

    return wallet.writeContract({
      chain: wallet.chain,
      account: wallet.account!,
      address: this.address,
      abi: AgentIdentityRegistryABI,
      functionName: 'unsetAgentWallet',
      args: [agentId],
    });
  }
}
