// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {AgentIdentityRegistry} from "../../src/registries/AgentIdentityRegistry.sol";
import {AgentReputationRegistry} from "../../src/registries/AgentReputationRegistry.sol";
import {CrossChainAgentVerifier} from "../../src/crosschain/CrossChainAgentVerifier.sol";
import {AgentRegistryResponder} from "../../src/crosschain/AgentRegistryResponder.sol";
import {MockTeleporterMessenger} from "../mocks/MockTeleporterMessenger.sol";
import {ICrossChainAgentVerifier} from "../../src/interfaces/ICrossChainAgentVerifier.sol";
import {AgentTypes} from "../../src/libraries/AgentTypes.sol";

/// @title CrossChainFlowTest
/// @notice Integration tests for cross-chain agent verification via ICM
/// @dev Simulates the full request/response flow using mock Teleporter
contract CrossChainFlowTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONTRACTS
    // ═══════════════════════════════════════════════════════════════════════════

    // Source chain (e.g., custom L1) - has the verifier
    MockTeleporterMessenger public sourceTeleporter;
    CrossChainAgentVerifier public verifier;

    // Destination chain (e.g., C-Chain) - has the authoritative registries
    MockTeleporterMessenger public destTeleporter;
    AgentIdentityRegistry public identityRegistry;
    AgentReputationRegistry public reputationRegistry;
    AgentRegistryResponder public responder;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ACTORS
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 constant SOURCE_CHAIN_ID = bytes32(uint256(1)); // Custom L1
    bytes32 constant DEST_CHAIN_ID = bytes32(uint256(2)); // C-Chain

    // Message types (must match contract constants)
    uint8 constant MSG_VERIFY_AGENT = 1;
    uint8 constant MSG_VERIFY_RESPONSE = 2;
    uint8 constant MSG_QUERY_REPUTATION = 3;
    uint8 constant MSG_REPUTATION_RESPONSE = 4;

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice"); // Agent owner on dest chain
    address public bob = makeAddr("bob"); // Client who gives feedback
    address public verifyRequester = makeAddr("verifyRequester"); // User on source chain

    uint256 public agentId;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event VerificationRequested(
        bytes32 indexed requestId,
        bytes32 indexed sourceChain,
        uint256 indexed agentId,
        address requester
    );
    event VerificationReceived(bytes32 indexed requestId, bool exists, int256 reputationScore);
    event ReputationQueried(
        bytes32 indexed requestId, bytes32 indexed sourceChain, uint256 indexed agentId
    );
    event ReputationReceived(bytes32 indexed requestId, uint64 feedbackCount, int128 aggregateScore);

    // ═══════════════════════════════════════════════════════════════════════════
    // SETUP
    // ═══════════════════════════════════════════════════════════════════════════

    function setUp() public {
        // Deploy mock teleporters for each chain
        sourceTeleporter = new MockTeleporterMessenger();
        destTeleporter = new MockTeleporterMessenger();

        // Deploy destination chain contracts (authoritative registries)
        identityRegistry = new AgentIdentityRegistry();
        reputationRegistry = new AgentReputationRegistry(address(identityRegistry));
        responder = new AgentRegistryResponder(
            address(destTeleporter),
            address(identityRegistry),
            address(reputationRegistry),
            owner
        );

        // Deploy source chain verifier
        verifier = new CrossChainAgentVerifier(address(sourceTeleporter), owner);

        // Configure cross-chain links
        vm.startPrank(owner);
        // Verifier knows about the responder on dest chain
        verifier.configureRegistry(DEST_CHAIN_ID, address(responder));
        // Responder knows about the verifier on source chain
        responder.authorizeVerifier(SOURCE_CHAIN_ID, address(verifier));
        vm.stopPrank();

        // Register an agent on the destination chain
        vm.prank(alice);
        agentId = identityRegistry.register("ipfs://agent-metadata");

        // Add some feedback for the agent
        vm.prank(bob);
        reputationRegistry.giveFeedback(agentId, 100, 2, "quality", "", "", "", bytes32(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VERIFICATION REQUEST TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_VerifyAgent_SendsRequest() public {
        vm.prank(verifyRequester);
        bytes32 requestId = verifier.verifyAgent(DEST_CHAIN_ID, agentId);

        // Verify the message was sent to teleporter
        assertEq(sourceTeleporter.lastDestinationBlockchainID(), DEST_CHAIN_ID);
        assertEq(sourceTeleporter.lastDestinationAddress(), address(responder));

        // Decode and verify the message content
        bytes memory message = sourceTeleporter.lastMessage();
        (uint8 msgType, bytes32 sentRequestId, uint256 sentAgentId) =
            abi.decode(message, (uint8, bytes32, uint256));

        assertEq(msgType, MSG_VERIFY_AGENT);
        assertEq(sentRequestId, requestId);
        assertEq(sentAgentId, agentId);

        // Request should be pending
        assertTrue(verifier.isRequestPending(requestId));
    }

    function test_VerifyAgent_RevertUnknownChain() public {
        bytes32 unknownChain = bytes32(uint256(999));

        vm.prank(verifyRequester);
        vm.expectRevert(
            abi.encodeWithSelector(ICrossChainAgentVerifier.UnknownChain.selector, unknownChain)
        );
        verifier.verifyAgent(unknownChain, agentId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FULL VERIFICATION FLOW TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_FullVerificationFlow_ExistingAgent() public {
        // Step 1: Send verification request from source chain
        vm.prank(verifyRequester);
        bytes32 requestId = verifier.verifyAgent(DEST_CHAIN_ID, agentId);

        // Step 2: Simulate the responder receiving the request on dest chain
        bytes memory requestMessage = sourceTeleporter.lastMessage();
        vm.prank(address(destTeleporter));
        responder.receiveTeleporterMessage(SOURCE_CHAIN_ID, address(verifier), requestMessage);

        // Step 3: Verify response was sent back
        bytes memory responseMessage = destTeleporter.lastMessage();
        (
            uint8 msgType,
            bytes32 responseRequestId,
            bool exists,
            address agentOwner,
            string memory agentURI,
            int256 reputationScore,
            uint64 feedbackCount
        ) = abi.decode(responseMessage, (uint8, bytes32, bool, address, string, int256, uint64));

        assertEq(msgType, MSG_VERIFY_RESPONSE);
        assertEq(responseRequestId, requestId);
        assertTrue(exists);
        assertEq(agentOwner, alice);
        // Note: Without specifying clients, getSummary returns 0 for both
        // This is a design choice - the registry requires explicit client addresses
        // For cross-chain queries with specific reputation needs, use queryReputation
        assertEq(reputationScore, 0);
        assertEq(feedbackCount, 0);

        // Step 4: Simulate verifier receiving the response
        vm.prank(address(sourceTeleporter));
        verifier.receiveTeleporterMessage(DEST_CHAIN_ID, address(responder), responseMessage);

        // Step 5: Verify result is stored
        AgentTypes.AgentVerification memory result = verifier.getVerificationResult(requestId);
        assertTrue(result.exists);
        assertEq(result.owner, alice);
        assertEq(result.reputationScore, 0);
        assertEq(result.feedbackCount, 0);

        // Request should no longer be pending
        assertFalse(verifier.isRequestPending(requestId));
    }

    function test_FullVerificationFlow_NonExistentAgent() public {
        uint256 nonExistentAgentId = 999;

        // Step 1: Send verification request
        vm.prank(verifyRequester);
        bytes32 requestId = verifier.verifyAgent(DEST_CHAIN_ID, nonExistentAgentId);

        // Step 2: Responder receives and processes
        bytes memory requestMessage = sourceTeleporter.lastMessage();
        vm.prank(address(destTeleporter));
        responder.receiveTeleporterMessage(SOURCE_CHAIN_ID, address(verifier), requestMessage);

        // Step 3: Verify response shows agent doesn't exist
        bytes memory responseMessage = destTeleporter.lastMessage();
        (, bytes32 responseRequestId, bool exists,,,) =
            abi.decode(responseMessage, (uint8, bytes32, bool, address, string, int256));

        assertEq(responseRequestId, requestId);
        assertFalse(exists);

        // Step 4: Verifier receives response
        vm.prank(address(sourceTeleporter));
        verifier.receiveTeleporterMessage(DEST_CHAIN_ID, address(responder), responseMessage);

        // Step 5: Verify result
        AgentTypes.AgentVerification memory result = verifier.getVerificationResult(requestId);
        assertFalse(result.exists);
        assertEq(result.owner, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REPUTATION QUERY TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_QueryReputation_SendsRequest() public {
        address[] memory clients = new address[](1);
        clients[0] = bob;

        vm.prank(verifyRequester);
        bytes32 requestId = verifier.queryReputation(DEST_CHAIN_ID, agentId, clients, "quality", "");

        // Verify the message was sent
        bytes memory message = sourceTeleporter.lastMessage();
        (
            uint8 msgType,
            bytes32 sentRequestId,
            uint256 sentAgentId,
            address[] memory sentClients,
            string memory tag1,
            string memory tag2
        ) = abi.decode(message, (uint8, bytes32, uint256, address[], string, string));

        assertEq(msgType, MSG_QUERY_REPUTATION);
        assertEq(sentRequestId, requestId);
        assertEq(sentAgentId, agentId);
        assertEq(sentClients.length, 1);
        assertEq(sentClients[0], bob);
        assertEq(tag1, "quality");
        assertEq(tag2, "");
    }

    function test_FullReputationQueryFlow() public {
        // Add more feedback first
        vm.prank(bob);
        reputationRegistry.giveFeedback(agentId, 50, 2, "quality", "", "", "", bytes32(0));

        address[] memory clients = new address[](1);
        clients[0] = bob;

        // Step 1: Send reputation query
        vm.prank(verifyRequester);
        bytes32 requestId = verifier.queryReputation(DEST_CHAIN_ID, agentId, clients, "quality", "");

        // Step 2: Responder processes
        bytes memory requestMessage = sourceTeleporter.lastMessage();
        vm.prank(address(destTeleporter));
        responder.receiveTeleporterMessage(SOURCE_CHAIN_ID, address(verifier), requestMessage);

        // Step 3: Verify response content
        bytes memory responseMessage = destTeleporter.lastMessage();
        (uint8 msgType, bytes32 responseRequestId, uint64 feedbackCount, int128 aggregateScore) =
            abi.decode(responseMessage, (uint8, bytes32, uint64, int128));

        assertEq(msgType, MSG_REPUTATION_RESPONSE);
        assertEq(responseRequestId, requestId);
        assertEq(feedbackCount, 2); // Two feedbacks with "quality" tag
        assertEq(aggregateScore, 150); // 100 + 50

        // Step 4: Verifier receives response
        vm.prank(address(sourceTeleporter));
        vm.expectEmit(true, false, false, true);
        emit ReputationReceived(requestId, 2, 150);
        verifier.receiveTeleporterMessage(DEST_CHAIN_ID, address(responder), responseMessage);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_RevertReceive_OnlyTeleporter() public {
        bytes memory fakeMessage = abi.encode(MSG_VERIFY_RESPONSE, bytes32(0), true, address(0));

        vm.prank(makeAddr("attacker"));
        vm.expectRevert(ICrossChainAgentVerifier.OnlyTeleporter.selector);
        verifier.receiveTeleporterMessage(DEST_CHAIN_ID, address(responder), fakeMessage);
    }

    function test_RevertReceive_UnknownRegistry() public {
        bytes memory fakeMessage = abi.encode(MSG_VERIFY_RESPONSE, bytes32(0), true, address(0));
        address fakeRegistry = makeAddr("fakeRegistry");

        vm.prank(address(sourceTeleporter));
        vm.expectRevert(
            abi.encodeWithSelector(
                ICrossChainAgentVerifier.UnknownRegistry.selector, DEST_CHAIN_ID, fakeRegistry
            )
        );
        verifier.receiveTeleporterMessage(DEST_CHAIN_ID, fakeRegistry, fakeMessage);
    }

    function test_ResponderRevert_OnlyTeleporter() public {
        bytes memory fakeMessage = abi.encode(MSG_VERIFY_AGENT, bytes32(0), agentId);

        vm.prank(makeAddr("attacker"));
        vm.expectRevert(AgentRegistryResponder.OnlyTeleporter.selector);
        responder.receiveTeleporterMessage(SOURCE_CHAIN_ID, address(verifier), fakeMessage);
    }

    function test_ResponderRevert_UnauthorizedVerifier() public {
        bytes memory fakeMessage = abi.encode(MSG_VERIFY_AGENT, bytes32(0), agentId);
        address fakeVerifier = makeAddr("fakeVerifier");

        vm.prank(address(destTeleporter));
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentRegistryResponder.UnauthorizedVerifier.selector, SOURCE_CHAIN_ID, fakeVerifier
            )
        );
        responder.receiveTeleporterMessage(SOURCE_CHAIN_ID, fakeVerifier, fakeMessage);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ConfigureRegistry() public {
        bytes32 newChainId = bytes32(uint256(42));
        address newRegistry = makeAddr("newRegistry");

        vm.prank(owner);
        verifier.configureRegistry(newChainId, newRegistry);

        assertEq(verifier.remoteRegistries(newChainId), newRegistry);
    }

    function test_ConfigureRegistry_OnlyOwner() public {
        vm.prank(makeAddr("notOwner"));
        vm.expectRevert();
        verifier.configureRegistry(bytes32(uint256(42)), makeAddr("registry"));
    }

    function test_AuthorizeVerifier() public {
        bytes32 newChainId = bytes32(uint256(42));
        address newVerifier = makeAddr("newVerifier");

        vm.prank(owner);
        responder.authorizeVerifier(newChainId, newVerifier);

        assertEq(responder.authorizedVerifiers(newChainId), newVerifier);
    }

    function test_SetRequiredGasLimit() public {
        uint256 newGasLimit = 500_000;

        vm.prank(owner);
        verifier.setRequiredGasLimit(newGasLimit);

        assertEq(verifier.requiredGasLimit(), newGasLimit);
    }
}
