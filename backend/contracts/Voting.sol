// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {

    // Custom Errors
    error NotAdmin();
    error ElectionNotOpen();
    error ElectionNotClosed();
    error InvalidTime();
    error CandidatesLocked();
    error AlreadyRegistered();
    error NotPending();
    error NotVerified();
    error AlreadyVoted();
    error InvalidCandidate();
    error ResultsAlreadyDeclared();
    error NoCandidates();
    error ResultsNotDeclared();
    error TimelockNotExpired();
    error ActionAlreadyQueued();
    error ActionNotQueued();
    error AlreadyApproved();
    error NotEnoughApprovals();
    error NotAnAdmin();

    // Audit Log
    struct AuditLog {
        uint timestamp;
        address actor;
        string action;
    }

    AuditLog[] public auditLogs;
    event AuditLogAdded(uint timestamp, address indexed actor, string action);

    function _log(string memory action) internal {
        auditLogs.push(AuditLog(block.timestamp, msg.sender, action));
        emit AuditLogAdded(block.timestamp, msg.sender, action);
    }

    function getAuditLogs() public view returns (AuditLog[] memory) {
        return auditLogs;
    }

    // Multi-sig Admin
    address[3] public admins;
    uint public constant REQUIRED_APPROVALS = 2;

    modifier onlyAdmin() {
        if (!_isAdmin(msg.sender)) revert NotAdmin();
        _;
    }

    function _isAdmin(address _addr) internal view returns (bool) {
        for (uint i = 0; i < 3; i++) {
            if (admins[i] == _addr) return true;
        }
        return false;
    }

    function getAdmins() public view returns (address[3] memory) {
        return admins;
    }

    constructor(address _admin2, address _admin3) {
        admins[0] = msg.sender;  // Election Commission (deployer)
        admins[1] = _admin2;     // Government Observer
        admins[2] = _admin3;     // Independent Auditor
    }

    // Timelock + Multi-sig
    uint public constant TIMELOCK_DELAY = 2 minutes;

    struct PendingAction {
        uint approvalCount;
        uint executeAfter;
        bool executed;
        mapping(address => bool) approved;
    }

    mapping(bytes32 => PendingAction) public pendingActions;

    event ActionProposed(bytes32 indexed actionKey, string description, address proposedBy);
    event ActionApproved(bytes32 indexed actionKey, address approvedBy, uint approvalCount);
    event ActionExecuted(bytes32 indexed actionKey, string description);
    event ActionCancelled(bytes32 indexed actionKey, string description);

    function _proposeAction(bytes32 key, string memory description) internal {
        PendingAction storage action = pendingActions[key];
        if (action.approvalCount > 0) revert ActionAlreadyQueued();

        // Proposer automatically counts as first approval
        action.approvalCount = 1;
        action.approved[msg.sender] = true;
        action.executeAfter = 0; // Timer starts only after threshold reached
        action.executed = false;

        emit ActionProposed(key, description, msg.sender);
        emit ActionApproved(key, msg.sender, 1);
        _log(string(abi.encodePacked("Proposed: ", description)));
    }

    function approveAction(bytes32 key) public onlyAdmin {
        PendingAction storage action = pendingActions[key];
        if (action.approvalCount == 0) revert ActionNotQueued();
        if (action.approved[msg.sender]) revert AlreadyApproved();
        if (action.executed) revert ActionAlreadyQueued();

        action.approved[msg.sender] = true;
        action.approvalCount++;

        emit ActionApproved(key, msg.sender, action.approvalCount);
        _log("Action approved");

        // Once threshold reached, start the timelock
        if (action.approvalCount >= REQUIRED_APPROVALS && action.executeAfter == 0) {
            action.executeAfter = block.timestamp + TIMELOCK_DELAY;
        }
    }

    function _executeAction(bytes32 key) internal {
        PendingAction storage action = pendingActions[key];
        if (action.approvalCount == 0) revert ActionNotQueued();
        if (action.approvalCount < REQUIRED_APPROVALS) revert NotEnoughApprovals();
        if (block.timestamp < action.executeAfter) revert TimelockNotExpired();
        if (action.executed) revert ActionAlreadyQueued();
        action.executed = true;
    }

    function cancelAction(bytes32 key, string memory description) public onlyAdmin {
        PendingAction storage action = pendingActions[key];
        if (action.approvalCount == 0) revert ActionNotQueued();
        if (action.executed) revert ActionAlreadyQueued();
        delete pendingActions[key];
        emit ActionCancelled(key, description);
        _log(string(abi.encodePacked("Cancelled: ", description)));
    }

    function getApprovalCount(bytes32 key) public view returns (uint) {
        return pendingActions[key].approvalCount;
    }

    function getTimeRemaining(bytes32 key) public view returns (uint) {
        PendingAction storage action = pendingActions[key];
        if (action.executeAfter == 0) return 0;
        if (block.timestamp >= action.executeAfter) return 0;
        return action.executeAfter - block.timestamp;
    }

    function hasApproved(bytes32 key, address _admin) public view returns (bool) {
        return pendingActions[key].approved[_admin];
    }

    // Election Timing
    uint public startTime;
    uint public endTime;

    event ElectionTimeSet(uint startTime, uint endTime);

    function proposeSetElectionTime(uint _startTime, uint _endTime) public onlyAdmin {
        if (_startTime >= _endTime) revert InvalidTime();
        if (_startTime <= block.timestamp) revert InvalidTime();
        bytes32 key = keccak256(abi.encodePacked("setElectionTime", _startTime, _endTime));
        _proposeAction(key, "Set election time");
    }

    function executeSetElectionTime(uint _startTime, uint _endTime) public onlyAdmin {
        bytes32 key = keccak256(abi.encodePacked("setElectionTime", _startTime, _endTime));
        _executeAction(key);
        startTime = _startTime;
        endTime = _endTime;
        emit ElectionTimeSet(_startTime, _endTime);
        _log("Election time set");
    }

    modifier electionOpen() {
        if (block.timestamp < startTime || block.timestamp > endTime) revert ElectionNotOpen();
        _;
    }

    modifier electionClosed() {
        if (block.timestamp <= endTime) revert ElectionNotClosed();
        _;
    }

    // Candidates
    struct Candidate {
        uint32 id;
        uint32 voteCount;
        string name;
        string photoCID;
    }

    mapping(uint => Candidate) public candidates;
    uint public candidatesCount;

    event CandidateAdded(uint indexed id, string name, string photoCID);

    function proposeAddCandidate(string memory _name, string memory _photoCID) public onlyAdmin {
        if (block.timestamp >= startTime && startTime != 0) revert CandidatesLocked();
        bytes32 key = keccak256(abi.encodePacked("addCandidate", _name, _photoCID));
        _proposeAction(key, string(abi.encodePacked("Add candidate: ", _name)));
    }

    function executeAddCandidate(string memory _name, string memory _photoCID) public onlyAdmin {
        if (block.timestamp >= startTime && startTime != 0) revert CandidatesLocked();
        bytes32 key = keccak256(abi.encodePacked("addCandidate", _name, _photoCID));
        _executeAction(key);
        candidatesCount++;
        candidates[candidatesCount] = Candidate(uint32(candidatesCount), 0, _name, _photoCID);
        emit CandidateAdded(candidatesCount, _name, _photoCID);
        _log(string(abi.encodePacked("Candidate added: ", _name)));
    }

    // Voter Registration
    enum VoterStatus { NotRegistered, Pending, Verified, Rejected }

    mapping(address => VoterStatus) public voterStatus;
    mapping(address => string) public voterIdCID;
    address[] public pendingVoters;

    event VoterRequested(address indexed voter, string idProofCID);
    event VoterApproved(address indexed voter);
    event VoterRejected(address indexed voter);

    function requestVoterRegistration(string memory _idProofCID) public {
        if (voterStatus[msg.sender] != VoterStatus.NotRegistered) revert AlreadyRegistered();
        voterStatus[msg.sender] = VoterStatus.Pending;
        voterIdCID[msg.sender] = _idProofCID;
        pendingVoters.push(msg.sender);
        emit VoterRequested(msg.sender, _idProofCID);
    }

    function approveVoter(address _voter) public onlyAdmin {
        if (voterStatus[_voter] != VoterStatus.Pending) revert NotPending();
        voterStatus[_voter] = VoterStatus.Verified;
        _removeFromPending(_voter);
        emit VoterApproved(_voter);
        _log("Voter approved");
    }

    function rejectVoter(address _voter) public onlyAdmin {
        if (voterStatus[_voter] != VoterStatus.Pending) revert NotPending();
        voterStatus[_voter] = VoterStatus.Rejected;
        _removeFromPending(_voter);
        emit VoterRejected(_voter);
        _log("Voter rejected");
    }

    function _removeFromPending(address _voter) internal {
        for (uint i = 0; i < pendingVoters.length; i++) {
            if (pendingVoters[i] == _voter) {
                pendingVoters[i] = pendingVoters[pendingVoters.length - 1];
                pendingVoters.pop();
                break;
            }
        }
    }

    function getPendingVoters() public view returns (address[] memory) {
        return pendingVoters;
    }

    // Voting
    mapping(address => bool) public hasVoted;

    event VotedEvent(uint indexed candidateId, address indexed voter);

    function vote(uint _candidateId) public electionOpen {
        if (voterStatus[msg.sender] != VoterStatus.Verified) revert NotVerified();
        if (hasVoted[msg.sender]) revert AlreadyVoted();
        if (_candidateId == 0 || _candidateId > candidatesCount) revert InvalidCandidate();
        hasVoted[msg.sender] = true;
        candidates[_candidateId].voteCount++;
        emit VotedEvent(_candidateId, msg.sender);
    }

    // Results
    bool public resultsDeclared;
    uint public winnerId;

    event ResultsDeclared(uint indexed winnerId, string winnerName, uint voteCount);

    function declareResult() public onlyAdmin electionClosed {
        if (resultsDeclared) revert ResultsAlreadyDeclared();
        if (candidatesCount == 0) revert NoCandidates();

        uint highestVotes = 0;
        uint winningId = 0;

        for (uint i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > highestVotes) {
                highestVotes = candidates[i].voteCount;
                winningId = i;
            }
        }

        resultsDeclared = true;
        winnerId = winningId;

        emit ResultsDeclared(winningId, candidates[winningId].name, highestVotes);
        _log("Result declared");
    }

    function getWinner() public view returns (string memory name, string memory photoCID, uint voteCount) {
        if (!resultsDeclared) revert ResultsNotDeclared();
        Candidate memory w = candidates[winnerId];
        return (w.name, w.photoCID, w.voteCount);
    }
}