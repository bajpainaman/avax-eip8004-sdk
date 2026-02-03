import type { Address, Hash, Hex } from 'viem';
import { encodeAbiParameters, keccak256 } from 'viem';

// ═══════════════════════════════════════════════════════════════════════════
// EIP-712 DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EIP-712 domain for AgentIdentityRegistry
 */
export interface WalletLinkDomain {
  readonly name: string;
  readonly version: string;
  readonly chainId: number;
  readonly verifyingContract: Address;
}

/**
 * Create the EIP-712 domain for wallet linking
 */
export function createWalletLinkDomain(
  chainId: number,
  registryAddress: Address
): WalletLinkDomain {
  return {
    name: 'AgentIdentityRegistry',
    version: '1',
    chainId,
    verifyingContract: registryAddress,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EIP-712 TYPED DATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WalletLink type definition for EIP-712
 */
export const WALLET_LINK_TYPES = {
  WalletLink: [
    { name: 'agentId', type: 'uint256' },
    { name: 'wallet', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/**
 * WalletLink message data
 */
export interface WalletLinkMessage {
  readonly agentId: bigint;
  readonly wallet: Address;
  readonly deadline: bigint;
}

/**
 * Compute the struct hash for a WalletLink message
 * @param message - The wallet link message
 * @returns The keccak256 hash of the encoded struct
 */
export function computeWalletLinkStructHash(
  message: WalletLinkMessage
): Hash {
  const WALLET_LINK_TYPEHASH = keccak256(
    new TextEncoder().encode(
      'WalletLink(uint256 agentId,address wallet,uint256 deadline)'
    )
  );

  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint256' },
      ],
      [WALLET_LINK_TYPEHASH, message.agentId, message.wallet, message.deadline]
    )
  );
}

/**
 * Get the full typed data for signing a wallet link
 * This can be passed directly to wallet.signTypedData()
 */
export function getWalletLinkTypedData(
  domain: WalletLinkDomain,
  message: WalletLinkMessage
) {
  return {
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    types: WALLET_LINK_TYPES,
    primaryType: 'WalletLink' as const,
    message: {
      agentId: message.agentId,
      wallet: message.wallet,
      deadline: message.deadline,
    },
  };
}

/**
 * Create a wallet link signature helper
 * Returns the typed data ready for signing and a helper to format the result
 */
export function prepareWalletLink(
  chainId: number,
  registryAddress: Address,
  agentId: bigint,
  wallet: Address,
  deadline: bigint
) {
  const domain = createWalletLinkDomain(chainId, registryAddress);
  const message: WalletLinkMessage = { agentId, wallet, deadline };
  const typedData = getWalletLinkTypedData(domain, message);

  return {
    typedData,
    /**
     * Format signature components into bytes
     */
    formatSignature: (v: number, r: Hex, s: Hex): Hex => {
      // Combine r, s, v into a single signature
      const rHex = r.slice(2);
      const sHex = s.slice(2);
      const vHex = v.toString(16).padStart(2, '0');
      return `0x${rHex}${sHex}${vHex}` as Hex;
    },
  };
}
