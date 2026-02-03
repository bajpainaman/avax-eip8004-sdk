// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title IAgentValidationRegistry
/// @notice EIP-8004 compliant Agent Validation Registry interface
/// @dev Manages third-party validation requests and responses for agents
interface IAgentValidationRegistry {
    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event ValidationRequested(
        bytes32 indexed requestHash,
        address indexed validator,
        uint256 indexed agentId,
        address requester
    );
    event ValidationResponded(bytes32 indexed requestHash, uint8 response, string tag);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error RequestAlreadyExists(bytes32 requestHash);
    error RequestNotFound(bytes32 requestHash);
    error NotDesignatedValidator(bytes32 requestHash, address caller);
    error RequestAlreadyResponded(bytes32 requestHash);
    error AgentNotRegistered(uint256 agentId);

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATION LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create a validation request for an agent
    /// @dev Anyone can request validation, specifying the validator
    /// @param validator Address of the designated validator
    /// @param agentId The agent to validate
    /// @param requestURI Off-chain validation request details
    /// @param requestHash Hash of request content for verification
    function validationRequest(
        address validator,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external;

    /// @notice Validator responds to a validation request
    /// @dev Only the designated validator can respond
    /// @param requestHash The request to respond to
    /// @param response Response code: 1=approved, 2=rejected, 3=inconclusive
    /// @param responseURI Off-chain response details
    /// @param responseHash Hash of response content
    /// @param tag Categorization tag for the validation
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the status of a validation request
    /// @param requestHash The request to query
    /// @return The full validation request data
    function getValidationStatus(
        bytes32 requestHash
    ) external view returns (AgentTypes.ValidationRequest memory);

    /// @notice Get aggregated validation summary for an agent
    /// @dev Filters by validators and tag, only counts responded requests
    /// @param agentId The agent to query
    /// @param validators Filter to these validators (empty = all)
    /// @param tag Filter by tag (empty = all)
    /// @return summary Aggregated validation statistics
    function getSummary(
        uint256 agentId,
        address[] calldata validators,
        string calldata tag
    ) external view returns (AgentTypes.Summary memory summary);

    /// @notice Get all validation request hashes for an agent
    /// @param agentId The agent to query
    /// @return Array of request hashes
    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory);
}
