// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {AgentIdentityRegistry} from "../../src/registries/AgentIdentityRegistry.sol";
import {IAgentIdentityRegistry} from "../../src/interfaces/IAgentIdentityRegistry.sol";
import {AgentTypes} from "../../src/libraries/AgentTypes.sol";

contract AgentIdentityRegistryTest is Test {
    AgentIdentityRegistry public registry;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public walletPrivateKey;
    address public agentWallet;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentURIUpdated(uint256 indexed agentId, string newURI);
    event MetadataUpdated(uint256 indexed agentId, string key, bytes value);
    event AgentWalletSet(uint256 indexed agentId, address wallet);
    event AgentWalletUnset(uint256 indexed agentId);

    function setUp() public {
        registry = new AgentIdentityRegistry();
        walletPrivateKey = uint256(keccak256(abi.encodePacked("wallet")));
        agentWallet = vm.addr(walletPrivateKey);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REGISTRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_RegisterAgentWithURIAndMetadata() public {
        vm.startPrank(alice);

        AgentTypes.MetadataEntry[] memory metadata = new AgentTypes.MetadataEntry[](2);
        metadata[0] = AgentTypes.MetadataEntry({key: "version", value: abi.encode("1.0")});
        metadata[1] = AgentTypes.MetadataEntry({key: "type", value: abi.encode("chatbot")});

        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(1, alice, "ipfs://agent-metadata");

        uint256 agentId = registry.register("ipfs://agent-metadata", metadata);

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), alice);
        assertEq(registry.tokenURI(agentId), "ipfs://agent-metadata");
        assertEq(registry.getMetadata(agentId, "version"), abi.encode("1.0"));
        assertEq(registry.getMetadata(agentId, "type"), abi.encode("chatbot"));

        vm.stopPrank();
    }

    function test_RegisterAgentWithURIOnly() public {
        vm.prank(alice);
        uint256 agentId = registry.register("https://example.com/agent.json");

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), alice);
        assertEq(registry.tokenURI(agentId), "https://example.com/agent.json");
    }

    function test_RegisterAgentMinimal() public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), alice);
    }

    function test_RegisterMultipleAgents() public {
        vm.prank(alice);
        uint256 agentId1 = registry.register("uri1");

        vm.prank(bob);
        uint256 agentId2 = registry.register("uri2");

        assertEq(agentId1, 1);
        assertEq(agentId2, 2);
        assertEq(registry.totalAgents(), 2);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // URI TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_SetAgentURI() public {
        vm.startPrank(alice);
        uint256 agentId = registry.register("old-uri");

        vm.expectEmit(true, false, false, true);
        emit AgentURIUpdated(agentId, "new-uri");

        registry.setAgentURI(agentId, "new-uri");
        assertEq(registry.tokenURI(agentId), "new-uri");

        vm.stopPrank();
    }

    function test_RevertSetAgentURI_NotOwner() public {
        vm.prank(alice);
        uint256 agentId = registry.register("uri");

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAgentIdentityRegistry.NotAgentOwner.selector, agentId, bob)
        );
        registry.setAgentURI(agentId, "new-uri");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // METADATA TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_SetMetadata() public {
        vm.startPrank(alice);
        uint256 agentId = registry.register();

        vm.expectEmit(true, false, false, true);
        emit MetadataUpdated(agentId, "capability", abi.encode("translation"));

        registry.setMetadata(agentId, "capability", abi.encode("translation"));
        assertEq(registry.getMetadata(agentId, "capability"), abi.encode("translation"));

        vm.stopPrank();
    }

    function test_SetMetadata_OverwriteExisting() public {
        vm.startPrank(alice);
        uint256 agentId = registry.register();

        registry.setMetadata(agentId, "key", abi.encode("value1"));
        registry.setMetadata(agentId, "key", abi.encode("value2"));

        assertEq(registry.getMetadata(agentId, "key"), abi.encode("value2"));
        vm.stopPrank();
    }

    function test_RevertSetMetadata_NotOwner() public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAgentIdentityRegistry.NotAgentOwner.selector, agentId, bob)
        );
        registry.setMetadata(agentId, "key", abi.encode("value"));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WALLET LINKING TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_SetAgentWallet() public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        // Create EIP-712 signature
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("WalletLink(uint256 agentId,address wallet,uint256 deadline)"),
                agentId,
                agentWallet,
                deadline
            )
        );
        bytes32 domainSeparator = registry.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit AgentWalletSet(agentId, agentWallet);

        registry.setAgentWallet(agentId, agentWallet, deadline, signature);

        assertEq(registry.getAgentWallet(agentId), agentWallet);
        assertEq(registry.getAgentByWallet(agentWallet), agentId);
    }

    function test_RevertSetAgentWallet_ExpiredSignature() public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        uint256 deadline = block.timestamp - 1;
        bytes memory signature = new bytes(65);

        vm.prank(alice);
        vm.expectRevert(IAgentIdentityRegistry.SignatureExpired.selector);
        registry.setAgentWallet(agentId, agentWallet, deadline, signature);
    }

    function test_RevertSetAgentWallet_WalletAlreadySet() public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        // First set wallet
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("WalletLink(uint256 agentId,address wallet,uint256 deadline)"),
                agentId,
                agentWallet,
                deadline
            )
        );
        bytes32 domainSeparator = registry.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPrivateKey, digest);

        vm.prank(alice);
        registry.setAgentWallet(agentId, agentWallet, deadline, abi.encodePacked(r, s, v));

        // Try to set again
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IAgentIdentityRegistry.WalletAlreadySet.selector, agentId)
        );
        registry.setAgentWallet(agentId, makeAddr("newWallet"), deadline, new bytes(65));
    }

    function test_UnsetAgentWallet() public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        // Set wallet first
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("WalletLink(uint256 agentId,address wallet,uint256 deadline)"),
                agentId,
                agentWallet,
                deadline
            )
        );
        bytes32 domainSeparator = registry.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPrivateKey, digest);

        vm.prank(alice);
        registry.setAgentWallet(agentId, agentWallet, deadline, abi.encodePacked(r, s, v));

        // Unset wallet
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit AgentWalletUnset(agentId);

        registry.unsetAgentWallet(agentId);

        assertEq(registry.getAgentWallet(agentId), address(0));
        assertEq(registry.getAgentByWallet(agentWallet), 0);
    }

    function test_RevertUnsetAgentWallet_WalletNotSet() public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IAgentIdentityRegistry.WalletNotSet.selector, agentId)
        );
        registry.unsetAgentWallet(agentId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUERY TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_AgentExists() public {
        assertFalse(registry.agentExists(1));

        vm.prank(alice);
        registry.register();

        assertTrue(registry.agentExists(1));
        assertFalse(registry.agentExists(2));
    }

    function test_TotalAgents() public {
        assertEq(registry.totalAgents(), 0);

        vm.prank(alice);
        registry.register();
        assertEq(registry.totalAgents(), 1);

        vm.prank(bob);
        registry.register();
        assertEq(registry.totalAgents(), 2);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_RegisterAgent(string calldata uri) public {
        vm.prank(alice);
        uint256 agentId = registry.register(uri);

        assertEq(agentId, 1);
        assertEq(registry.tokenURI(agentId), uri);
    }

    function testFuzz_SetMetadata(string calldata key, bytes calldata value) public {
        vm.prank(alice);
        uint256 agentId = registry.register();

        vm.prank(alice);
        registry.setMetadata(agentId, key, value);

        assertEq(registry.getMetadata(agentId, key), value);
    }
}
