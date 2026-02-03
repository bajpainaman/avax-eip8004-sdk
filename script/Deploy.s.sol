// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {AgentIdentityRegistry} from "../src/registries/AgentIdentityRegistry.sol";
import {AgentReputationRegistry} from "../src/registries/AgentReputationRegistry.sol";
import {AgentValidationRegistry} from "../src/registries/AgentValidationRegistry.sol";
import {CrossChainAgentVerifier} from "../src/crosschain/CrossChainAgentVerifier.sol";
import {AgentRegistryResponder} from "../src/crosschain/AgentRegistryResponder.sol";

/// @title Deploy
/// @notice Deploys all EIP-8004 contracts to an Avalanche chain
contract Deploy is Script {
    // Known Teleporter addresses
    address constant TELEPORTER_C_CHAIN = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;
    address constant TELEPORTER_FUJI = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Use env variable or default to Fuji teleporter
        address teleporter = vm.envOr("TELEPORTER_ADDRESS", TELEPORTER_FUJI);

        console.log("=== EIP-8004 Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Teleporter:", teleporter);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Identity Registry
        AgentIdentityRegistry identityRegistry = new AgentIdentityRegistry();
        console.log("AgentIdentityRegistry:", address(identityRegistry));

        // 2. Deploy Reputation Registry
        AgentReputationRegistry reputationRegistry =
            new AgentReputationRegistry(address(identityRegistry));
        console.log("AgentReputationRegistry:", address(reputationRegistry));

        // 3. Deploy Validation Registry
        AgentValidationRegistry validationRegistry =
            new AgentValidationRegistry(address(identityRegistry));
        console.log("AgentValidationRegistry:", address(validationRegistry));

        // 4. Deploy Cross-Chain Verifier
        CrossChainAgentVerifier verifier = new CrossChainAgentVerifier(teleporter, deployer);
        console.log("CrossChainAgentVerifier:", address(verifier));

        // 5. Deploy Registry Responder
        AgentRegistryResponder responder = new AgentRegistryResponder(
            teleporter, address(identityRegistry), address(reputationRegistry), deployer
        );
        console.log("AgentRegistryResponder:", address(responder));

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Identity:", address(identityRegistry));
        console.log("Reputation:", address(reputationRegistry));
        console.log("Validation:", address(validationRegistry));
        console.log("Verifier:", address(verifier));
        console.log("Responder:", address(responder));
    }
}
