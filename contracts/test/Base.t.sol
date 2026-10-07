// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";
import {PartisPassRenderer} from "../src/PartisPassRenderer.sol";

abstract contract PartisBase is Test {
    PartisEventPass internal partis;

    address internal organizer = makeAddr("organizer");
    address internal staff = makeAddr("staff");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory");

    uint64 internal constant T0 = 1_800_000_000;

    function setUp() public virtual {
        vm.warp(T0);
        partis = new PartisEventPass(new PartisPassRenderer());
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(mallory, 100 ether);
    }

    /// @dev Event starting in 1 day, lasting 4h, check-in opening 1h before start.
    function _config(uint128 price, uint32 supply) internal pure returns (PartisEventPass.EventConfig memory c) {
        c.name = "BOT Builders Meetup";
        c.description = "Lightning talks and demos from BOT Chain builders.";
        c.venue = "Lagos, Yaba Tech Hub";
        c.passName = "General Admission";
        c.startTime = T0 + 1 days;
        c.endTime = T0 + 1 days + 4 hours;
        c.checkInStart = T0 + 1 days - 1 hours;
        c.checkInEnd = T0 + 1 days + 4 hours;
        c.maxSupply = supply;
        c.price = price;
        c.onePerWallet = true;
    }

    function _createEvent(uint128 price, uint32 supply) internal returns (uint256 id) {
        vm.prank(organizer);
        id = partis.createEvent(_config(price, supply));
    }
}
