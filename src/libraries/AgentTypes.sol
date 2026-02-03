// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @title AgentTypes
/// @notice Shared types for the EIP-8004 Agent Registry system
/// @dev All registries reference these common data structures
library AgentTypes {
    /// @notice Metadata entry for agent registration
    /// @param key The metadata key (e.g., "version", "capabilities")
    /// @param value The ABI-encoded metadata value
    struct MetadataEntry {
        string key;
        bytes value;
    }

    /// @notice Feedback data structure for reputation tracking
    /// @dev Uses signed fixed-point (int128 + decimals) for flexible scoring
    struct Feedback {
        address client;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
        string responseURI;
        bytes32 responseHash;
        uint64 timestamp;
        bool revoked;
    }

    /// @notice Validation request structure for third-party verification
    /// @dev Response codes: 0=pending, 1=approved, 2=rejected, 3=inconclusive
    struct ValidationRequest {
        address requester;
        address validator;
        uint256 agentId;
        string requestURI;
        bytes32 requestHash;
        uint8 response;
        string responseURI;
        bytes32 responseHash;
        string tag;
        uint64 timestamp;
    }

    /// @notice Aggregated summary of reputation or validation data
    struct Summary {
        uint64 count;
        int128 value;
        uint8 decimals;
    }

    /// @notice Cross-chain verification result
    struct AgentVerification {
        bool exists;
        address owner;
        string agentURI;
        int256 reputationScore;
        uint64 feedbackCount;
    }

    /// @notice Validation response codes
    uint8 constant RESPONSE_PENDING = 0;
    uint8 constant RESPONSE_APPROVED = 1;
    uint8 constant RESPONSE_REJECTED = 2;
    uint8 constant RESPONSE_INCONCLUSIVE = 3;
}
