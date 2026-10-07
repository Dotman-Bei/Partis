// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PartisPassRenderer} from "./PartisPassRenderer.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title PartisEventPass
/// @notice On-chain events and event passes for BOT Chain. Each pass is an ERC-721 token that
///         belongs to exactly one event. Contract state is the source of truth for event
///         configuration, pass issuance, ownership, supply and check-in.
/// @dev    There is no protocol admin and no upgradeability. Every privileged action is scoped
///         to a single event and gated on that event's organizer (or its check-in staff).
///         All loops are bounded by constants.
contract PartisEventPass is ERC721Enumerable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ---------------------------------------------------------------------
    // Limits
    // ---------------------------------------------------------------------

    uint256 public constant MAX_NAME_LENGTH = 80;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 1000;
    uint256 public constant MAX_VENUE_LENGTH = 120;
    uint256 public constant MAX_PASS_NAME_LENGTH = 40;
    uint256 public constant MAX_SUPPLY_PER_EVENT = 100_000;
    uint256 public constant MAX_PAGE_SIZE = 100;
    uint256 public constant MAX_STAFF_PER_EVENT = 50;

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

    /// @notice Result of verifying a pass for a given event at the current block time.
    enum PassCheck {
        Valid,
        EventNotFound,
        PassNotFound,
        WrongEvent,
        AlreadyCheckedIn,
        EventCancelled,
        CheckInNotOpen,
        CheckInClosed
    }

    struct PassData {
        uint256 eventId;
        uint64 issuedAt;
        uint64 checkedInAt;
        address checkedInBy;
        uint128 pricePaid;
    }

    /// @notice A pass joined with its live ownership, for frontends.
    struct PassView {
        uint256 tokenId;
        uint256 eventId;
        address owner;
        uint64 issuedAt;
        uint64 checkedInAt;
        address checkedInBy;
        uint128 pricePaid;
    }

    struct Stats {
        uint256 events;
        uint256 organizers;
        uint256 attendees;
        uint256 passesIssued;
        uint256 checkIns;
        uint256 paidVolume;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Immutable on-chain metadata renderer.
    PartisPassRenderer public immutable renderer;

    uint256 private _eventCount;
    mapping(uint256 eventId => EventData) private _events;
    mapping(address organizer => uint256[]) private _organizerEvents;

    uint256 private _lastTokenId;
    mapping(uint256 tokenId => PassData) private _passes;
    mapping(uint256 eventId => uint256[]) private _eventTokenIds;
    mapping(uint256 eventId => mapping(address account => bool)) private _claimed;
    mapping(address account => bool) private _isAttendee;
    mapping(uint256 eventId => EnumerableSet.AddressSet) private _staff;

    uint256 public totalOrganizers;
    uint256 public totalAttendees;
    uint256 public totalPassesIssued;
    uint256 public totalPaidVolume;
    uint256 public totalCheckIns;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event EventCreated(
        uint256 indexed eventId, address indexed organizer, uint128 price, uint32 maxSupply, uint64 startTime
    );
    event EventDetailsUpdated(uint256 indexed eventId);
    event SalesPausedSet(uint256 indexed eventId, bool paused);
    event StaffUpdated(uint256 indexed eventId, address indexed account, bool authorized);
    event CheckedIn(uint256 indexed eventId, uint256 indexed tokenId, address indexed holder, address operator);
    event EventCancelled(uint256 indexed eventId);
    event PassRefunded(uint256 indexed eventId, uint256 indexed tokenId, address indexed holder, uint256 amount);
    event ProceedsWithdrawn(uint256 indexed eventId, address indexed organizer, uint256 amount);
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
    error NotCheckInOperator(uint256 eventId, address account);
    error InvalidStaff(address account);
    error StaffLimitReached(uint256 eventId);
    error PassNotValid(uint256 eventId, uint256 tokenId, PassCheck reason);
    error PassAlreadyUsed(uint256 tokenId);
    error CannotCancel(string reason);
    error EventNotCancelled(uint256 eventId);
    error NotPassHolder(uint256 tokenId, address account);
    error WithdrawLocked(uint256 eventId, uint64 unlocksAt);
    error NothingToWithdraw(uint256 eventId);
    error PaymentFailed();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOrganizer(uint256 eventId) {
        if (_existingEvent(eventId).organizer != msg.sender) revert NotOrganizer(eventId, msg.sender);
        _;
    }

    constructor(PartisPassRenderer renderer_) ERC721("Partis Event Pass", "PARTIS") {
        renderer = renderer_;
    }

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

    /// @notice Cancels an event. Allowed only before it ends and before anyone has checked in,
    ///         so every issued pass is refundable in full.
    function cancelEvent(uint256 eventId) external onlyOrganizer(eventId) {
        EventData storage e = _events[eventId];
        if (e.status == EventStatus.Cancelled) revert EventIsCancelled(eventId);
        if (block.timestamp >= e.endTime) revert CannotCancel("event already ended");
        if (e.checkedIn != 0) revert CannotCancel("attendees already checked in");
        e.status = EventStatus.Cancelled;
        emit EventCancelled(eventId);
    }

    /// @notice Withdraws an event's paid-pass proceeds to its organizer.
    /// @dev    Locked until the event ends so that attendees can always be refunded if the
    ///         event is cancelled (cancellation is only possible before the end).
    function withdrawProceeds(uint256 eventId) external nonReentrant onlyOrganizer(eventId) {
        EventData storage e = _events[eventId];
        if (e.status == EventStatus.Cancelled) revert EventIsCancelled(eventId);
        if (block.timestamp < e.endTime) revert WithdrawLocked(eventId, e.endTime);
        uint256 amount = e.proceeds;
        if (amount == 0) revert NothingToWithdraw(eventId);

        e.proceeds = 0;
        emit ProceedsWithdrawn(eventId, msg.sender, amount);
        _sendValue(msg.sender, amount);
    }

    /// @notice Grants or revokes check-in rights for `account` on one event.
    /// @dev    Staff can only verify and check in passes; they cannot configure, cancel or withdraw.
    function setStaff(uint256 eventId, address account, bool authorized) external onlyOrganizer(eventId) {
        if (account == address(0) || account == msg.sender) revert InvalidStaff(account);
        EnumerableSet.AddressSet storage set = _staff[eventId];
        if (authorized) {
            if (set.length() >= MAX_STAFF_PER_EVENT) revert StaffLimitReached(eventId);
            if (!set.add(account)) return;
        } else if (!set.remove(account)) {
            return;
        }
        emit StaffUpdated(eventId, account, authorized);
    }

    // ---------------------------------------------------------------------
    // Organizer / staff: entrance verification
    // ---------------------------------------------------------------------

    /// @notice Records check-in for `tokenId` at `eventId`. Only the organizer or authorized staff.
    /// @dev    `eventId` is the event the operator is admitting people to, not a value read from the
    ///         pass, so a valid pass for a different event is rejected as WrongEvent.
    function checkIn(uint256 eventId, uint256 tokenId) external {
        EventData storage e = _existingEvent(eventId);
        if (msg.sender != e.organizer && !_staff[eventId].contains(msg.sender)) {
            revert NotCheckInOperator(eventId, msg.sender);
        }
        (PassCheck result, address holder) = verifyPass(eventId, tokenId);
        if (result != PassCheck.Valid) revert PassNotValid(eventId, tokenId, result);

        PassData storage p = _passes[tokenId];
        p.checkedInAt = uint64(block.timestamp);
        p.checkedInBy = msg.sender;
        e.checkedIn++;
        totalCheckIns++;

        emit CheckedIn(eventId, tokenId, holder, msg.sender);
    }

    /// @notice Verifies a pass against current chain state. Never reverts.
    /// @return result Valid, or the first reason the pass must be refused.
    /// @return holder Current owner of the pass (zero if it does not exist).
    function verifyPass(uint256 eventId, uint256 tokenId) public view returns (PassCheck result, address holder) {
        EventData storage e = _events[eventId];
        if (e.organizer == address(0)) return (PassCheck.EventNotFound, address(0));
        holder = _ownerOf(tokenId);
        if (holder == address(0)) return (PassCheck.PassNotFound, address(0));
        PassData storage p = _passes[tokenId];
        if (p.eventId != eventId) return (PassCheck.WrongEvent, holder);
        if (p.checkedInAt != 0) return (PassCheck.AlreadyCheckedIn, holder);
        if (e.status == EventStatus.Cancelled) return (PassCheck.EventCancelled, holder);
        if (block.timestamp < e.checkInStart) return (PassCheck.CheckInNotOpen, holder);
        if (block.timestamp >= e.checkInEnd) return (PassCheck.CheckInClosed, holder);
        return (PassCheck.Valid, holder);
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

    /// @notice Burns a pass of a cancelled event and returns what was paid for it to the current holder.
    function refund(uint256 tokenId) external nonReentrant {
        address holder = _ownerOf(tokenId);
        if (holder != msg.sender) revert NotPassHolder(tokenId, msg.sender);
        PassData storage p = _passes[tokenId];
        uint256 eventId = p.eventId;
        EventData storage e = _events[eventId];
        if (e.status != EventStatus.Cancelled) revert EventNotCancelled(eventId);

        uint256 amount = p.pricePaid;
        p.pricePaid = 0;
        e.proceeds -= amount;
        e.refunded++;
        _burn(tokenId);

        emit PassRefunded(eventId, tokenId, msg.sender, amount);
        if (amount != 0) _sendValue(msg.sender, amount);
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

    /// @notice Events for an explicit list of ids. Unknown ids revert. Bounded by MAX_PAGE_SIZE.
    function getEventsByIds(uint256[] calldata ids) external view returns (EventData[] memory out) {
        if (ids.length > MAX_PAGE_SIZE) revert PageTooLarge(ids.length);
        out = new EventData[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            out[i] = _existingEvent(ids[i]);
        }
    }

    /// @notice Pass state plus current owner for each id. Nonexistent or burned ids return owner = 0.
    function getPasses(uint256[] calldata tokenIds) external view returns (PassView[] memory out) {
        if (tokenIds.length > MAX_PAGE_SIZE) revert PageTooLarge(tokenIds.length);
        out = new PassView[](tokenIds.length);
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 id = tokenIds[i];
            PassData storage p = _passes[id];
            out[i] = PassView({
                tokenId: id,
                eventId: p.eventId,
                owner: _ownerOf(id),
                issuedAt: p.issuedAt,
                checkedInAt: p.checkedInAt,
                checkedInBy: p.checkedInBy,
                pricePaid: p.pricePaid
            });
        }
    }

    /// @notice Platform-wide counters, all derived from on-chain actions.
    function stats() external view returns (Stats memory) {
        return Stats({
            events: _eventCount,
            organizers: totalOrganizers,
            attendees: totalAttendees,
            passesIssued: totalPassesIssued,
            checkIns: totalCheckIns,
            paidVolume: totalPaidVolume
        });
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

    /// @notice Fully on-chain metadata (JSON + SVG) reflecting live pass state.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        PassData storage p = _passes[tokenId];
        EventData storage e = _events[p.eventId];
        return renderer.tokenURI(
            PartisPassRenderer.RenderInput({
                tokenId: tokenId,
                eventId: p.eventId,
                eventName: e.name,
                venue: e.venue,
                passName: e.passName,
                organizer: e.organizer,
                startTime: e.startTime,
                checkedIn: p.checkedInAt != 0,
                cancelled: e.status == EventStatus.Cancelled
            })
        );
    }

    function isCheckInOperator(uint256 eventId, address account) public view returns (bool) {
        address org = _events[eventId].organizer;
        return org != address(0) && (account == org || _staff[eventId].contains(account));
    }

    /// @notice Staff list for an event. Bounded by MAX_STAFF_PER_EVENT.
    function getStaff(uint256 eventId) external view returns (address[] memory) {
        return _staff[eventId].values();
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

    /// @dev Transfer rule (PRD §14): passes move freely until check-in. A checked-in pass is a
    ///      permanent attendance record and cannot be transferred, so "used" can never be shed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && _passes[tokenId].checkedInAt != 0) {
            revert PassAlreadyUsed(tokenId);
        }
        return super._update(to, tokenId, auth);
    }

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

    function _sendValue(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert PaymentFailed();
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
