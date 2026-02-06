// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {IAgentIdentityRegistry} from "../interfaces/IAgentIdentityRegistry.sol";
import {IAgentReputationRegistry} from "../interfaces/IAgentReputationRegistry.sol";
import {IAgentValidationRegistry} from "../interfaces/IAgentValidationRegistry.sol";
import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title AgentProofEmitter
/// @notice Emits Warp-signed proofs of agent identity, reputation, and validation
/// @dev Deploy on the home chain where registries live. Proofs can be verified
///      on any Avalanche L1 without calling back to this chain.
contract AgentProofEmitter {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Warp precompile address (same on all Avalanche L1s)
    address private constant WARP_PRECOMPILE = 0x0200000000000000000000000000000000000005;

    /// @notice Proof types
    uint8 public constant PROOF_IDENTITY = 1;
    uint8 public constant PROOF_REPUTATION = 2;
    uint8 public constant PROOF_VALIDATION = 3;

    /// @notice Schema version for forward compatibility
    uint8 public constant SCHEMA_VERSION = 1;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The agent identity registry on this chain
    IAgentIdentityRegistry public immutable identityRegistry;

    /// @notice The agent reputation registry on this chain
    IAgentReputationRegistry public immutable reputationRegistry;

    /// @notice The agent validation registry on this chain
    IAgentValidationRegistry public immutable validationRegistry;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event IdentityProofEmitted(uint256 indexed agentId, bytes32 indexed messageId);
    event ReputationProofEmitted(uint256 indexed agentId, bytes32 indexed messageId);
    event ValidationProofEmitted(uint256 indexed agentId, bytes32 indexed messageId);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error AgentDoesNotExist(uint256 agentId);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /// @param _identityRegistry Address of AgentIdentityRegistry
    /// @param _reputationRegistry Address of AgentReputationRegistry
    /// @param _validationRegistry Address of AgentValidationRegistry
    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry
    ) {
        identityRegistry = IAgentIdentityRegistry(_identityRegistry);
        reputationRegistry = IAgentReputationRegistry(_reputationRegistry);
        validationRegistry = IAgentValidationRegistry(_validationRegistry);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROOF EMISSION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emit a Warp-signed identity proof for an agent
    /// @dev Anyone can call this — the data is public. Validators sign the proof.
    ///      The resulting Warp message can be carried to any L1 and verified locally.
    /// @param agentId The agent to create a proof for
    /// @return messageId The Warp message ID (sha256 hash of unsigned message)
    function emitIdentityProof(uint256 agentId) external returns (bytes32 messageId) {
        if (!identityRegistry.agentExists(agentId)) {
            revert AgentDoesNotExist(agentId);
        }

        address owner = IERC721(address(identityRegistry)).ownerOf(agentId);
        string memory endpoint = identityRegistry.getEndpoint(agentId);

        bytes memory payload = abi.encode(
            SCHEMA_VERSION,
            PROOF_IDENTITY,
            agentId,
            owner,
            endpoint,
            block.timestamp
        );

        messageId = _sendWarpMessage(payload);
        emit IdentityProofEmitted(agentId, messageId);
    }

    /// @notice Emit a Warp-signed reputation snapshot for an agent
    /// @dev Point-in-time reputation proof. Captures current aggregate score.
    /// @param agentId The agent to create a proof for
    /// @return messageId The Warp message ID
    function emitReputationProof(uint256 agentId) external returns (bytes32 messageId) {
        if (!identityRegistry.agentExists(agentId)) {
            revert AgentDoesNotExist(agentId);
        }

        address[] memory emptyClients = new address[](0);
        AgentTypes.Summary memory summary = reputationRegistry.getSummary(
            agentId,
            emptyClients,
            "",
            ""
        );

        bytes memory payload = abi.encode(
            SCHEMA_VERSION,
            PROOF_REPUTATION,
            agentId,
            summary.count,
            summary.value,
            summary.decimals,
            block.timestamp
        );

        messageId = _sendWarpMessage(payload);
        emit ReputationProofEmitted(agentId, messageId);
    }

    /// @notice Emit a Warp-signed validation attestation for an agent
    /// @dev Captures a specific validation result from the validation registry
    /// @param agentId The agent referenced in the validation
    /// @param requestHash The validation request hash to prove
    /// @return messageId The Warp message ID
    function emitValidationProof(
        uint256 agentId,
        bytes32 requestHash
    ) external returns (bytes32 messageId) {
        if (!identityRegistry.agentExists(agentId)) {
            revert AgentDoesNotExist(agentId);
        }

        AgentTypes.ValidationRequest memory req = validationRegistry.getValidationStatus(
            requestHash
        );

        bytes memory payload = abi.encode(
            SCHEMA_VERSION,
            PROOF_VALIDATION,
            agentId,
            req.validator,
            req.response,
            req.tag,
            block.timestamp
        );

        messageId = _sendWarpMessage(payload);
        emit ValidationProofEmitted(agentId, messageId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Call the Warp precompile to emit a signed message
    function _sendWarpMessage(bytes memory payload) internal returns (bytes32 messageId) {
        (bool success, bytes memory result) = WARP_PRECOMPILE.call(
            abi.encodeWithSignature("sendWarpMessage(bytes)", payload)
        );
        require(success, "Warp: sendWarpMessage failed");
        messageId = abi.decode(result, (bytes32));
    }
}
