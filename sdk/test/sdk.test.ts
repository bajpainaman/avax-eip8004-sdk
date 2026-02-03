import { describe, it, expect } from 'vitest';
import {
  AgentSDK,
  createFujiConfig,
  createLocalConfig,
  ResponseCode,
  AvalancheBlockchainId,
  TeleporterAddress,
  prepareWalletLink,
  WALLET_LINK_TYPES,
} from '../src';

// Mock addresses for testing
const MOCK_ADDRESSES = {
  identityRegistry: '0x1111111111111111111111111111111111111111' as const,
  reputationRegistry: '0x2222222222222222222222222222222222222222' as const,
  validationRegistry: '0x3333333333333333333333333333333333333333' as const,
  crossChainVerifier: '0x4444444444444444444444444444444444444444' as const,
};

describe('SDK Configuration', () => {
  it('should create Fuji config with correct chain ID', () => {
    const config = createFujiConfig(MOCK_ADDRESSES);

    expect(config.chainId).toBe(43113);
    expect(config.name).toBe('Avalanche Fuji');
    expect(config.blockchainId).toBe(AvalancheBlockchainId.FUJI_C_CHAIN);
    expect(config.teleporter).toBe(TeleporterAddress.FUJI);
    expect(config.contracts).toBe(MOCK_ADDRESSES);
  });

  it('should create local config with Anvil chain ID', () => {
    const config = createLocalConfig(MOCK_ADDRESSES);

    expect(config.chainId).toBe(31337);
    expect(config.name).toBe('Anvil Local');
  });
});

describe('Response Codes', () => {
  it('should have correct values', () => {
    expect(ResponseCode.PENDING).toBe(0);
    expect(ResponseCode.APPROVED).toBe(1);
    expect(ResponseCode.REJECTED).toBe(2);
    expect(ResponseCode.INCONCLUSIVE).toBe(3);
  });
});

describe('EIP-712 Wallet Linking', () => {
  it('should have correct type structure', () => {
    expect(WALLET_LINK_TYPES.WalletLink).toHaveLength(3);
    expect(WALLET_LINK_TYPES.WalletLink[0]).toEqual({
      name: 'agentId',
      type: 'uint256',
    });
    expect(WALLET_LINK_TYPES.WalletLink[1]).toEqual({
      name: 'wallet',
      type: 'address',
    });
    expect(WALLET_LINK_TYPES.WalletLink[2]).toEqual({
      name: 'deadline',
      type: 'uint256',
    });
  });

  it('should prepare wallet link typed data', () => {
    const agentId = 1n;
    const wallet = '0x1234567890123456789012345678901234567890' as const;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const { typedData, formatSignature } = prepareWalletLink(
      43113,
      MOCK_ADDRESSES.identityRegistry,
      agentId,
      wallet,
      deadline
    );

    expect(typedData.domain.name).toBe('AgentIdentityRegistry');
    expect(typedData.domain.version).toBe('1');
    expect(typedData.domain.chainId).toBe(43113);
    expect(typedData.primaryType).toBe('WalletLink');
    expect(typedData.message.agentId).toBe(agentId);
    expect(typedData.message.wallet).toBe(wallet);
    expect(typedData.message.deadline).toBe(deadline);

    // Test signature formatting
    const r = '0x' + '1'.repeat(64);
    const s = '0x' + '2'.repeat(64);
    const v = 27;

    const signature = formatSignature(
      v,
      r as `0x${string}`,
      s as `0x${string}`
    );
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/);
  });
});

describe('Avalanche Constants', () => {
  it('should have valid blockchain IDs', () => {
    expect(AvalancheBlockchainId.C_CHAIN).toMatch(/^0x[0-9a-f]{64}$/);
    expect(AvalancheBlockchainId.FUJI_C_CHAIN).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should have valid Teleporter addresses', () => {
    expect(TeleporterAddress.C_CHAIN).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(TeleporterAddress.FUJI).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe('AgentSDK Class', () => {
  it('should expose chain configuration', () => {
    const config = createFujiConfig(MOCK_ADDRESSES);

    // Create a minimal mock public client
    const mockPublicClient = {
      readContract: async () => {},
    } as never;

    const sdk = new AgentSDK({ chain: config }, mockPublicClient);

    expect(sdk.chainId).toBe(43113);
    expect(sdk.blockchainId).toBe(AvalancheBlockchainId.FUJI_C_CHAIN);
    expect(sdk.hasWallet).toBe(false);
    expect(sdk.hasCrossChain).toBe(true);
  });

  it('should have null crosschain when not configured', () => {
    const config = createFujiConfig({
      identityRegistry: MOCK_ADDRESSES.identityRegistry,
      reputationRegistry: MOCK_ADDRESSES.reputationRegistry,
      validationRegistry: MOCK_ADDRESSES.validationRegistry,
      // No crossChainVerifier
    });

    const mockPublicClient = {
      readContract: async () => {},
    } as never;

    const sdk = new AgentSDK({ chain: config }, mockPublicClient);

    expect(sdk.hasCrossChain).toBe(false);
    expect(sdk.crosschain).toBeNull();
  });
});
