// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {AgentIdentityRegistry} from "../../src/registries/AgentIdentityRegistry.sol";
import {AgentReputationRegistry} from "../../src/registries/AgentReputationRegistry.sol";
import {IAgentReputationRegistry} from "../../src/interfaces/IAgentReputationRegistry.sol";
import {AgentTypes} from "../../src/libraries/AgentTypes.sol";

contract AgentReputationRegistryTest is Test {
    AgentIdentityRegistry public identityRegistry;
    AgentReputationRegistry public reputationRegistry;

    address public alice = makeAddr("alice"); // Agent owner
    address public bob = makeAddr("bob"); // Client 1
    address public charlie = makeAddr("charlie"); // Client 2

    uint256 public agentId;

    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed client,
        uint64 indexed index,
        int128 value,
        string tag1,
        string tag2
    );
    event FeedbackRevoked(uint256 indexed agentId, address indexed client, uint64 index);
    event ResponseAppended(uint256 indexed agentId, address indexed client, uint64 index);

    function setUp() public {
        identityRegistry = new AgentIdentityRegistry();
        reputationRegistry = new AgentReputationRegistry(address(identityRegistry));

        // Register an agent
        vm.prank(alice);
        agentId = identityRegistry.register("ipfs://agent");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEEDBACK TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_GiveFeedback() public {
        vm.prank(bob);

        vm.expectEmit(true, true, true, true);
        emit FeedbackGiven(agentId, bob, 0, 100, "quality", "fast");

        reputationRegistry.giveFeedback(
            agentId,
            100,
            2,
            "quality",
            "fast",
            "/api/chat",
            "ipfs://feedback",
            keccak256("feedback content")
        );

        assertEq(reputationRegistry.getFeedbackCount(agentId), 1);
        assertEq(reputationRegistry.getClientFeedbackCount(agentId, bob), 1);
    }

    function test_GiveFeedback_MultipleFromSameClient() public {
        vm.startPrank(bob);

        reputationRegistry.giveFeedback(agentId, 100, 2, "quality", "", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agentId, 80, 2, "quality", "", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agentId, -50, 2, "quality", "", "", "", bytes32(0));

        vm.stopPrank();

        assertEq(reputationRegistry.getFeedbackCount(agentId), 3);
        assertEq(reputationRegistry.getClientFeedbackCount(agentId, bob), 3);
    }

    function test_GiveFeedback_NegativeValue() public {
        vm.prank(bob);
        reputationRegistry.giveFeedback(agentId, -100, 2, "", "", "", "", bytes32(0));

        AgentTypes.Feedback memory fb = reputationRegistry.readFeedback(agentId, bob, 0);
        assertEq(fb.value, -100);
    }

    function test_RevertGiveFeedback_AgentNotRegistered() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAgentReputationRegistry.AgentNotRegistered.selector, 999)
        );
        reputationRegistry.giveFeedback(999, 100, 2, "", "", "", "", bytes32(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REVOKE TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_RevokeFeedback() public {
        vm.startPrank(bob);
        reputationRegistry.giveFeedback(agentId, 100, 2, "", "", "", "", bytes32(0));

        vm.expectEmit(true, true, false, true);
        emit FeedbackRevoked(agentId, bob, 0);

        reputationRegistry.revokeFeedback(agentId, 0);
        vm.stopPrank();

        AgentTypes.Feedback memory fb = reputationRegistry.readFeedback(agentId, bob, 0);
        assertTrue(fb.revoked);
    }

    function test_RevertRevokeFeedback_NotOwner() public {
        vm.prank(bob);
        reputationRegistry.giveFeedback(agentId, 100, 2, "", "", "", "", bytes32(0));

        vm.prank(charlie);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAgentReputationRegistry.FeedbackNotFound.selector, agentId, charlie, 0
            )
        );
        reputationRegistry.revokeFeedback(agentId, 0);
    }

    function test_RevertRevokeFeedback_AlreadyRevoked() public {
        vm.startPrank(bob);
        reputationRegistry.giveFeedback(agentId, 100, 2, "", "", "", "", bytes32(0));
        reputationRegistry.revokeFeedback(agentId, 0);

        vm.expectRevert(
            abi.encodeWithSelector(IAgentReputationRegistry.FeedbackAlreadyRevoked.selector, agentId, 0)
        );
        reputationRegistry.revokeFeedback(agentId, 0);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RESPONSE TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_AppendResponse() public {
        vm.prank(bob);
        reputationRegistry.giveFeedback(agentId, -50, 2, "", "", "", "", bytes32(0));

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit ResponseAppended(agentId, bob, 0);

        reputationRegistry.appendResponse(
            agentId, bob, 0, "ipfs://response", keccak256("response content")
        );

        AgentTypes.Feedback memory fb = reputationRegistry.readFeedback(agentId, bob, 0);
        assertEq(fb.responseURI, "ipfs://response");
        assertEq(fb.responseHash, keccak256("response content"));
    }

    function test_RevertAppendResponse_NotAgentOwner() public {
        vm.prank(bob);
        reputationRegistry.giveFeedback(agentId, 100, 2, "", "", "", "", bytes32(0));

        vm.prank(charlie);
        vm.expectRevert(
            abi.encodeWithSelector(IAgentReputationRegistry.NotAgentOwner.selector, agentId)
        );
        reputationRegistry.appendResponse(agentId, bob, 0, "uri", bytes32(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUMMARY TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_GetSummary_AllFeedback() public {
        vm.prank(bob);
        reputationRegistry.giveFeedback(agentId, 100, 2, "quality", "", "", "", bytes32(0));

        vm.prank(charlie);
        reputationRegistry.giveFeedback(agentId, -30, 2, "quality", "", "", "", bytes32(0));

        address[] memory clients = new address[](2);
        clients[0] = bob;
        clients[1] = charlie;

        AgentTypes.Summary memory summary = reputationRegistry.getSummary(agentId, clients, "", "");

        assertEq(summary.count, 2);
        assertEq(summary.value, 70); // 100 + (-30)
    }

    function test_GetSummary_FilteredByTag() public {
        vm.startPrank(bob);
        reputationRegistry.giveFeedback(agentId, 100, 2, "quality", "", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agentId, 50, 2, "speed", "", "", "", bytes32(0));
        vm.stopPrank();

        address[] memory clients = new address[](1);
        clients[0] = bob;

        AgentTypes.Summary memory summary =
            reputationRegistry.getSummary(agentId, clients, "quality", "");

        assertEq(summary.count, 1);
        assertEq(summary.value, 100);
    }

    function test_GetSummary_ExcludesRevokedFeedback() public {
        vm.startPrank(bob);
        reputationRegistry.giveFeedback(agentId, 100, 2, "", "", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agentId, 50, 2, "", "", "", "", bytes32(0));
        reputationRegistry.revokeFeedback(agentId, 0);
        vm.stopPrank();

        address[] memory clients = new address[](1);
        clients[0] = bob;

        AgentTypes.Summary memory summary = reputationRegistry.getSummary(agentId, clients, "", "");

        assertEq(summary.count, 1);
        assertEq(summary.value, 50);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // READ FEEDBACK TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ReadFeedback() public {
        vm.prank(bob);
        reputationRegistry.giveFeedback(
            agentId, 85, 2, "accuracy", "helpful", "/api/query", "ipfs://feedback-1", keccak256("detailed feedback")
        );

        AgentTypes.Feedback memory fb = reputationRegistry.readFeedback(agentId, bob, 0);

        assertEq(fb.client, bob);
        assertEq(fb.value, 85);
        assertEq(fb.valueDecimals, 2);
        assertEq(fb.tag1, "accuracy");
        assertEq(fb.tag2, "helpful");
        assertEq(fb.endpoint, "/api/query");
        assertEq(fb.feedbackURI, "ipfs://feedback-1");
        assertFalse(fb.revoked);
    }

    function test_RevertReadFeedback_NotFound() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAgentReputationRegistry.FeedbackNotFound.selector, agentId, bob, 0
            )
        );
        reputationRegistry.readFeedback(agentId, bob, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_GiveFeedback(int128 value, uint8 decimals) public {
        vm.assume(decimals <= 18);

        vm.prank(bob);
        reputationRegistry.giveFeedback(agentId, value, decimals, "", "", "", "", bytes32(0));

        AgentTypes.Feedback memory fb = reputationRegistry.readFeedback(agentId, bob, 0);
        assertEq(fb.value, value);
        assertEq(fb.valueDecimals, decimals);
    }
}
