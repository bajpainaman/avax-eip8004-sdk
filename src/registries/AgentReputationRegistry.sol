// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {IAgentReputationRegistry} from "../interfaces/IAgentReputationRegistry.sol";
import {IAgentIdentityRegistry} from "../interfaces/IAgentIdentityRegistry.sol";
import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title AgentReputationRegistry
/// @notice EIP-8004 compliant agent reputation registry
/// @dev Tracks feedback and reputation scores for registered agents
contract AgentReputationRegistry is ReentrancyGuard, IAgentReputationRegistry {
    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Reference to the identity registry
    IAgentIdentityRegistry public immutable identityRegistry;

    /// @notice Feedback storage: agentId => client => feedbacks[]
    mapping(uint256 agentId => mapping(address client => AgentTypes.Feedback[])) private _feedbacks;

    /// @notice Total feedback count per agent
    mapping(uint256 agentId => uint64 count) private _feedbackCounts;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /// @param _identityRegistry Address of the AgentIdentityRegistry
    constructor(address _identityRegistry) {
        identityRegistry = IAgentIdentityRegistry(_identityRegistry);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Reverts if agent is not registered
    modifier onlyRegisteredAgent(uint256 agentId) {
        if (!identityRegistry.agentExists(agentId)) {
            revert AgentNotRegistered(agentId);
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEEDBACK MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentReputationRegistry
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external nonReentrant onlyRegisteredAgent(agentId) {
        AgentTypes.Feedback memory feedback = AgentTypes.Feedback({
            client: msg.sender,
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            endpoint: endpoint,
            feedbackURI: feedbackURI,
            feedbackHash: feedbackHash,
            responseURI: "",
            responseHash: bytes32(0),
            timestamp: uint64(block.timestamp),
            revoked: false
        });

        uint64 index = uint64(_feedbacks[agentId][msg.sender].length);
        _feedbacks[agentId][msg.sender].push(feedback);
        _feedbackCounts[agentId]++;

        emit FeedbackGiven(agentId, msg.sender, index, value, tag1, tag2);
    }

    /// @inheritdoc IAgentReputationRegistry
    function revokeFeedback(
        uint256 agentId,
        uint64 index
    ) external nonReentrant {
        AgentTypes.Feedback[] storage clientFeedbacks = _feedbacks[agentId][msg.sender];

        if (index >= clientFeedbacks.length) {
            revert FeedbackNotFound(agentId, msg.sender, index);
        }
        if (clientFeedbacks[index].revoked) {
            revert FeedbackAlreadyRevoked(agentId, index);
        }

        clientFeedbacks[index].revoked = true;

        emit FeedbackRevoked(agentId, msg.sender, index);
    }

    /// @inheritdoc IAgentReputationRegistry
    function appendResponse(
        uint256 agentId,
        address client,
        uint64 index,
        string calldata responseURI,
        bytes32 responseHash
    ) external nonReentrant onlyRegisteredAgent(agentId) {
        // Verify caller owns the agent
        address agentOwner = IERC721(address(identityRegistry)).ownerOf(agentId);
        if (agentOwner != msg.sender) {
            revert NotAgentOwner(agentId);
        }

        AgentTypes.Feedback[] storage clientFeedbacks = _feedbacks[agentId][client];

        if (index >= clientFeedbacks.length) {
            revert FeedbackNotFound(agentId, client, index);
        }

        clientFeedbacks[index].responseURI = responseURI;
        clientFeedbacks[index].responseHash = responseHash;

        emit ResponseAppended(agentId, client, index);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentReputationRegistry
    function getSummary(
        uint256 agentId,
        address[] calldata clients,
        string calldata tag1,
        string calldata tag2
    ) external view returns (AgentTypes.Summary memory summary) {
        int256 totalValue = 0;
        uint64 count = 0;
        uint8 maxDecimals = 0;

        uint256 clientsLength = clients.length;
        for (uint256 i = 0; i < clientsLength;) {
            AgentTypes.Feedback[] storage clientFeedbacks = _feedbacks[agentId][clients[i]];
            uint256 feedbacksLength = clientFeedbacks.length;

            for (uint256 j = 0; j < feedbacksLength;) {
                AgentTypes.Feedback storage fb = clientFeedbacks[j];

                if (!fb.revoked) {
                    // Filter by tags if provided
                    bool matchTag1 =
                        bytes(tag1).length == 0 || _stringsEqual(fb.tag1, tag1);
                    bool matchTag2 =
                        bytes(tag2).length == 0 || _stringsEqual(fb.tag2, tag2);

                    if (matchTag1 && matchTag2) {
                        totalValue += fb.value;
                        count++;
                        if (fb.valueDecimals > maxDecimals) {
                            maxDecimals = fb.valueDecimals;
                        }
                    }
                }

                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }

        summary.count = count;
        summary.value = int128(totalValue);
        summary.decimals = maxDecimals;
    }

    /// @inheritdoc IAgentReputationRegistry
    function readFeedback(
        uint256 agentId,
        address client,
        uint64 index
    ) external view returns (AgentTypes.Feedback memory) {
        AgentTypes.Feedback[] storage clientFeedbacks = _feedbacks[agentId][client];

        if (index >= clientFeedbacks.length) {
            revert FeedbackNotFound(agentId, client, index);
        }

        return clientFeedbacks[index];
    }

    /// @inheritdoc IAgentReputationRegistry
    function getFeedbackCount(uint256 agentId) external view returns (uint64) {
        return _feedbackCounts[agentId];
    }

    /// @inheritdoc IAgentReputationRegistry
    function getClientFeedbackCount(
        uint256 agentId,
        address client
    ) external view returns (uint64) {
        return uint64(_feedbacks[agentId][client].length);
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
