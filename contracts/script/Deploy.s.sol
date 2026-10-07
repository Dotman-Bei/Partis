// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";
import {PartisPassRenderer} from "../src/PartisPassRenderer.sol";

/// @notice Deploys PartisPassRenderer + PartisEventPass and records the addresses in
///         deployments/<chainId>.json for the frontend.
/// @dev    Usage (testnet):
///           forge script script/Deploy.s.sol --rpc-url bot_testnet --broadcast \
///             --account <keystore-name> --verify --verifier blockscout \
///             --verifier-url https://scan.bohr.life/api/
contract Deploy is Script {
    /// Chain ids verified from dev-docs.botchain.ai (see docs/BOT_CHAIN_CONFIG.md).
    uint256 internal constant BOT_TESTNET = 968;
    uint256 internal constant BOT_MAINNET = 677;
    uint256 internal constant LOCAL = 31337;

    function run() external returns (PartisEventPass partis, PartisPassRenderer renderer) {
        uint256 chainId = block.chainid;
        require(chainId == BOT_TESTNET || chainId == BOT_MAINNET || chainId == LOCAL, "Deploy: unsupported chain");

        vm.startBroadcast();
        renderer = new PartisPassRenderer();
        partis = new PartisEventPass(renderer);
        vm.stopBroadcast();

        string memory key = "deployment";
        vm.serializeUint(key, "chainId", chainId);
        vm.serializeAddress(key, "renderer", address(renderer));
        vm.serializeUint(key, "deployBlock", block.number);
        string memory json = vm.serializeAddress(key, "partis", address(partis));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(chainId), ".json"));

        console2.log("PartisPassRenderer:", address(renderer));
        console2.log("PartisEventPass:   ", address(partis));
    }
}
