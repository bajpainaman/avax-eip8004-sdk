// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {AgentIdentityRegistry} from "../../src/registries/AgentIdentityRegistry.sol";
import {AgentValidationRegistry} from "../../src/registries/AgentValidationRegistry.sol";
import {IAgentValidationRegistry} from "../../src/interfaces/IAgentValidationRegistry.sol";
import {AgentTypes} from "../../src/libraries/AgentTypes.sol";

contract AgentValidationRegistryTest is Test {
    AgentIdentityRegistry public identityRegistry;
    AgentValidationRegistry public validationRegistry;

    address public alice = makeAddr("alice"); // Agent owner
    address public bob = makeAddr("bob"); // Requester
    address public validator1 = makeAddr("validator1");
    address public validator2 = makeAddr("validator2");

    uint256 public agentId;
    bytes32 public requestHash1;
    bytes32 public requestHash2;

    event ValidationRequested(
        bytes32 indexed requestHash,
        address indexed validator,
        uint256 indexed agentId,
        address requester
    );
    event ValidationResponded(bytes32 indexed requestHash, uint8 response, string tag);

    function setUp() public {
        identityRegistry = new AgentIdentityRegistry();
        validationRegistry = new AgentValidationRegistry(address(identityRegistry));

        // Register an agent
        vm.prank(alice);
        agentId = identityRegistry.register("ipfs://agent");

        // Create unique request hashes
        requestHash1 = keccak256("request1");
        requestHash2 = keccak256("request2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATION REQUEST TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ValidationRequest() public {
        vm.prank(bob);

        vm.expectEmit(true, true, true, true);
        emit ValidationRequested(requestHash1, validator1, agentId, bob);

        validationRegistry.validationRequest(
            validator1, agentId, "ipfs://validation-request", requestHash1
        );

        AgentTypes.ValidationRequest memory req =
            validationRegistry.getValidationStatus(requestHash1);

        assertEq(req.requester, bob);
        assertEq(req.validator, validator1);
        assertEq(req.agentId, agentId);
        assertEq(req.requestURI, "ipfs://validation-request");
        assertEq(req.requestHash, requestHash1);
        assertEq(req.response, AgentTypes.RESPONSE_PENDING);
    }

    function test_ValidationRequest_MultipleRequests() public {
        vm.startPrank(bob);

        validationRegistry.validationRequest(validator1, agentId, "uri1", requestHash1);
        validationRegistry.validationRequest(validator2, agentId, "uri2", requestHash2);

        vm.stopPrank();

        bytes32[] memory validations = validationRegistry.getAgentValidations(agentId);
        assertEq(validations.length, 2);
        assertEq(validations[0], requestHash1);
        assertEq(validations[1], requestHash2);
    }

    function test_RevertValidationRequest_AgentNotRegistered() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAgentValidationRegistry.AgentNotRegistered.selector, 999)
        );
        validationRegistry.validationRequest(validator1, 999, "", requestHash1);
    }

    function test_RevertValidationRequest_RequestAlreadyExists() public {
        vm.startPrank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAgentValidationRegistry.RequestAlreadyExists.selector, requestHash1
            )
        );
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATION RESPONSE TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ValidationResponse_Approved() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);

        vm.prank(validator1);
        vm.expectEmit(true, false, false, true);
        emit ValidationResponded(requestHash1, AgentTypes.RESPONSE_APPROVED, "security");

        validationRegistry.validationResponse(
            requestHash1,
            AgentTypes.RESPONSE_APPROVED,
            "ipfs://response",
            keccak256("response content"),
            "security"
        );

        AgentTypes.ValidationRequest memory req =
            validationRegistry.getValidationStatus(requestHash1);
        assertEq(req.response, AgentTypes.RESPONSE_APPROVED);
        assertEq(req.responseURI, "ipfs://response");
        assertEq(req.tag, "security");
    }

    function test_ValidationResponse_Rejected() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);

        vm.prank(validator1);
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_REJECTED, "", bytes32(0), "compliance"
        );

        AgentTypes.ValidationRequest memory req =
            validationRegistry.getValidationStatus(requestHash1);
        assertEq(req.response, AgentTypes.RESPONSE_REJECTED);
    }

    function test_ValidationResponse_Inconclusive() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);

        vm.prank(validator1);
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_INCONCLUSIVE, "", bytes32(0), ""
        );

        AgentTypes.ValidationRequest memory req =
            validationRegistry.getValidationStatus(requestHash1);
        assertEq(req.response, AgentTypes.RESPONSE_INCONCLUSIVE);
    }

    function test_RevertValidationResponse_RequestNotFound() public {
        vm.prank(validator1);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAgentValidationRegistry.RequestNotFound.selector, requestHash1
            )
        );
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), ""
        );
    }

    function test_RevertValidationResponse_NotDesignatedValidator() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);

        vm.prank(validator2);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAgentValidationRegistry.NotDesignatedValidator.selector, requestHash1, validator2
            )
        );
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), ""
        );
    }

    function test_RevertValidationResponse_AlreadyResponded() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);

        vm.startPrank(validator1);
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), ""
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                IAgentValidationRegistry.RequestAlreadyResponded.selector, requestHash1
            )
        );
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_REJECTED, "", bytes32(0), ""
        );
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUMMARY TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_GetSummary_AllValidations() public {
        // Create and respond to multiple validation requests
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);
        vm.prank(validator1);
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), ""
        );

        vm.prank(bob);
        validationRegistry.validationRequest(validator2, agentId, "", requestHash2);
        vm.prank(validator2);
        validationRegistry.validationResponse(
            requestHash2, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), ""
        );

        address[] memory emptyValidators = new address[](0);
        AgentTypes.Summary memory summary =
            validationRegistry.getSummary(agentId, emptyValidators, "");

        assertEq(summary.count, 2);
        assertEq(summary.value, 2); // +1 + +1 = 2
    }

    function test_GetSummary_MixedResponses() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);
        vm.prank(validator1);
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), ""
        );

        vm.prank(bob);
        validationRegistry.validationRequest(validator2, agentId, "", requestHash2);
        vm.prank(validator2);
        validationRegistry.validationResponse(
            requestHash2, AgentTypes.RESPONSE_REJECTED, "", bytes32(0), ""
        );

        address[] memory emptyValidators = new address[](0);
        AgentTypes.Summary memory summary =
            validationRegistry.getSummary(agentId, emptyValidators, "");

        assertEq(summary.count, 2);
        assertEq(summary.value, 0); // +1 + (-1) = 0
    }

    function test_GetSummary_FilterByValidator() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);
        vm.prank(validator1);
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), ""
        );

        vm.prank(bob);
        validationRegistry.validationRequest(validator2, agentId, "", requestHash2);
        vm.prank(validator2);
        validationRegistry.validationResponse(
            requestHash2, AgentTypes.RESPONSE_REJECTED, "", bytes32(0), ""
        );

        address[] memory validators = new address[](1);
        validators[0] = validator1;

        AgentTypes.Summary memory summary =
            validationRegistry.getSummary(agentId, validators, "");

        assertEq(summary.count, 1);
        assertEq(summary.value, 1); // Only validator1's approval
    }

    function test_GetSummary_FilterByTag() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);
        vm.prank(validator1);
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), "security"
        );

        vm.prank(bob);
        validationRegistry.validationRequest(validator2, agentId, "", requestHash2);
        vm.prank(validator2);
        validationRegistry.validationResponse(
            requestHash2, AgentTypes.RESPONSE_APPROVED, "", bytes32(0), "compliance"
        );

        address[] memory emptyValidators = new address[](0);
        AgentTypes.Summary memory summary =
            validationRegistry.getSummary(agentId, emptyValidators, "security");

        assertEq(summary.count, 1);
        assertEq(summary.value, 1);
    }

    function test_GetSummary_ExcludesPendingRequests() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);
        // Don't respond - leave pending

        address[] memory emptyValidators = new address[](0);
        AgentTypes.Summary memory summary =
            validationRegistry.getSummary(agentId, emptyValidators, "");

        assertEq(summary.count, 0);
        assertEq(summary.value, 0);
    }

    function test_GetSummary_InconclusiveDoesNotAffectScore() public {
        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);
        vm.prank(validator1);
        validationRegistry.validationResponse(
            requestHash1, AgentTypes.RESPONSE_INCONCLUSIVE, "", bytes32(0), ""
        );

        address[] memory emptyValidators = new address[](0);
        AgentTypes.Summary memory summary =
            validationRegistry.getSummary(agentId, emptyValidators, "");

        assertEq(summary.count, 1);
        assertEq(summary.value, 0); // Inconclusive = 0
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERY TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_GetValidationStatus() public {
        vm.prank(bob);
        validationRegistry.validationRequest(
            validator1, agentId, "ipfs://request", requestHash1
        );

        AgentTypes.ValidationRequest memory req =
            validationRegistry.getValidationStatus(requestHash1);

        assertEq(req.requester, bob);
        assertEq(req.validator, validator1);
        assertEq(req.agentId, agentId);
        assertEq(req.requestURI, "ipfs://request");
        assertTrue(req.timestamp > 0);
    }

    function test_RevertGetValidationStatus_NotFound() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAgentValidationRegistry.RequestNotFound.selector, requestHash1
            )
        );
        validationRegistry.getValidationStatus(requestHash1);
    }

    function test_GetAgentValidations() public {
        vm.startPrank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);
        validationRegistry.validationRequest(validator2, agentId, "", requestHash2);
        vm.stopPrank();

        bytes32[] memory validations = validationRegistry.getAgentValidations(agentId);

        assertEq(validations.length, 2);
        assertEq(validations[0], requestHash1);
        assertEq(validations[1], requestHash2);
    }

    function test_GetAgentValidations_Empty() public {
        bytes32[] memory validations = validationRegistry.getAgentValidations(agentId);
        assertEq(validations.length, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_ValidationRequest(bytes32 requestHash, string calldata uri) public {
        vm.assume(requestHash != bytes32(0));

        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, uri, requestHash);

        AgentTypes.ValidationRequest memory req =
            validationRegistry.getValidationStatus(requestHash);

        assertEq(req.requestHash, requestHash);
        assertEq(req.requestURI, uri);
    }

    function testFuzz_ValidationResponse(uint8 response, string calldata tag) public {
        vm.assume(
            response == AgentTypes.RESPONSE_APPROVED
                || response == AgentTypes.RESPONSE_REJECTED
                || response == AgentTypes.RESPONSE_INCONCLUSIVE
        );

        vm.prank(bob);
        validationRegistry.validationRequest(validator1, agentId, "", requestHash1);

        vm.prank(validator1);
        validationRegistry.validationResponse(requestHash1, response, "", bytes32(0), tag);

        AgentTypes.ValidationRequest memory req =
            validationRegistry.getValidationStatus(requestHash1);

        assertEq(req.response, response);
        assertEq(req.tag, tag);
    }
}
