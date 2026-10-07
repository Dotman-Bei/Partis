// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PartisBase} from "./Base.t.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract MetadataTest is PartisBase {
    function _decodeDataUri(string memory uri) internal pure returns (string memory) {
        bytes memory b = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");
        bytes memory payload = new bytes(b.length - prefix.length);
        for (uint256 i; i < payload.length; ++i) {
            payload[i] = b[i + prefix.length];
        }
        return string(vm.parseBytes(string.concat("0x", _b64ToHex(string(payload)))));
    }

    /// @dev Minimal base64 decoder (forge-std has no decode cheatcode).
    function _b64ToHex(string memory s) internal pure returns (string memory) {
        bytes memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        bytes memory src = bytes(s);
        bytes memory out = new bytes((src.length / 4) * 3);
        uint256 o;
        for (uint256 i; i < src.length; i += 4) {
            uint256 n;
            uint256 pad;
            for (uint256 j; j < 4; ++j) {
                bytes1 c = src[i + j];
                uint256 v;
                if (c == "=") {
                    pad++;
                } else {
                    for (uint256 k; k < 64; ++k) {
                        if (table[k] == c) {
                            v = k;
                            break;
                        }
                    }
                }
                n = (n << 6) | v;
            }
            out[o++] = bytes1(uint8(n >> 16));
            if (pad < 2) out[o++] = bytes1(uint8(n >> 8));
            if (pad < 1) out[o++] = bytes1(uint8(n));
        }
        bytes memory trimmed = new bytes(o);
        for (uint256 i; i < o; ++i) {
            trimmed[i] = out[i];
        }
        return _toHex(trimmed);
    }

    function _toHex(bytes memory data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(data.length * 2);
        for (uint256 i; i < data.length; ++i) {
            str[i * 2] = hexChars[uint8(data[i] >> 4)];
            str[i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function test_tokenURI_isValidJsonWithLiveStatus() public {
        uint256 id = _createEvent(0, 10);
        vm.prank(alice);
        uint256 tokenId = partis.claim(id);

        string memory json = _decodeDataUri(partis.tokenURI(tokenId));
        assertEq(vm.parseJsonString(json, ".name"), "BOT Builders Meetup - Pass #1");
        assertEq(vm.parseJsonString(json, ".attributes[0].value"), "1");
        assertEq(vm.parseJsonString(json, ".attributes[5].value"), "Active");

        vm.warp(partis.getEvent(id).checkInStart);
        vm.prank(organizer);
        partis.checkIn(id, tokenId);
        json = _decodeDataUri(partis.tokenURI(tokenId));
        assertEq(vm.parseJsonString(json, ".attributes[5].value"), "Checked In");
    }

    function test_tokenURI_escapesHostileStrings() public {
        PartisEventPass.EventConfig memory c = _config(0, 10);
        c.name = 'Bad "name" \\ <script>';
        c.venue = "Line\nbreak & <tag>";
        vm.prank(organizer);
        uint256 id = partis.createEvent(c);
        vm.prank(alice);
        uint256 tokenId = partis.claim(id);

        string memory json = _decodeDataUri(partis.tokenURI(tokenId));
        // Parses as JSON and round-trips the name exactly.
        assertEq(vm.parseJsonString(json, ".name"), 'Bad "name" \\ <script> - Pass #1');
        assertEq(vm.parseJsonString(json, ".attributes[3].value"), "Line break & <tag>");
    }

    function test_tokenURI_revertsForMissingToken() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 5));
        partis.tokenURI(5);
    }
}
