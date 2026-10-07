// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title PartisPassRenderer
/// @notice Stateless renderer for Partis pass metadata: an on-chain JSON document with an SVG
///         image, so pass art never depends on an off-chain host. Split from PartisEventPass only
///         to keep that contract well under the 24KB code-size limit.
/// @dev    Contains no personal data: only event fields the organizer published and pass state.
contract PartisPassRenderer {
    using Strings for uint256;
    using Strings for address;

    struct RenderInput {
        uint256 tokenId;
        uint256 eventId;
        string eventName;
        string venue;
        string passName;
        address organizer;
        uint64 startTime;
        bool checkedIn;
        bool cancelled;
    }

    function tokenURI(RenderInput calldata r) external pure returns (string memory) {
        string memory status = r.cancelled ? "Cancelled" : r.checkedIn ? "Checked In" : "Active";
        string memory json = string.concat(
            '{"name":"',
            _json(r.eventName),
            " - Pass #",
            r.tokenId.toString(),
            '","description":"Partis event pass. Ownership and check-in state are verified against BOT Chain.",',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(_svg(r, status))),
            '","attributes":[',
            _attr("Event ID", r.eventId.toString(), true),
            _attr("Pass ID", r.tokenId.toString(), true),
            _attr("Pass Type", _json(r.passName), true),
            _attr("Venue", _json(r.venue), true),
            _attr("Organizer", r.organizer.toHexString(), true),
            _attr("Status", status, true),
            '{"trait_type":"Event Date","display_type":"date","value":',
            uint256(r.startTime).toString(),
            "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _attr(string memory key, string memory value, bool comma) private pure returns (string memory) {
        return string.concat('{"trait_type":"', key, '","value":"', value, '"}', comma ? "," : "");
    }

    /// @dev Ticket art in the Partis palette: black ground, signal-yellow hairline and accent.
    function _svg(RenderInput calldata r, string memory status) private pure returns (string memory) {
        string memory accent = r.cancelled ? "#ff5f6d" : r.checkedIn ? "#8fa7ff" : "#ffd400";
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" font-family="Inter,system-ui,sans-serif">',
            '<rect width="400" height="560" rx="22" fill="#080808"/>',
            '<circle cx="40" cy="0" r="220" fill="#ffd400" fill-opacity=".10"/>',
            '<rect x="1" y="1" width="398" height="558" rx="22" fill="none" stroke="#ffd400" stroke-opacity=".14"/>',
            '<rect x="32" y="32" width="40" height="40" rx="13" fill="#ffd400"/>',
            '<text x="52" y="60" text-anchor="middle" font-size="22" font-weight="900" fill="#080808">P</text>',
            '<text x="86" y="58" font-size="20" font-weight="800" fill="#f7f7f2" letter-spacing="-0.8">Partis</text>',
            '<text x="32" y="150" font-size="11" font-weight="800" fill="#9b9b91" letter-spacing="1.1">EVENT #',
            r.eventId.toString(),
            "</text>",
            _svgTitle(r.eventName),
            '<text x="32" y="250" font-size="13" fill="#9b9b91">',
            _xml(_truncate(r.venue, 44)),
            "</text>",
            '<line x1="32" y1="420" x2="368" y2="420" stroke="#ffffff" stroke-opacity=".06" stroke-dasharray="6 6"/>',
            '<text x="32" y="462" font-size="10" font-weight="800" fill="#9b9b91" letter-spacing="1">',
            _xml(_upper(_truncate(r.passName, 30))),
            "</text>",
            '<text x="32" y="500" font-size="34" font-weight="900" fill="#f7f7f2" letter-spacing="-2">#',
            r.tokenId.toString(),
            "</text>",
            '<rect x="250" y="476" width="118" height="30" rx="15" fill="',
            accent,
            '" fill-opacity=".1" stroke="',
            accent,
            '" stroke-opacity=".22"/><text x="309" y="496" text-anchor="middle" font-size="11" font-weight="900" fill="',
            accent,
            '">',
            status,
            "</text></svg>"
        );
    }

    function _svgTitle(string calldata name) private pure returns (string memory) {
        return string.concat(
            '<text x="32" y="200" font-size="28" font-weight="900" fill="#f7f7f2" letter-spacing="-1.4">',
            _xml(_truncate(name, 24)),
            "</text>"
        );
    }

    /// @dev Truncates to `max` bytes, backing off so a multi-byte UTF-8 character is never split.
    function _truncate(string memory s, uint256 max) private pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= max) return s;
        uint256 end = max;
        while (end > 0 && (uint8(b[end]) & 0xC0) == 0x80) end--;
        bytes memory out = new bytes(end);
        for (uint256 i; i < end; ++i) {
            out[i] = b[i];
        }
        return string.concat(string(out), "...");
    }

    function _upper(string memory s) private pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i; i < b.length; ++i) {
            if (b[i] >= 0x61 && b[i] <= 0x7A) b[i] = bytes1(uint8(b[i]) - 32);
        }
        return string(b);
    }

    /// @dev Escapes text for inclusion in SVG/XML character data.
    function _xml(string memory s) private pure returns (string memory out) {
        bytes memory b = bytes(s);
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (c == "&") out = string.concat(out, "&amp;");
            else if (c == "<") out = string.concat(out, "&lt;");
            else if (c == ">") out = string.concat(out, "&gt;");
            else if (c == '"') out = string.concat(out, "&quot;");
            else if (c == "'") out = string.concat(out, "&#39;");
            else out = string.concat(out, string(abi.encodePacked(c)));
        }
    }

    /// @dev Escapes text for inclusion in a JSON string. Control characters become spaces.
    function _json(string memory s) private pure returns (string memory out) {
        bytes memory b = bytes(s);
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (c == '"') out = string.concat(out, '\\"');
            else if (c == "\\") out = string.concat(out, "\\\\");
            else if (uint8(c) < 0x20) out = string.concat(out, " ");
            else out = string.concat(out, string(abi.encodePacked(c)));
        }
    }
}
