// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAgentValidationRegistry} from "../interfaces/IAgentValidationRegistry.sol";
import {IAgentIdentityRegistry} from "../interfaces/IAgentIdentityRegistry.sol";
import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title AgentValidationRegistry
/// @notice EIP-8004 compliant agent validation registry
/// @dev Manages third-party validation requests and responses for agents
contract AgentValidationRegistry is ReentrancyGuard, IAgentValidationRegistry {
    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Reference to the identity registry
    IAgentIdentityRegistry public immutable identityRegistry;

    /// @notice Validation requests: requestHash => ValidationRequest
    mapping(bytes32 requestHash => AgentTypes.ValidationRequest request) private _requests;

    /// @notice Agent validations: agentId => requestHashes[]
    mapping(uint256 agentId => bytes32[] hashes) private _agentValidations;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /// @param _identityRegistry Address of the AgentIdentityRegistry
    constructor(address _identityRegistry) {
        identityRegistry = IAgentIdentityRegistry(_identityRegistry);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATION LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentValidationRegistry
    function validationRequest(
        address validator,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external nonReentrant {
        if (!identityRegistry.agentExists(agentId)) {
            revert AgentNotRegistered(agentId);
        }
        if (_requests[requestHash].requester != address(0)) {
            revert RequestAlreadyExists(requestHash);
        }

        _requests[requestHash] = AgentTypes.ValidationRequest({
            requester: msg.sender,
            validator: validator,
            agentId: agentId,
            requestURI: requestURI,
            requestHash: requestHash,
            response: AgentTypes.RESPONSE_PENDING,
            responseURI: "",
            responseHash: bytes32(0),
            tag: "",
            timestamp: uint64(block.timestamp)
        });

        _agentValidations[agentId].push(requestHash);

        emit ValidationRequested(requestHash, validator, agentId, msg.sender);
    }

    /// @inheritdoc IAgentValidationRegistry
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external nonReentrant {
        AgentTypes.ValidationRequest storage request = _requests[requestHash];

        if (request.requester == address(0)) {
            revert RequestNotFound(requestHash);
        }
        if (request.validator != msg.sender) {
            revert NotDesignatedValidator(requestHash, msg.sender);
        }
        if (request.response != AgentTypes.RESPONSE_PENDING) {
            revert RequestAlreadyResponded(requestHash);
        }

        request.response = response;
        request.responseURI = responseURI;
        request.responseHash = responseHash;
        request.tag = tag;

        emit ValidationResponded(requestHash, response, tag);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentValidationRegistry
    function getValidationStatus(
        bytes32 requestHash
    ) external view returns (AgentTypes.ValidationRequest memory) {
        if (_requests[requestHash].requester == address(0)) {
            revert RequestNotFound(requestHash);
        }
        return _requests[requestHash];
    }

    /// @inheritdoc IAgentValidationRegistry
    function getSummary(
        uint256 agentId,
        address[] calldata validators,
        string calldata tag
    ) external view returns (AgentTypes.Summary memory summary) {
        bytes32[] storage requestHashes = _agentValidations[agentId];
        uint256 hashesLength = requestHashes.length;

        int256 totalScore = 0;
        uint64 count = 0;

        for (uint256 i = 0; i < hashesLength;) {
            AgentTypes.ValidationRequest storage req = _requests[requestHashes[i]];

            // Skip pending responses
            if (req.response == AgentTypes.RESPONSE_PENDING) {
                unchecked {
                    ++i;
                }
                continue;
            }

            // Filter by validators if provided
            bool matchValidator = validators.length == 0;
            if (!matchValidator) {
                uint256 validatorsLength = validators.length;
                for (uint256 j = 0; j < validatorsLength;) {
                    if (req.validator == validators[j]) {
                        matchValidator = true;
                        break;
                    }
                    unchecked {
                        ++j;
                    }
                }
            }

            // Filter by tag if provided
            bool matchTag = bytes(tag).length == 0 || _stringsEqual(req.tag, tag);

            if (matchValidator && matchTag) {
                // Convert response to score:
                // APPROVED (+1), REJECTED (-1), INCONCLUSIVE (0)
                if (req.response == AgentTypes.RESPONSE_APPROVED) {
                    totalScore += 1;
                } else if (req.response == AgentTypes.RESPONSE_REJECTED) {
                    totalScore -= 1;
                }
                count++;
            }

            unchecked {
                ++i;
            }
        }

        summary.count = count;
        summary.value = int128(totalScore);
        summary.decimals = 0;
    }

    /// @inheritdoc IAgentValidationRegistry
    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentValidations[agentId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Compare two strings for equality
    function _stringsEqual(
        string storage a,
        string calldata b
    ) internal view returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
