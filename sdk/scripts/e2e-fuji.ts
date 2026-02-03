/**
 * E2E Test Script for EIP-8004 SDK on Fuji Testnet
 * Tests the complete flow: register → feedback → reputation → validation
 */

import { createPublicClient, createWalletClient, http, keccak256, toHex, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import {
  AgentSDK,
  createFujiConfig,
  ResponseCode,
} from '../src/index';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY environment variable is required');
  console.error('   Usage: PRIVATE_KEY=0x... pnpm run e2e:fuji');
  process.exit(1);
}

const FUJI_CONTRACTS = {
  identityRegistry: '0x4FbB7b494b28690C4dB0a6688D8A406d4b1A0563' as const,
  reputationRegistry: '0x7EeAD666a44eca750709318714009B371C768e76' as const,
  validationRegistry: '0xb88d6560AB21820a75Be3ac8806df8cCb9389604' as const,
  crossChainVerifier: '0xEd8233F1072685C938De42FFDff9cfd979cec28F' as const,
  registryResponder: '0xc6bbb778f9d187200f291EA3CCccAd01a662d9d8' as const,
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function log(step: string, message: string): void {
  console.log(`\n[${step}] ${message}`);
}

function success(message: string): void {
  console.log(`  ✓ ${message}`);
}

function info(message: string): void {
  console.log(`  → ${message}`);
}

async function waitForTx(publicClient: ReturnType<typeof createPublicClient>, hash: `0x${string}`): Promise<void> {
  info(`Waiting for tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'success') {
    success(`Confirmed in block ${receipt.blockNumber}`);
  } else {
    throw new Error(`Transaction reverted: ${hash}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST FLOW
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  EIP-8004 SDK E2E Test on Fuji Testnet');
  console.log('═══════════════════════════════════════════════════════════════');

  // Setup clients
  const account = privateKeyToAccount(PRIVATE_KEY);
  info(`Using account: ${account.address}`);

  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http('https://api.avax-test.network/ext/bc/C/rpc'),
  });

  const walletClient = createWalletClient({
    chain: avalancheFuji,
    transport: http('https://api.avax-test.network/ext/bc/C/rpc'),
    account,
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  info(`Balance: ${(Number(balance) / 1e18).toFixed(4)} AVAX`);

  if (balance === 0n) {
    throw new Error('No AVAX balance. Get testnet AVAX from https://faucet.avax.network/');
  }

  // Initialize SDK
  const sdk = new AgentSDK(
    {
      chain: createFujiConfig(FUJI_CONTRACTS),
    },
    publicClient,
    walletClient
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Register a new agent
  // ─────────────────────────────────────────────────────────────────────────
  log('STEP 1', 'Registering a new AI agent...');

  const timestamp = Date.now();
  const agentURI = `ipfs://QmTestAgent${timestamp}`;

  const registerTx = await sdk.identity.register({ agentURI });
  await waitForTx(publicClient, registerTx);

  // Get the new agent ID by checking total agents
  const totalAgents = await sdk.identity.totalAgents();
  const newAgentId = totalAgents;
  success(`Registered Agent #${newAgentId} with URI: ${agentURI}`);

  // Verify agent exists
  const exists = await sdk.identity.agentExists(newAgentId);
  success(`Agent exists: ${exists}`);

  // Get agent owner (using ownerOf)
  const owner = await sdk.identity.ownerOf(newAgentId);
  success(`Agent owner: ${owner}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Set metadata on the agent
  // ─────────────────────────────────────────────────────────────────────────
  log('STEP 2', 'Setting agent metadata...');

  const metadataTx = await sdk.identity.setMetadata(
    newAgentId,
    'model',
    toHex('test-model-v1')
  );
  await waitForTx(publicClient, metadataTx);
  success('Set metadata: model = test-model-v1');

  // Read back metadata
  const metadata = await sdk.identity.getMetadata(newAgentId, 'model');
  success(`Read metadata: ${metadata}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Give feedback to the agent
  // ─────────────────────────────────────────────────────────────────────────
  log('STEP 3', 'Giving feedback to agent...');

  // Positive feedback
  const feedback1Tx = await sdk.reputation.giveFeedback({
    agentId: newAgentId,
    value: 85n, // 85/100 score
    valueDecimals: 0,
    tag1: 'quality',
    tag2: 'fast',
    endpoint: '/api/chat',
  });
  await waitForTx(publicClient, feedback1Tx);
  success('Gave positive feedback: 85 (quality, fast)');

  // Another feedback
  const feedback2Tx = await sdk.reputation.giveFeedback({
    agentId: newAgentId,
    value: 92n, // 92/100 score
    valueDecimals: 0,
    tag1: 'quality',
    tag2: 'accurate',
    endpoint: '/api/analyze',
  });
  await waitForTx(publicClient, feedback2Tx);
  success('Gave positive feedback: 92 (quality, accurate)');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Query reputation summary
  // ─────────────────────────────────────────────────────────────────────────
  log('STEP 4', 'Querying reputation summary...');

  // Get feedback count
  const feedbackCount = await sdk.reputation.getFeedbackCount(newAgentId);
  success(`Total feedback count: ${feedbackCount}`);

  // Get summary (all feedback)
  const summaryAll = await sdk.reputation.getSummary(newAgentId, []);
  success(`Summary (all): count=${summaryAll.count}, value=${summaryAll.value}, decimals=${summaryAll.decimals}`);

  // Get summary filtered by tag
  const summaryQuality = await sdk.reputation.getSummary(newAgentId, [], 'quality');
  success(`Summary (quality tag): count=${summaryQuality.count}, value=${summaryQuality.value}`);

  // Read individual feedback
  const fb = await sdk.reputation.readFeedback(newAgentId, account.address, 0n);
  success(`Feedback #0: value=${fb.value}, tag1=${fb.tag1}, tag2=${fb.tag2}, endpoint=${fb.endpoint}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Request validation from a validator
  // ─────────────────────────────────────────────────────────────────────────
  log('STEP 5', 'Requesting validation...');

  // Use own address as validator for testing
  const validatorAddress = account.address;
  const requestHash = keccak256(encodePacked(['uint256', 'uint256'], [newAgentId, BigInt(timestamp)]));

  const validationReqTx = await sdk.validation.validationRequest({
    validator: validatorAddress,
    agentId: newAgentId,
    requestURI: 'ipfs://QmValidationRequest',
    requestHash,
  });
  await waitForTx(publicClient, validationReqTx);
  success(`Created validation request: ${requestHash}`);

  // Check validation status
  const validationStatus = await sdk.validation.getValidationStatus(requestHash);
  success(`Validation status: response=${validationStatus.response} (0=PENDING)`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: Respond to validation (as validator)
  // ─────────────────────────────────────────────────────────────────────────
  log('STEP 6', 'Responding to validation request...');

  const validationRespTx = await sdk.validation.validationResponse({
    requestHash,
    response: ResponseCode.APPROVED,
    responseURI: 'ipfs://QmValidationResponse',
    tag: 'security',
  });
  await waitForTx(publicClient, validationRespTx);
  success('Responded with APPROVED (1)');

  // Check updated status
  const updatedStatus = await sdk.validation.getValidationStatus(requestHash);
  success(`Updated status: response=${updatedStatus.response} (1=APPROVED), tag=${updatedStatus.tag}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 7: Query validation summary
  // ─────────────────────────────────────────────────────────────────────────
  log('STEP 7', 'Querying validation summary...');

  // Get all validations for agent
  const validations = await sdk.validation.getAgentValidations(newAgentId);
  success(`Agent has ${validations.length} validation(s)`);

  // Get validation summary
  const validationSummary = await sdk.validation.getSummary(newAgentId);
  success(`Validation summary: count=${validationSummary.count}, value=${validationSummary.value}`);

  // Summary filtered by validator
  const summaryByValidator = await sdk.validation.getSummary(newAgentId, [validatorAddress]);
  success(`Summary (by validator): count=${summaryByValidator.count}, value=${summaryByValidator.value}`);

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  E2E TEST COMPLETED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`
  Agent ID:        ${newAgentId}
  Agent URI:       ${agentURI}
  Owner:           ${owner}
  Feedback Count:  ${feedbackCount}
  Avg Reputation:  ${Number(summaryAll.value) / Number(summaryAll.count)} (raw sum: ${summaryAll.value})
  Validations:     ${validations.length}
  Validation Score: ${validationSummary.value} (APPROVED = +1)

  View on Snowtrace:
  https://testnet.snowtrace.io/address/${FUJI_CONTRACTS.identityRegistry}
  `);
}

main().catch((error) => {
  console.error('\n❌ E2E Test Failed:', error);
  process.exit(1);
});
