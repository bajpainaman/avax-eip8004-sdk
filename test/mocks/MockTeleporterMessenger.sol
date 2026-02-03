// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {
    ITeleporterMessenger,
    TeleporterMessageInput,
    TeleporterMessage,
    TeleporterMessageReceipt,
    TeleporterFeeInfo
} from "@teleporter/ITeleporterMessenger.sol";

/// @title MockTeleporterMessenger
/// @notice Mock for testing cross-chain functionality
contract MockTeleporterMessenger is ITeleporterMessenger {
    bytes32 public constant MOCK_BLOCKCHAIN_ID = bytes32(uint256(1));

    uint256 private _messageNonce;
    mapping(bytes32 messageId => bytes32 messageHash) private _messageHashes;

    // Store last sent message for testing
    bytes32 public lastDestinationBlockchainID;
    address public lastDestinationAddress;
    bytes public lastMessage;

    event MockMessageSent(
        bytes32 destinationBlockchainID, address destinationAddress, bytes message
    );

    function sendCrossChainMessage(
        TeleporterMessageInput calldata messageInput
    ) external override returns (bytes32 messageID) {
        messageID = keccak256(abi.encode(_messageNonce++, messageInput));
        _messageHashes[messageID] = keccak256(messageInput.message);

        lastDestinationBlockchainID = messageInput.destinationBlockchainID;
        lastDestinationAddress = messageInput.destinationAddress;
        lastMessage = messageInput.message;

        emit MockMessageSent(
            messageInput.destinationBlockchainID, messageInput.destinationAddress, messageInput.message
        );
    }

    // Implement remaining interface functions as stubs
    function retrySendCrossChainMessage(TeleporterMessage calldata) external override {}

    function addFeeAmount(bytes32, address, uint256) external override {}

    function receiveCrossChainMessage(uint32, address) external override {}

    function retryMessageExecution(bytes32, TeleporterMessage calldata) external override {}

    function sendSpecifiedReceipts(
        bytes32,
        bytes32[] calldata,
        TeleporterFeeInfo calldata,
        address[] calldata
    ) external override returns (bytes32) {
        return bytes32(0);
    }

    function redeemRelayerRewards(address) external override {}

    function getMessageHash(bytes32 messageID) external view override returns (bytes32) {
        return _messageHashes[messageID];
    }

    function messageReceived(bytes32) external pure override returns (bool) {
        return false;
    }

    function getRelayerRewardAddress(bytes32) external pure override returns (address) {
        return address(0);
    }

    function checkRelayerRewardAmount(address, address) external pure override returns (uint256) {
        return 0;
    }

    function getFeeInfo(bytes32) external pure override returns (address, uint256) {
        return (address(0), 0);
    }

    function getNextMessageID(bytes32) external pure override returns (bytes32) {
        return bytes32(0);
    }

    function getReceiptQueueSize(bytes32) external pure override returns (uint256) {
        return 0;
    }

    function getReceiptAtIndex(
        bytes32,
        uint256
    ) external pure override returns (TeleporterMessageReceipt memory) {
        return TeleporterMessageReceipt(0, address(0));
    }
}
