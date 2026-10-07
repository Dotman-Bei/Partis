// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";
import {PartisPassRenderer} from "../src/PartisPassRenderer.sol";

/// @dev Drives random sequences of user actions across a few events and actors.
contract Handler is Test {
    PartisEventPass internal immutable partis;
    address[] internal actors;
    address internal immutable organizer;

    uint256 public successfulCheckIns;
    uint256 public duplicateCheckInsAccepted;
    mapping(uint256 tokenId => bool) internal seen;

    constructor(PartisEventPass p, address org) {
        partis = p;
        organizer = org;
        for (uint256 i; i < 4; ++i) {
            address a = makeAddr(string.concat("actor", vm.toString(i)));
            vm.deal(a, 1_000 ether);
            actors.push(a);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _event(uint256 seed) internal view returns (uint256) {
        return seed % partis.eventCount() + 1;
    }

    function claim(uint256 actorSeed, uint256 eventSeed) external {
        uint256 id = _event(eventSeed);
        uint128 price = partis.getEvent(id).price;
        vm.prank(_actor(actorSeed));
        try partis.claim{value: price}(id) {} catch {}
    }

    function checkIn(uint256 eventSeed, uint256 tokenSeed) external {
        uint256 id = _event(eventSeed);
        uint256 supply = partis.totalPassesIssued();
        if (supply == 0) return;
        uint256 tokenId = tokenSeed % supply + 1;
        vm.prank(organizer);
        try partis.checkIn(id, tokenId) {
            successfulCheckIns++;
            if (seen[tokenId]) duplicateCheckInsAccepted++;
            seen[tokenId] = true;
        } catch {}
    }

    function transfer(uint256 fromSeed, uint256 toSeed, uint256 tokenSeed) external {
        uint256 supply = partis.totalPassesIssued();
        if (supply == 0) return;
        uint256 tokenId = tokenSeed % supply + 1;
        address from = _actor(fromSeed);
        vm.prank(from);
        try partis.transferFrom(from, _actor(toSeed), tokenId) {} catch {}
    }

    function cancel(uint256 eventSeed) external {
        vm.prank(organizer);
        try partis.cancelEvent(_event(eventSeed)) {} catch {}
    }

    function refund(uint256 actorSeed, uint256 tokenSeed) external {
        uint256 supply = partis.totalPassesIssued();
        if (supply == 0) return;
        vm.prank(_actor(actorSeed));
        try partis.refund(tokenSeed % supply + 1) {} catch {}
    }

    function withdraw(uint256 eventSeed) external {
        vm.prank(organizer);
        try partis.withdrawProceeds(_event(eventSeed)) {} catch {}
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 6 hours));
    }
}

contract InvariantsTest is Test {
    PartisEventPass internal partis;
    Handler internal handler;
    address internal organizer = makeAddr("organizer");

    function setUp() public {
        vm.warp(1_800_000_000);
        partis = new PartisEventPass(new PartisPassRenderer());
        for (uint256 i; i < 3; ++i) {
            PartisEventPass.EventConfig memory c;
            c.name = "Event";
            c.venue = "Venue";
            c.passName = "GA";
            c.startTime = uint64(block.timestamp + 2 hours);
            c.endTime = uint64(block.timestamp + 10 hours);
            c.checkInStart = uint64(block.timestamp + 1 hours);
            c.checkInEnd = uint64(block.timestamp + 10 hours);
            c.maxSupply = 8;
            c.price = i == 0 ? 0 : uint128(i) * 1 ether;
            c.onePerWallet = i != 2;
            vm.prank(organizer);
            partis.createEvent(c);
        }
        handler = new Handler(partis, organizer);
        targetContract(address(handler));
    }

    /// Replay: a pass is never accepted at the door twice.
    function invariant_noDuplicateCheckIns() public view {
        assertEq(handler.duplicateCheckInsAccepted(), 0);
        assertEq(partis.totalCheckIns(), handler.successfulCheckIns());
    }

    /// Supply abuse: no event ever issues beyond its cap, and check-ins never exceed issuance.
    function invariant_supplyAndCheckInBounds() public view {
        for (uint256 id = 1; id <= 3; ++id) {
            PartisEventPass.EventData memory e = partis.getEvent(id);
            assertLe(e.minted, e.maxSupply);
            assertLe(e.checkedIn + e.refunded, e.minted);
        }
    }

    /// Payment safety: the contract holds exactly the sum of unwithdrawn, unrefunded proceeds.
    function invariant_solvency() public view {
        uint256 sum;
        for (uint256 id = 1; id <= 3; ++id) {
            sum += partis.getEvent(id).proceeds;
        }
        assertEq(address(partis).balance, sum);
    }

    /// A cancelled event never has check-ins (cancellation requires zero check-ins, and
    /// check-in requires a non-cancelled event).
    function invariant_cancelledEventsHaveNoCheckIns() public view {
        for (uint256 id = 1; id <= 3; ++id) {
            PartisEventPass.EventData memory e = partis.getEvent(id);
            if (e.status == PartisEventPass.EventStatus.Cancelled) assertEq(e.checkedIn, 0);
        }
    }
}
