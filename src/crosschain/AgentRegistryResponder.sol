// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {
    ITeleporterMessenger,
    TeleporterMessageInput,
    TeleporterFeeInfo
} from "@teleporter/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "@teleporter/ITeleporterReceiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {IAgentIdentityRegistry} from "../interfaces/IAgentIdentityRegistry.sol";
import {IAgentReputationRegistry} from "../interfaces/IAgentReputationRegistry.sol";
import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title AgentRegistryResponder
/// @notice Responds to cross-chain verification queries for local registries
/// @dev Deploy on chains that host authoritative agent registries
contract AgentRegistryResponder is ITeleporterReceiver, ReentrancyGuard, Ownable {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Message type: request agent verification
    uint8 private constant MSG_VERIFY_AGENT = 1;

    /// @notice Message type: verification response
    uint8 private constant MSG_VERIFY_RESPONSE = 2;

    /// @notice Message type: request reputation query
    uint8 private constant MSG_QUERY_REPUTATION = 3;

    /// @notice Message type: reputation response
    uint8 private constant MSG_REPUTATION_RESPONSE = 4;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Teleporter messenger contract
    ITeleporterMessenger public immutable teleporter;

    /// @notice Local identity registry
    IAgentIdentityRegistry public immutable identityRegistry;

    /// @notice Local reputation registry
    IAgentReputationRegistry public immutable reputationRegistry;

    /// @notice Authorized verifier contracts per chain
    mapping(bytes32 chainId => address verifier) public authorizedVerifiers;

    /// @notice Gas limit for response messages
    uint256 public requiredGasLimit = 200_000;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event VerifierAuthorized(bytes32 indexed chainId, address verifier);
    event VerificationQueryReceived(bytes32 indexed requestId, uint256 agentId);
    event ReputationQueryReceived(bytes32 indexed requestId, uint256 agentId);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error OnlyTeleporter();
    error UnauthorizedVerifier(bytes32 chainId, address sender);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /// @param _teleporter Address of TeleporterMessenger
    /// @param _identityRegistry Address of local AgentIdentityRegistry
    /// @param _reputationRegistry Address of local AgentReputationRegistry
    /// @param initialOwner Address of contract owner
    constructor(
        address _teleporter,
        address _identityRegistry,
        address _reputationRegistry,
        address initialOwner
    ) Ownable(initialOwner) {
        teleporter = ITeleporterMessenger(_teleporter);
        identityRegistry = IAgentIdentityRegistry(_identityRegistry);
        reputationRegistry = IAgentReputationRegistry(_reputationRegistry);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION (Owner only)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorize a verifier contract from another chain
    /// @param chainId The blockchain ID
    /// @param verifier The verifier contract address on that chain
    function authorizeVerifier(bytes32 chainId, address verifier) external onlyOwner {
        authorizedVerifiers[chainId] = verifier;
        emit VerifierAuthorized(chainId, verifier);
    }

    /// @notice Set the gas limit for response messages
    /// @param gasLimit New gas limit
    function setRequiredGasLimit(uint256 gasLimit) external onlyOwner {
        requiredGasLimit = gasLimit;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TELEPORTER RECEIVER
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Handle incoming ICM messages
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override nonReentrant {
        if (msg.sender != address(teleporter)) {
            revert OnlyTeleporter();
        }
        if (originSenderAddress != authorizedVerifiers[sourceBlockchainID]) {
            revert UnauthorizedVerifier(sourceBlockchainID, originSenderAddress);
        }

        uint8 msgType = abi.decode(message, (uint8));

        if (msgType == MSG_VERIFY_AGENT) {
            _handleVerifyRequest(sourceBlockchainID, originSenderAddress, message);
        } else if (msgType == MSG_QUERY_REPUTATION) {
            _handleReputationQuery(sourceBlockchainID, originSenderAddress, message);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Handle agent verification request
    function _handleVerifyRequest(
        bytes32 sourceChain,
        address destination,
        bytes calldata message
    ) internal {
        (, bytes32 requestId, uint256 agentId) = abi.decode(message, (uint8, bytes32, uint256));

        emit VerificationQueryReceived(requestId, agentId);

        bool exists = identityRegistry.agentExists(agentId);
        address owner = address(0);
        string memory agentURI = "";
        int256 reputationScore = 0;
        uint64 feedbackCount = 0;

        if (exists) {
            owner = IERC721(address(identityRegistry)).ownerOf(agentId);
            // Get reputation summary (empty clients array = all feedback)
            address[] memory emptyClients = new address[](0);
            AgentTypes.Summary memory summary =
                reputationRegistry.getSummary(agentId, emptyClients, "", "");
            reputationScore = summary.value;
            feedbackCount = summary.count;
        }

        bytes memory response = abi.encode(
            MSG_VERIFY_RESPONSE, requestId, exists, owner, agentURI, reputationScore, feedbackCount
        );

        teleporter.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: sourceChain,
                destinationAddress: destination,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: requiredGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: response
            })
        );
    }

    /// @dev Handle reputation query request
    function _handleReputationQuery(
        bytes32 sourceChain,
        address destination,
        bytes calldata message
    ) internal {
        (
            ,
            bytes32 requestId,
            uint256 agentId,
            address[] memory clients,
            string memory tag1,
            string memory tag2
        ) = abi.decode(message, (uint8, bytes32, uint256, address[], string, string));

        emit ReputationQueryReceived(requestId, agentId);

        AgentTypes.Summary memory summary =
            reputationRegistry.getSummary(agentId, clients, tag1, tag2);

        bytes memory response =
            abi.encode(MSG_REPUTATION_RESPONSE, requestId, summary.count, summary.value);

        teleporter.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: sourceChain,
                destinationAddress: destination,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: requiredGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: response
            })
        );
    }
}
