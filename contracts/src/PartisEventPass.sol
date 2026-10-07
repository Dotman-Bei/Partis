// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PartisEventPass
/// @notice On-chain events and event passes for BOT Chain. Each pass is an ERC-721 token that
///         belongs to exactly one event. Contract state is the source of truth for event
///         configuration, pass issuance, ownership, supply and check-in.
/// @dev    There is no protocol admin and no upgradeability. Every privileged action is scoped
///         to a single event and gated on that event's organizer (or its check-in staff).
///         All loops are bounded by constants.
contract PartisEventPass is ERC721Enumerable, ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Limits
    // ---------------------------------------------------------------------

    uint256 public constant MAX_NAME_LENGTH = 80;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 1000;
    uint256 public constant MAX_VENUE_LENGTH = 120;
    uint256 public constant MAX_PASS_NAME_LENGTH = 40;
    uint256 public constant MAX_SUPPLY_PER_EVENT = 100_000;
    uint256 public constant MAX_PAGE_SIZE = 100;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum EventStatus {
        Active,
        Cancelled
    }

    /// @notice Organizer-supplied configuration for a new event.
    /// @dev    `price == 0` means free claim; `price > 0` means fixed-price purchase in native BOT.
    struct EventConfig {
        string name;
        string description;
        string venue;
        string passName;
        uint64 startTime;
        uint64 endTime;
        uint64 checkInStart;
        uint64 checkInEnd;
        uint32 maxSupply;
        uint128 price;
        bool onePerWallet;
    }

    struct EventData {
        uint256 id;
        address organizer;
        /// @dev address(0) = native BOT. Native BOT is the only payment asset supported in the MVP.
        address paymentAsset;
        string name;
        string description;
        string venue;
        string passName;
        uint64 startTime;
        uint64 endTime;
        uint64 checkInStart;
        uint64 checkInEnd;
        uint64 createdAt;
        uint32 maxSupply;
        uint32 minted;
        uint32 checkedIn;
        uint32 refunded;
        uint128 price;
        bool onePerWallet;
        bool salesPaused;
        EventStatus status;
        /// @dev Native BOT held by this contract for this event, not yet withdrawn or refunded.
        uint256 proceeds;
    }

    struct PassData {
        uint256 eventId;
        uint64 issuedAt;
        uint64 checkedInAt;
        address checkedInBy;
        uint128 pricePaid;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 private _eventCount;
    mapping(uint256 eventId => EventData) private _events;
    mapping(address organizer => uint256[]) private _organizerEvents;

    uint256 private _lastTokenId;
    mapping(uint256 tokenId => PassData) private _passes;
    mapping(uint256 eventId => uint256[]) private _eventTokenIds;
    mapping(uint256 eventId => mapping(address account => bool)) private _claimed;
    mapping(address account => bool) private _isAttendee;

    uint256 public totalOrganizers;
    uint256 public totalAttendees;
    uint256 public totalPassesIssued;
    uint256 public totalPaidVolume;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event EventCreated(
        uint256 indexed eventId, address indexed organizer, uint128 price, uint32 maxSupply, uint64 startTime
    );
    event EventDetailsUpdated(uint256 indexed eventId);
    event SalesPausedSet(uint256 indexed eventId, bool paused);
    event PassIssued(uint256 indexed eventId, uint256 indexed tokenId, address indexed holder, uint256 pricePaid);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error EventNotFound(uint256 eventId);
    error NotOrganizer(uint256 eventId, address account);
    error InvalidEventConfig(string reason);
    error EventIsCancelled(uint256 eventId);
    error PageTooLarge(uint256 limit);
    error SalesPaused(uint256 eventId);
    error SalesEnded(uint256 eventId);
    error SoldOut(uint256 eventId);
    error IncorrectPayment(uint256 expected, uint256 received);
    error AlreadyClaimed(uint256 eventId, address account);

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOrganizer(uint256 eventId) {
        if (_existingEvent(eventId).organizer != msg.sender) revert NotOrganizer(eventId, msg.sender);
        _;
    }

    constructor() ERC721("Partis Event Pass", "PARTIS") {}

    // ---------------------------------------------------------------------
    // Organizer: event lifecycle
    // ---------------------------------------------------------------------

    /// @notice Creates an event owned by `msg.sender`.
    function createEvent(EventConfig calldata config) external returns (uint256 eventId) {
        _validateConfig(config);

        eventId = ++_eventCount;
        EventData storage e = _events[eventId];
        e.id = eventId;
        e.organizer = msg.sender;
        e.name = config.name;
        e.description = config.description;
        e.venue = config.venue;
        e.passName = config.passName;
        e.startTime = config.startTime;
        e.endTime = config.endTime;
        e.checkInStart = config.checkInStart;
        e.checkInEnd = config.checkInEnd;
        e.createdAt = uint64(block.timestamp);
        e.maxSupply = config.maxSupply;
        e.price = config.price;
        e.onePerWallet = config.onePerWallet;

        if (_organizerEvents[msg.sender].length == 0) totalOrganizers++;
        _organizerEvents[msg.sender].push(eventId);

        emit EventCreated(eventId, msg.sender, config.price, config.maxSupply, config.startTime);
    }

    /// @notice Updates the off-critical-path text of an event. Times, supply and price are immutable.
    function updateEventDetails(uint256 eventId, string calldata description, string calldata venue)
        external
        onlyOrganizer(eventId)
    {
        EventData storage e = _events[eventId];
        if (e.status == EventStatus.Cancelled) revert EventIsCancelled(eventId);
        if (bytes(description).length > MAX_DESCRIPTION_LENGTH) revert InvalidEventConfig("description too long");
        if (bytes(venue).length == 0 || bytes(venue).length > MAX_VENUE_LENGTH) revert InvalidEventConfig("venue");
        e.description = description;
        e.venue = venue;
        emit EventDetailsUpdated(eventId);
    }

    /// @notice Temporarily stops or resumes pass issuance. Does not affect check-in.
    function setSalesPaused(uint256 eventId, bool paused) external onlyOrganizer(eventId) {
        EventData storage e = _events[eventId];
        if (e.status == EventStatus.Cancelled) revert EventIsCancelled(eventId);
        e.salesPaused = paused;
        emit SalesPausedSet(eventId, paused);
    }

    // ---------------------------------------------------------------------
    // Attendee: pass issuance
    // ---------------------------------------------------------------------

    /// @notice Claims a free pass (send 0) or buys a fixed-price pass (send exactly `price` in BOT).
    /// @return tokenId The newly issued pass.
    function claim(uint256 eventId) external payable nonReentrant returns (uint256 tokenId) {
        EventData storage e = _existingEvent(eventId);
        if (e.status == EventStatus.Cancelled) revert EventIsCancelled(eventId);
        if (e.salesPaused) revert SalesPaused(eventId);
        if (block.timestamp >= e.endTime) revert SalesEnded(eventId);
        if (e.minted >= e.maxSupply) revert SoldOut(eventId);
        if (msg.value != e.price) revert IncorrectPayment(e.price, msg.value);
        if (e.onePerWallet && _claimed[eventId][msg.sender]) revert AlreadyClaimed(eventId, msg.sender);

        // Effects
        tokenId = ++_lastTokenId;
        _passes[tokenId] = PassData({
            eventId: eventId,
            issuedAt: uint64(block.timestamp),
            checkedInAt: 0,
            checkedInBy: address(0),
            pricePaid: uint128(msg.value)
        });
        _eventTokenIds[eventId].push(tokenId);
        _claimed[eventId][msg.sender] = true;
        e.minted++;
        e.proceeds += msg.value;
        totalPassesIssued++;
        totalPaidVolume += msg.value;
        if (!_isAttendee[msg.sender]) {
            _isAttendee[msg.sender] = true;
            totalAttendees++;
        }

        emit PassIssued(eventId, tokenId, msg.sender, msg.value);

        // Interaction (onERC721Received on contract wallets) last; guarded by nonReentrant.
        _safeMint(msg.sender, tokenId);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function eventCount() external view returns (uint256) {
        return _eventCount;
    }

    function getEvent(uint256 eventId) external view returns (EventData memory) {
        return _existingEvent(eventId);
    }

    /// @notice Events with ids in [offset + 1, offset + limit], ascending. Bounded by MAX_PAGE_SIZE.
    function getEvents(uint256 offset, uint256 limit) external view returns (EventData[] memory page) {
        if (limit > MAX_PAGE_SIZE) revert PageTooLarge(limit);
        uint256 count = _eventCount;
        if (offset >= count) return page;
        uint256 n = count - offset < limit ? count - offset : limit;
        page = new EventData[](n);
        for (uint256 i; i < n; ++i) {
            page[i] = _events[offset + i + 1];
        }
    }

    function organizerEventCount(address organizer) external view returns (uint256) {
        return _organizerEvents[organizer].length;
    }

    function getOrganizerEventIds(address organizer, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids)
    {
        return _slice(_organizerEvents[organizer], offset, limit);
    }

    function hasClaimed(uint256 eventId, address account) external view returns (bool) {
        return _claimed[eventId][account];
    }

    function getPass(uint256 tokenId) external view returns (PassData memory) {
        return _passes[tokenId];
    }

    function eventPassCount(uint256 eventId) external view returns (uint256) {
        return _eventTokenIds[eventId].length;
    }

    /// @notice Token ids issued for an event, in issuance order. Bounded by MAX_PAGE_SIZE.
    function getEventTokenIds(uint256 eventId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        return _slice(_eventTokenIds[eventId], offset, limit);
    }

    /// @notice Token ids currently owned by `owner`. Bounded by MAX_PAGE_SIZE.
    function getOwnerTokenIds(address owner, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids)
    {
        if (limit > MAX_PAGE_SIZE) revert PageTooLarge(limit);
        uint256 bal = balanceOf(owner);
        if (offset >= bal) return ids;
        uint256 n = bal - offset < limit ? bal - offset : limit;
        ids = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = tokenOfOwnerByIndex(owner, offset + i);
        }
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _existingEvent(uint256 eventId) internal view returns (EventData storage e) {
        e = _events[eventId];
        if (e.organizer == address(0)) revert EventNotFound(eventId);
    }

    function _validateConfig(EventConfig calldata c) internal view {
        uint256 nameLen = bytes(c.name).length;
        if (nameLen == 0 || nameLen > MAX_NAME_LENGTH) revert InvalidEventConfig("name");
        if (bytes(c.description).length > MAX_DESCRIPTION_LENGTH) revert InvalidEventConfig("description too long");
        uint256 venueLen = bytes(c.venue).length;
        if (venueLen == 0 || venueLen > MAX_VENUE_LENGTH) revert InvalidEventConfig("venue");
        uint256 passLen = bytes(c.passName).length;
        if (passLen == 0 || passLen > MAX_PASS_NAME_LENGTH) revert InvalidEventConfig("pass name");
        if (c.startTime >= c.endTime) revert InvalidEventConfig("start must be before end");
        if (c.endTime <= block.timestamp) revert InvalidEventConfig("event already ended");
        if (c.checkInStart >= c.checkInEnd) revert InvalidEventConfig("check-in window");
        if (c.checkInEnd > c.endTime) revert InvalidEventConfig("check-in must close by event end");
        if (c.maxSupply == 0 || c.maxSupply > MAX_SUPPLY_PER_EVENT) revert InvalidEventConfig("supply");
    }

    function _slice(uint256[] storage arr, uint256 offset, uint256 limit)
        internal
        view
        returns (uint256[] memory out)
    {
        if (limit > MAX_PAGE_SIZE) revert PageTooLarge(limit);
        uint256 len = arr.length;
        if (offset >= len) return out;
        uint256 n = len - offset < limit ? len - offset : limit;
        out = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            out[i] = arr[offset + i];
        }
    }
}
