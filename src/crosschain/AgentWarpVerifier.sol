// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @title AgentWarpVerifier
/// @notice Verifies Warp-signed agent proofs on any Avalanche L1
/// @dev Deploy on any L1 that needs to verify agents from the home chain.
///      No round trips. No callbacks. Just signature verification.
///
///      Flow:
///      1. Relayer includes signed Warp message in tx predicate
///      2. VM pre-verifies the BLS signature before execution
///      3. This contract reads the verified message and caches the result
///      4. Subsequent reads are local storage lookups (cheap)
contract AgentWarpVerifier {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Warp precompile address (same on all Avalanche L1s)
    address private constant WARP_PRECOMPILE = 0x0200000000000000000000000000000000000005;

    /// @notice Proof types (must match AgentProofEmitter)
    uint8 public constant PROOF_IDENTITY = 1;
    uint8 public constant PROOF_REPUTATION = 2;
    uint8 public constant PROOF_VALIDATION = 3;

    /// @notice Expected schema version
    uint8 public constant EXPECTED_SCHEMA = 1;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The home chain's blockchain ID (set at deployment)
    bytes32 public immutable homeChainId;

    /// @notice The AgentProofEmitter address on the home chain
    address public immutable homeEmitter;

    /// @notice Cached identity proofs
    mapping(uint256 agentId => IdentityProof) public identityProofs;

    /// @notice Cached reputation proofs
    mapping(uint256 agentId => ReputationProof) public reputationProofs;

    /// @notice Cached validation proofs: agentId => validator => proof
    mapping(uint256 agentId => mapping(address validator => ValidationProof)) public validationProofs;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    struct IdentityProof {
        address owner;
        string endpoint;
        uint256 provenAt;
        bool verified;
    }

    struct ReputationProof {
        uint64 feedbackCount;
        int128 aggregateScore;
        uint8 decimals;
        uint256 provenAt;
        bool verified;
    }

    struct ValidationProof {
        uint8 response;
        string tag;
        uint256 provenAt;
        bool verified;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event IdentityVerified(uint256 indexed agentId, address owner, string endpoint);
    event ReputationVerified(uint256 indexed agentId, uint64 feedbackCount, int128 score);
    event ValidationVerified(uint256 indexed agentId, address indexed validator, uint8 response);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error InvalidWarpMessage();
    error WrongSourceChain(bytes32 expected, bytes32 actual);
    error WrongEmitter(address expected, address actual);
    error UnexpectedSchema(uint8 expected, uint8 actual);
    error UnexpectedProofType(uint8 expected, uint8 actual);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /// @param _homeChainId The blockchain ID of the chain hosting the registries
    /// @param _homeEmitter The AgentProofEmitter address on the home chain
    constructor(bytes32 _homeChainId, address _homeEmitter) {
        homeChainId = _homeChainId;
        homeEmitter = _homeEmitter;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROOF VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify an identity proof from a Warp message
    /// @dev The signed Warp message must be included in the tx predicate.
    ///      The VM verifies the BLS signature before this function runs.
    /// @param index The Warp message index in the predicate (usually 0)
    /// @return agentId The verified agent ID
    function verifyIdentity(uint32 index) external returns (uint256 agentId) {
        bytes memory payload = _extractVerifiedPayload(index);

        uint8 schema;
        uint8 proofType;
        address owner;
        string memory endpoint;
        uint256 timestamp;

        (schema, proofType, agentId, owner, endpoint, timestamp) = abi.decode(
            payload,
            (uint8, uint8, uint256, address, string, uint256)
        );

        if (schema != EXPECTED_SCHEMA) revert UnexpectedSchema(EXPECTED_SCHEMA, schema);
        if (proofType != PROOF_IDENTITY) revert UnexpectedProofType(PROOF_IDENTITY, proofType);

        identityProofs[agentId] = IdentityProof({
            owner: owner,
            endpoint: endpoint,
            provenAt: timestamp,
            verified: true
        });

        emit IdentityVerified(agentId, owner, endpoint);
    }

    /// @notice Verify a reputation proof from a Warp message
    /// @param index The Warp message index in the predicate
    /// @return agentId The verified agent ID
    function verifyReputation(uint32 index) external returns (uint256 agentId) {
        bytes memory payload = _extractVerifiedPayload(index);

        uint8 schema;
        uint8 proofType;
        uint64 feedbackCount;
        int128 aggregateScore;
        uint8 decimals;
        uint256 timestamp;

        (schema, proofType, agentId, feedbackCount, aggregateScore, decimals, timestamp) = abi.decode(
            payload,
            (uint8, uint8, uint256, uint64, int128, uint8, uint256)
        );

        if (schema != EXPECTED_SCHEMA) revert UnexpectedSchema(EXPECTED_SCHEMA, schema);
        if (proofType != PROOF_REPUTATION) revert UnexpectedProofType(PROOF_REPUTATION, proofType);

        reputationProofs[agentId] = ReputationProof({
            feedbackCount: feedbackCount,
            aggregateScore: aggregateScore,
            decimals: decimals,
            provenAt: timestamp,
            verified: true
        });

        emit ReputationVerified(agentId, feedbackCount, aggregateScore);
    }

    /// @notice Verify a validation proof from a Warp message
    /// @param index The Warp message index in the predicate
    /// @return agentId The verified agent ID
    function verifyValidation(uint32 index) external returns (uint256 agentId) {
        bytes memory payload = _extractVerifiedPayload(index);

        uint8 schema;
        uint8 proofType;
        address validator;
        uint8 response;
        string memory tag;
        uint256 timestamp;

        (schema, proofType, agentId, validator, response, tag, timestamp) = abi.decode(
            payload,
            (uint8, uint8, uint256, address, uint8, string, uint256)
        );

        if (schema != EXPECTED_SCHEMA) revert UnexpectedSchema(EXPECTED_SCHEMA, schema);
        if (proofType != PROOF_VALIDATION) revert UnexpectedProofType(PROOF_VALIDATION, proofType);

        validationProofs[agentId][validator] = ValidationProof({
            response: response,
            tag: tag,
            provenAt: timestamp,
            verified: true
        });

        emit ValidationVerified(agentId, validator, response);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS (Free reads after verification)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Check if an agent's identity has been verified on this chain
    /// @param agentId The agent to check
    /// @return True if a valid identity proof exists
    function isVerified(uint256 agentId) external view returns (bool) {
        return identityProofs[agentId].verified;
    }

    /// @notice Get the verified owner of an agent
    /// @param agentId The agent to query
    /// @return The owner address from the proof
    function verifiedOwnerOf(uint256 agentId) external view returns (address) {
        return identityProofs[agentId].owner;
    }

    /// @notice Get the verified endpoint of an agent
    /// @param agentId The agent to query
    /// @return The endpoint from the proof
    function verifiedEndpoint(uint256 agentId) external view returns (string memory) {
        return identityProofs[agentId].endpoint;
    }

    /// @notice Check how fresh a proof is
    /// @param agentId The agent to query
    /// @return Age of the proof in seconds (0 if not verified)
    function proofAge(uint256 agentId) external view returns (uint256) {
        IdentityProof storage proof = identityProofs[agentId];
        if (!proof.verified) return 0;
        return block.timestamp - proof.provenAt;
    }

    /// @notice Check if an agent has sufficient reputation on this chain
    /// @param agentId The agent to check
    /// @param minScore Minimum acceptable score
    /// @return True if verified reputation meets threshold
    function meetsReputationThreshold(
        uint256 agentId,
        int128 minScore
    ) external view returns (bool) {
        ReputationProof storage proof = reputationProofs[agentId];
        return proof.verified && proof.aggregateScore >= minScore;
    }

    /// @notice Check if an agent was validated by a specific validator
    /// @param agentId The agent to check
    /// @param validator The validator to check
    /// @return True if approved validation proof exists
    function isValidatedBy(
        uint256 agentId,
        address validator
    ) external view returns (bool) {
        ValidationProof storage proof = validationProofs[agentId][validator];
        return proof.verified && proof.response == 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Extract and validate the Warp message payload
    function _extractVerifiedPayload(uint32 index) internal view returns (bytes memory) {
        (bool success, bytes memory result) = WARP_PRECOMPILE.staticcall(
            abi.encodeWithSignature(
                "getVerifiedWarpMessage(uint32)",
                index
            )
        );
        require(success, "Warp: call failed");

        (
            bytes32 sourceChainID,
            address originSenderAddress,
            bytes memory payload,
            bool valid
        ) = abi.decode(result, (bytes32, address, bytes, bool));

        if (!valid) revert InvalidWarpMessage();
        if (sourceChainID != homeChainId) {
            revert WrongSourceChain(homeChainId, sourceChainID);
        }
        if (originSenderAddress != homeEmitter) {
            revert WrongEmitter(homeEmitter, originSenderAddress);
        }

        return payload;
    }
}
