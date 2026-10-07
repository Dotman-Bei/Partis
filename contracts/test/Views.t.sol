// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PartisBase} from "./Base.t.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";

contract ViewsTest is PartisBase {
    function test_getPasses_joinsOwnership() public {
        uint256 id = _createEvent(1 ether, 10);
        vm.prank(alice);
        uint256 t1 = partis.claim{value: 1 ether}(id);
        vm.prank(bob);
        uint256 t2 = partis.claim{value: 1 ether}(id);

        uint256[] memory ids = new uint256[](3);
        ids[0] = t1;
        ids[1] = t2;
        ids[2] = 77;
        PartisEventPass.PassView[] memory v = partis.getPasses(ids);
        assertEq(v[0].owner, alice);
        assertEq(v[0].eventId, id);
        assertEq(v[0].pricePaid, 1 ether);
        assertEq(v[1].owner, bob);
        assertEq(v[2].owner, address(0));
        assertEq(v[2].eventId, 0);
    }

    function test_getEventsByIds() public {
        _createEvent(0, 10);
        _createEvent(0, 20);
        uint256[] memory ids = new uint256[](2);
        ids[0] = 2;
        ids[1] = 1;
        PartisEventPass.EventData[] memory evs = partis.getEventsByIds(ids);
        assertEq(evs[0].maxSupply, 20);
        assertEq(evs[1].maxSupply, 10);

        ids[1] = 9;
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.EventNotFound.selector, 9));
        partis.getEventsByIds(ids);
    }

    function test_stats_reflectActivity() public {
        uint256 id = _createEvent(1 ether, 10);
        vm.prank(alice);
        uint256 t = partis.claim{value: 1 ether}(id);
        vm.prank(bob);
        partis.claim{value: 1 ether}(id);
        vm.warp(partis.getEvent(id).checkInStart);
        vm.prank(organizer);
        partis.checkIn(id, t);

        PartisEventPass.Stats memory st = partis.stats();
        assertEq(st.events, 1);
        assertEq(st.organizers, 1);
        assertEq(st.attendees, 2);
        assertEq(st.passesIssued, 2);
        assertEq(st.checkIns, 1);
        assertEq(st.paidVolume, 2 ether);
    }

    function test_batchViews_rejectOversizedInput() public {
        uint256[] memory ids = new uint256[](101);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.PageTooLarge.selector, 101));
        partis.getPasses(ids);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.PageTooLarge.selector, 101));
        partis.getEventsByIds(ids);
    }
}
