// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title ICrossChainAgentVerifier
/// @notice Interface for cross-chain agent verification via Avalanche ICM
/// @dev Enables verification of agents registered on remote Avalanche chains
interface ICrossChainAgentVerifier {
    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event RegistryConfigured(bytes32 indexed chainId, address registry);
    event VerificationRequested(
        bytes32 indexed requestId,
        bytes32 indexed sourceChain,
        uint256 agentId,
        address requester
    );
    event VerificationReceived(bytes32 indexed requestId, bool exists, int256 reputationScore);
    event ReputationQueried(bytes32 indexed requestId, bytes32 indexed sourceChain, uint256 agentId);
    event ReputationReceived(bytes32 indexed requestId, uint64 feedbackCount, int128 aggregateScore);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error UnknownChain(bytes32 chainId);
    error OnlyTeleporter();
    error UnknownRegistry(bytes32 chainId, address sender);
    error RequestNotFound(bytes32 requestId);

    // ═══════════════════════════════════════════════════════════════════════════
    // CROSS-CHAIN VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Request agent verification from authoritative chain
    /// @dev Sends ICM message to remote registry, response handled async
    /// @param sourceChain The blockchain ID where agent is registered
    /// @param agentId The agent ID to verify
    /// @return requestId Unique identifier for tracking this request
    function verifyAgent(
        bytes32 sourceChain,
        uint256 agentId
    ) external returns (bytes32 requestId);

    /// @notice Query reputation from authoritative chain
    /// @param sourceChain The blockchain ID where agent is registered
    /// @param agentId The agent to query
    /// @param clients Filter reputation by these clients
    /// @param tag1 Filter by primary tag
    /// @param tag2 Filter by secondary tag
    /// @return requestId Unique identifier for tracking this request
    function queryReputation(
        bytes32 sourceChain,
        uint256 agentId,
        address[] calldata clients,
        string calldata tag1,
        string calldata tag2
    ) external returns (bytes32 requestId);

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get verification result for a completed request
    /// @param requestId The request to query
    /// @return The verification result
    function getVerificationResult(
        bytes32 requestId
    ) external view returns (AgentTypes.AgentVerification memory);

    /// @notice Check if a request is still pending
    /// @param requestId The request to check
    /// @return True if request is pending
    function isRequestPending(bytes32 requestId) external view returns (bool);

    /// @notice Get remote registry address for a chain
    /// @param chainId The chain to query
    /// @return The registry address (address(0) if not configured)
    function remoteRegistries(bytes32 chainId) external view returns (address);
}
