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
            _brand(),
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

    /// @dev The Partis logo (brand/partis-mark.svg on its tile + outlined wordmark), as paths.
    function _brand() private pure returns (string memory) {
        return string.concat(
            '<rect x="32" y="32" width="40" height="40" rx="13" fill="#ffd400"/>',
            '<g transform="translate(32 32) scale(.625)" fill="#080808">',
            '<path fill-rule="evenodd" d="M16 8H35a16 16 0 0 1 0 32h-8v13a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3ZM28 24a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z"/>',
            '<path d="M40 46h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z"/></g>',
            '<g transform="translate(86 39) scale(.144)">',
            '<path fill="#f7f7f2" d="M9.1 180.5V43.1H44.7V60.6H45.6Q48.5 53 55.5 47.4Q62.6 41.9 73.7 41.9Q83.6 41.9 92.5 47.1Q101.4 52.4 107.1 63.7Q112.7 75 112.7 93.2Q112.7 110.5 107.3 121.8Q102 133.2 93 138.8Q84.1 144.4 73.3 144.4Q62.8 144.4 55.8 139.3Q48.8 134.3 45.6 126.7H45.1V180.5ZM60.1 116.8Q67.5 116.8 71.6 110.5Q75.7 104.3 75.7 93.2Q75.7 82 71.6 75.7Q67.5 69.4 60.1 69.4Q52.8 69.4 48.5 75.7Q44.2 82 44.2 93.2Q44.2 104 48.5 110.4Q52.8 116.8 60.1 116.8ZM147.9 144.7Q133.6 144.7 124.5 137.6Q115.4 130.4 115.4 115.6Q115.4 104.6 120.3 97.8Q125.1 91.1 133.5 87.8Q141.8 84.4 152.1 83.7Q164.6 82.8 169.9 81.1Q175.1 79.3 175.1 75V74.6Q175.1 70.8 172.1 68.7Q169.1 66.5 163.9 66.5Q158.8 66.5 155.2 68.7Q151.5 70.9 150.6 75.5L118.2 72.3Q119.7 63.9 125.2 57Q130.8 50.1 140.6 46Q150.4 41.9 164.4 41.9Q178.6 41.9 189.1 46.2Q199.7 50.5 205.4 58Q211.1 65.4 211.1 74.6V143.1H177.5V129H176.8Q172.2 137.4 164.9 141.1Q157.7 144.7 147.9 144.7ZM159.6 122Q165.7 122 170.6 118.2Q175.5 114.5 175.5 107.7V99.5Q169.9 101.6 161.2 103Q154.9 104 152.1 106.8Q149.2 109.6 149.2 113.4Q149.2 117.6 152.1 119.8Q155 122 159.6 122ZM222 143.1V43.1H256.9V62.2H258Q260.7 51.6 266.6 46.7Q272.6 41.9 280.5 41.9Q285.1 41.9 289.6 43.3V73.9Q287 72.9 283.1 72.5Q279.2 72.1 276.4 72.1Q268.4 72.1 263.2 77.3Q258 82.5 258 91.1V143.1ZM352.6 43.1V69.2H335.4V111Q335.4 117.3 342.2 117.3Q343.9 117.3 346.9 116.9Q350 116.5 351 116.1L355.3 141.8Q349.1 143.5 343.7 144.1Q338.2 144.6 333.4 144.6Q299.5 144.6 299.5 114.3V69.2H286.8V43.1H299.5V19.3H335.4V43.1ZM360 143.1V43.1H395.9V143.1ZM451.5 144.9Q431.1 144.9 418 136.4Q405 127.9 402.4 113.2L435.6 108.3Q437.4 114.2 441.4 117.4Q445.5 120.6 453.1 120.6Q464.3 120.6 464.3 114.3Q464.3 109 452.8 107L435.1 103.8Q404.7 98.3 404.7 74.4Q404.7 58.8 417 50.3Q429.4 41.9 450.8 41.9Q470.7 41.9 482.9 49.5Q495.2 57.2 497.5 70.8L465.9 75.3Q464.7 70.4 460.8 68.1Q456.8 65.8 451.6 65.8Q446.9 65.8 443.7 67.5Q440.5 69.1 440.5 72.3Q440.5 74.5 442.4 76.5Q444.3 78.4 449.9 79.4L470.3 83Q500.8 88.4 500.8 110Q500.8 120.8 494.4 128.6Q488 136.4 476.9 140.7Q465.8 144.9 451.5 144.9Z"/>',
            '<path fill="#ffd400" d="M367.7 0h20.5a7.7 7.7 0 0 1 7.7 7.7v20.5a7.7 7.7 0 0 1 -7.7 7.7h-20.5a7.7 7.7 0 0 1 -7.7 -7.7v-20.5a7.7 7.7 0 0 1 7.7 -7.7Z"/></g>'
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
