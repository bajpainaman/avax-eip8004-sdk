// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title IAgentIdentityRegistry
/// @notice EIP-8004 compliant Agent Identity Registry interface
/// @dev Extends ERC-721 for agent identity management
interface IAgentIdentityRegistry {
    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentURIUpdated(uint256 indexed agentId, string newURI);
    event MetadataUpdated(uint256 indexed agentId, string key, bytes value);
    event AgentWalletSet(uint256 indexed agentId, address wallet);
    event AgentWalletUnset(uint256 indexed agentId);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error AgentNotFound(uint256 agentId);
    error NotAgentOwner(uint256 agentId, address caller);
    error InvalidSignature();
    error SignatureExpired();
    error WalletAlreadySet(uint256 agentId);
    error WalletNotSet(uint256 agentId);

    // ═══════════════════════════════════════════════════════════════════════════
    // REGISTRATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register a new agent with URI and metadata
    /// @param agentURI The URI pointing to off-chain agent metadata
    /// @param metadata Initial on-chain metadata entries
    /// @return agentId The newly minted agent ID (ERC-721 token)
    function register(
        string calldata agentURI,
        AgentTypes.MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId);

    /// @notice Register a new agent with URI only
    /// @param agentURI The URI pointing to off-chain agent metadata
    /// @return agentId The newly minted agent ID
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice Register a new agent with no initial data
    /// @return agentId The newly minted agent ID
    function register() external returns (uint256 agentId);

    // ═══════════════════════════════════════════════════════════════════════════
    // METADATA MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Update agent's off-chain metadata URI
    /// @param agentId The agent to update
    /// @param newURI The new metadata URI
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /// @notice Set or update on-chain metadata
    /// @param agentId The agent to update
    /// @param key The metadata key
    /// @param value The ABI-encoded metadata value
    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external;

    /// @notice Get on-chain metadata value
    /// @param agentId The agent to query
    /// @param key The metadata key
    /// @return The ABI-encoded metadata value
    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory);

    // ═══════════════════════════════════════════════════════════════════════════
    // WALLET LINKING (EIP-712)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Link a wallet address to an agent using EIP-712 signature
    /// @dev The wallet owner must sign a message proving ownership
    /// @param agentId The agent to link
    /// @param wallet The wallet address to associate
    /// @param deadline Signature expiry timestamp
    /// @param signature EIP-712 signature from wallet owner
    function setAgentWallet(
        uint256 agentId,
        address wallet,
        uint256 deadline,
        bytes calldata signature
    ) external;

    /// @notice Get agent's linked wallet address
    /// @param agentId The agent to query
    /// @return The linked wallet address (address(0) if none)
    function getAgentWallet(uint256 agentId) external view returns (address);

    /// @notice Remove wallet association
    /// @param agentId The agent to unlink
    function unsetAgentWallet(uint256 agentId) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Check if an agent exists
    /// @param agentId The agent ID to check
    /// @return True if the agent exists
    function agentExists(uint256 agentId) external view returns (bool);

    /// @notice Get total number of registered agents
    /// @return Total agent count
    function totalAgents() external view returns (uint256);

    /// @notice Get agent ID from linked wallet address
    /// @param wallet The wallet address to lookup
    /// @return The agent ID (0 if no agent linked)
    function getAgentByWallet(address wallet) external view returns (uint256);
}
