import type { Address, Hash } from 'viem';
import type { ChainConfig } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// AVALANCHE BLOCKCHAIN IDs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Known Avalanche blockchain IDs (32-byte hex strings)
 * These are used for cross-chain messaging via ICM/Teleporter
 */
export const AvalancheBlockchainId = {
  // C-Chain Mainnet
  C_CHAIN:
    '0x000000000000000000000000000000000000000000000000000000000000a86a' as Hash,
  // Fuji C-Chain
  FUJI_C_CHAIN:
    '0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5' as Hash,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TELEPORTER ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Teleporter Messenger contract addresses
 */
export const TeleporterAddress = {
  C_CHAIN: '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf' as Address,
  FUJI: '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf' as Address,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// PREDEFINED CHAIN CONFIGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a Fuji testnet chain config
 * @param contracts - Contract addresses for the deployment
 */
export function createFujiConfig(
  contracts: ChainConfig['contracts']
): ChainConfig {
  return {
    chainId: 43113,
    name: 'Avalanche Fuji',
    blockchainId: AvalancheBlockchainId.FUJI_C_CHAIN,
    teleporter: TeleporterAddress.FUJI,
    contracts,
  };
}

/**
 * Create a C-Chain mainnet chain config
 * @param contracts - Contract addresses for the deployment
 */
export function createCChainConfig(
  contracts: ChainConfig['contracts']
): ChainConfig {
  return {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    blockchainId: AvalancheBlockchainId.C_CHAIN,
    teleporter: TeleporterAddress.C_CHAIN,
    contracts,
  };
}

/**
 * Create a custom L1 chain config
 * @param chainId - The EVM chain ID
 * @param name - Human-readable chain name
 * @param blockchainId - Avalanche blockchain ID (from P-Chain)
 * @param contracts - Contract addresses
 * @param teleporter - Optional custom Teleporter address
 */
export function createCustomL1Config(
  chainId: number,
  name: string,
  blockchainId: Hash,
  contracts: ChainConfig['contracts'],
  teleporter?: Address
): ChainConfig {
  return {
    chainId,
    name,
    blockchainId,
    teleporter,
    contracts,
  };
}

/**
 * Create a local development chain config (Anvil)
 * @param contracts - Contract addresses from local deployment
 */
export function createLocalConfig(
  contracts: ChainConfig['contracts']
): ChainConfig {
  return {
    chainId: 31337,
    name: 'Anvil Local',
    blockchainId:
      '0x0000000000000000000000000000000000000000000000000000000000000001' as Hash,
    contracts,
  };
}
