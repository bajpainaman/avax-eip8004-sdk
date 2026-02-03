// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title IAgentReputationRegistry
/// @notice EIP-8004 compliant Agent Reputation Registry interface
/// @dev Manages feedback and reputation scores for registered agents
interface IAgentReputationRegistry {
    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error AgentNotRegistered(uint256 agentId);
    error NotFeedbackOwner(uint256 agentId, uint64 index);
    error FeedbackAlreadyRevoked(uint256 agentId, uint64 index);
    error FeedbackNotFound(uint256 agentId, address client, uint64 index);
    error NotAgentOwner(uint256 agentId);

    // ═══════════════════════════════════════════════════════════════════════════
    // FEEDBACK MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Submit feedback for an agent
    /// @dev Value uses signed fixed-point: actual = value / 10^valueDecimals
    /// @param agentId The agent receiving feedback
    /// @param value The feedback score (can be negative)
    /// @param valueDecimals Decimal places for the value (0-18)
    /// @param tag1 Primary categorization tag
    /// @param tag2 Secondary categorization tag
    /// @param endpoint The service endpoint that was used
    /// @param feedbackURI Off-chain feedback details
    /// @param feedbackHash Hash of off-chain content for verification
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /// @notice Revoke previously given feedback
    /// @dev Only the original feedback submitter can revoke
    /// @param agentId The agent whose feedback to revoke
    /// @param index The feedback index to revoke
    function revokeFeedback(uint256 agentId, uint64 index) external;

    /// @notice Agent owner appends a response to feedback
    /// @dev Allows agents to respond to user feedback
    /// @param agentId The agent responding
    /// @param client The feedback author's address
    /// @param index The feedback index to respond to
    /// @param responseURI Off-chain response details
    /// @param responseHash Hash of response content
    function appendResponse(
        uint256 agentId,
        address client,
        uint64 index,
        string calldata responseURI,
        bytes32 responseHash
    ) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get aggregated reputation summary
    /// @dev Filters by clients and tags, excludes revoked feedback
    /// @param agentId The agent to query
    /// @param clients Filter to these clients (empty = all)
    /// @param tag1 Filter by primary tag (empty = all)
    /// @param tag2 Filter by secondary tag (empty = all)
    /// @return summary Aggregated count, value, and decimals
    function getSummary(
        uint256 agentId,
        address[] calldata clients,
        string calldata tag1,
        string calldata tag2
    ) external view returns (AgentTypes.Summary memory summary);

    /// @notice Read a specific feedback entry
    /// @param agentId The agent to query
    /// @param client The feedback author
    /// @param index The feedback index
    /// @return The full feedback data
    function readFeedback(
        uint256 agentId,
        address client,
        uint64 index
    ) external view returns (AgentTypes.Feedback memory);

    /// @notice Get total feedback count for an agent
    /// @param agentId The agent to query
    /// @return Total feedback entries (including revoked)
    function getFeedbackCount(uint256 agentId) external view returns (uint64);

    /// @notice Get feedback count from a specific client
    /// @param agentId The agent to query
    /// @param client The client to filter by
    /// @return Feedback count from this client
    function getClientFeedbackCount(uint256 agentId, address client) external view returns (uint64);
}
