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

import {ICrossChainAgentVerifier} from "../interfaces/ICrossChainAgentVerifier.sol";
import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title CrossChainAgentVerifier
/// @notice Verifies agents registered on remote Avalanche chains via ICM
/// @dev Deploy on any L1 that needs to verify agents from other chains
contract CrossChainAgentVerifier is
    ITeleporterReceiver,
    ReentrancyGuard,
    Ownable,
    ICrossChainAgentVerifier
{
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

    /// @notice Remote registry addresses per chain
    mapping(bytes32 chainId => address registry) public override remoteRegistries;

    /// @notice Pending verification requests
    mapping(bytes32 requestId => address requester) public pendingRequests;

    /// @notice Verification results (cached)
    mapping(bytes32 requestId => AgentTypes.AgentVerification result) private _verificationResults;

    /// @notice Gas limit for cross-chain messages
    uint256 public requiredGasLimit = 200_000;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /// @param _teleporter Address of the TeleporterMessenger contract
    /// @param initialOwner Address of the contract owner
    constructor(address _teleporter, address initialOwner) Ownable(initialOwner) {
        teleporter = ITeleporterMessenger(_teleporter);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION (Owner only)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Configure a remote registry address for a chain
    /// @param chainId The blockchain ID
    /// @param registry The registry responder address on that chain
    function configureRegistry(bytes32 chainId, address registry) external onlyOwner {
        remoteRegistries[chainId] = registry;
        emit RegistryConfigured(chainId, registry);
    }

    /// @notice Set the gas limit for cross-chain messages
    /// @param gasLimit New gas limit
    function setRequiredGasLimit(uint256 gasLimit) external onlyOwner {
        requiredGasLimit = gasLimit;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CROSS-CHAIN VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ICrossChainAgentVerifier
    function verifyAgent(
        bytes32 sourceChain,
        uint256 agentId
    ) external nonReentrant returns (bytes32 requestId) {
        address registry = remoteRegistries[sourceChain];
        if (registry == address(0)) {
            revert UnknownChain(sourceChain);
        }

        requestId = keccak256(abi.encode(sourceChain, agentId, block.number, msg.sender));
        pendingRequests[requestId] = msg.sender;

        bytes memory message = abi.encode(MSG_VERIFY_AGENT, requestId, agentId);

        teleporter.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: sourceChain,
                destinationAddress: registry,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: requiredGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: message
            })
        );

        emit VerificationRequested(requestId, sourceChain, agentId, msg.sender);
    }

    /// @inheritdoc ICrossChainAgentVerifier
    function queryReputation(
        bytes32 sourceChain,
        uint256 agentId,
        address[] calldata clients,
        string calldata tag1,
        string calldata tag2
    ) external nonReentrant returns (bytes32 requestId) {
        address registry = remoteRegistries[sourceChain];
        if (registry == address(0)) {
            revert UnknownChain(sourceChain);
        }

        requestId =
            keccak256(abi.encode(sourceChain, agentId, "reputation", block.number, msg.sender));
        pendingRequests[requestId] = msg.sender;

        bytes memory message =
            abi.encode(MSG_QUERY_REPUTATION, requestId, agentId, clients, tag1, tag2);

        teleporter.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: sourceChain,
                destinationAddress: registry,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: requiredGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: message
            })
        );

        emit ReputationQueried(requestId, sourceChain, agentId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TELEPORTER RECEIVER
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Receive verification response via ICM
    /// @dev Called by TeleporterMessenger
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override {
        if (msg.sender != address(teleporter)) {
            revert OnlyTeleporter();
        }
        if (originSenderAddress != remoteRegistries[sourceBlockchainID]) {
            revert UnknownRegistry(sourceBlockchainID, originSenderAddress);
        }

        uint8 msgType = abi.decode(message, (uint8));

        if (msgType == MSG_VERIFY_RESPONSE) {
            _handleVerifyResponse(message);
        } else if (msgType == MSG_REPUTATION_RESPONSE) {
            _handleReputationResponse(message);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ICrossChainAgentVerifier
    function getVerificationResult(
        bytes32 requestId
    ) external view returns (AgentTypes.AgentVerification memory) {
        return _verificationResults[requestId];
    }

    /// @inheritdoc ICrossChainAgentVerifier
    function isRequestPending(bytes32 requestId) external view returns (bool) {
        return pendingRequests[requestId] != address(0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Handle verification response message
    function _handleVerifyResponse(bytes calldata message) internal {
        (
            ,
            bytes32 requestId,
            bool exists,
            address owner,
            string memory agentURI,
            int256 reputationScore,
            uint64 feedbackCount
        ) = abi.decode(message, (uint8, bytes32, bool, address, string, int256, uint64));

        _verificationResults[requestId] = AgentTypes.AgentVerification({
            exists: exists,
            owner: owner,
            agentURI: agentURI,
            reputationScore: reputationScore,
            feedbackCount: feedbackCount
        });

        emit VerificationReceived(requestId, exists, reputationScore);
        delete pendingRequests[requestId];
    }

    /// @dev Handle reputation response message
    function _handleReputationResponse(bytes calldata message) internal {
        (, bytes32 requestId, uint64 feedbackCount, int128 aggregateScore) =
            abi.decode(message, (uint8, bytes32, uint64, int128));

        emit ReputationReceived(requestId, feedbackCount, aggregateScore);
        delete pendingRequests[requestId];
    }
}
