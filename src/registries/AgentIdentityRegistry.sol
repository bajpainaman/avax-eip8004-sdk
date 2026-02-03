// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAgentIdentityRegistry} from "../interfaces/IAgentIdentityRegistry.sol";
import {AgentTypes} from "../libraries/AgentTypes.sol";

/// @title AgentIdentityRegistry
/// @notice EIP-8004 compliant agent identity registry for Avalanche
/// @dev Each agent is an ERC-721 NFT with metadata and optional wallet linking
contract AgentIdentityRegistry is
    ERC721,
    ERC721URIStorage,
    EIP712,
    ReentrancyGuard,
    IAgentIdentityRegistry
{
    using ECDSA for bytes32;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice EIP-712 typehash for wallet linking
    bytes32 private constant WALLET_LINK_TYPEHASH =
        keccak256("WalletLink(uint256 agentId,address wallet,uint256 deadline)");

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Next agent ID to mint (starts at 1, 0 reserved)
    uint256 private _nextAgentId;

    /// @notice On-chain metadata: agentId => key => value
    mapping(uint256 agentId => mapping(string key => bytes value)) private _metadata;

    /// @notice Linked wallets: agentId => wallet address
    mapping(uint256 agentId => address wallet) private _agentWallets;

    /// @notice Reverse lookup: wallet => agentId
    mapping(address wallet => uint256 agentId) private _walletToAgent;

    /// @notice A2A endpoint: agentId => endpoint URL (for agent-to-agent communication)
    mapping(uint256 agentId => string endpoint) private _endpoints;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor() ERC721("EIP-8004 Agent", "AGENT") EIP712("AgentIdentityRegistry", "1") {
        _nextAgentId = 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REGISTRATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentIdentityRegistry
    function register(
        string calldata agentURI,
        AgentTypes.MetadataEntry[] calldata metadata
    ) external nonReentrant returns (uint256 agentId) {
        agentId = _nextAgentId++;

        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        uint256 metadataLength = metadata.length;
        for (uint256 i = 0; i < metadataLength;) {
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            unchecked {
                ++i;
            }
        }

        emit AgentRegistered(agentId, msg.sender, agentURI);
    }

    /// @inheritdoc IAgentIdentityRegistry
    function register(string calldata agentURI) external nonReentrant returns (uint256 agentId) {
        agentId = _nextAgentId++;

        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        emit AgentRegistered(agentId, msg.sender, agentURI);
    }

    /// @inheritdoc IAgentIdentityRegistry
    function register() external nonReentrant returns (uint256 agentId) {
        agentId = _nextAgentId++;

        _safeMint(msg.sender, agentId);

        emit AgentRegistered(agentId, msg.sender, "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // METADATA MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentIdentityRegistry
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        _requireOwned(agentId);
        if (ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner(agentId, msg.sender);
        }

        _setTokenURI(agentId, newURI);
        emit AgentURIUpdated(agentId, newURI);
    }

    /// @inheritdoc IAgentIdentityRegistry
    function setMetadata(
        uint256 agentId,
        string calldata key,
        bytes calldata value
    ) external {
        _requireOwned(agentId);
        if (ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner(agentId, msg.sender);
        }

        _metadata[agentId][key] = value;
        emit MetadataUpdated(agentId, key, value);
    }

    /// @inheritdoc IAgentIdentityRegistry
    function getMetadata(
        uint256 agentId,
        string calldata key
    ) external view returns (bytes memory) {
        _requireOwned(agentId);
        return _metadata[agentId][key];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WALLET LINKING (EIP-712)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentIdentityRegistry
    function setAgentWallet(
        uint256 agentId,
        address wallet,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        _requireOwned(agentId);
        if (ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner(agentId, msg.sender);
        }
        if (block.timestamp > deadline) {
            revert SignatureExpired();
        }
        if (_agentWallets[agentId] != address(0)) {
            revert WalletAlreadySet(agentId);
        }

        // Verify EIP-712 signature from wallet owner
        bytes32 structHash = keccak256(abi.encode(WALLET_LINK_TYPEHASH, agentId, wallet, deadline));
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);

        if (signer != wallet) {
            revert InvalidSignature();
        }

        _agentWallets[agentId] = wallet;
        _walletToAgent[wallet] = agentId;

        emit AgentWalletSet(agentId, wallet);
    }

    /// @inheritdoc IAgentIdentityRegistry
    function getAgentWallet(uint256 agentId) external view returns (address) {
        _requireOwned(agentId);
        return _agentWallets[agentId];
    }

    /// @inheritdoc IAgentIdentityRegistry
    function unsetAgentWallet(uint256 agentId) external {
        _requireOwned(agentId);
        if (ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner(agentId, msg.sender);
        }

        address wallet = _agentWallets[agentId];
        if (wallet == address(0)) {
            revert WalletNotSet(agentId);
        }

        delete _walletToAgent[wallet];
        delete _agentWallets[agentId];

        emit AgentWalletUnset(agentId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // A2A ENDPOINT (Agent-to-Agent Discovery)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentIdentityRegistry
    function setEndpoint(uint256 agentId, string calldata endpoint) external {
        _requireOwned(agentId);
        if (ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner(agentId, msg.sender);
        }

        _endpoints[agentId] = endpoint;
        emit EndpointUpdated(agentId, endpoint);
    }

    /// @inheritdoc IAgentIdentityRegistry
    function getEndpoint(uint256 agentId) external view returns (string memory) {
        _requireOwned(agentId);
        return _endpoints[agentId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IAgentIdentityRegistry
    function agentExists(uint256 agentId) external view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }

    /// @inheritdoc IAgentIdentityRegistry
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }

    /// @inheritdoc IAgentIdentityRegistry
    function getAgentByWallet(address wallet) external view returns (uint256) {
        return _walletToAgent[wallet];
    }

    /// @notice Get the EIP-712 domain separator
    /// @return The domain separator for signature verification
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OVERRIDES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Required override for ERC721URIStorage
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /// @dev Required override for ERC721URIStorage
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
