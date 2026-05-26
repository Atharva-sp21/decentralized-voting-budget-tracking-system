// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

contract Budget {

    //  Roles 

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized. Only owner can do this.");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    //  Reentrancy Guard 

    bool private locked;

    modifier noReentrant() {
        require(!locked, "Reentrant call.");
        locked = true;
        _;
        locked = false;
    }

    //  Project & Phase Structs 

    enum PhaseStatus { Pending, ProofSubmitted, Released }

    struct Phase {
        string name;
        uint budget;          // Amount (in wei) allocated to this phase
        string evidenceCID;   // IPFS CID uploaded by contractor (bills, receipts, photos)
        PhaseStatus status;
    }

    struct Project {
        uint id;
        string name;
        address payable contractor;
        uint startTime;
        uint endTime;
        uint currentPhase;
        bool exists;
        Phase[] phases;
    }

    mapping(uint => Project) public projects;
    uint public projectCount;

    //  Events 

    event FundsReceived(address from, uint amount);
    event ProjectCreated(uint indexed projectId, string name, address contractor);
    event AddTimeline(uint indexed projectId, uint start, uint end);  // Fixed: param types added
    event PhaseProofSubmitted(uint indexed projectId, uint phaseIndex, string evidenceCID);
    event PhaseReleased(uint indexed projectId, uint phaseIndex, uint amount, address contractor);

    //  Funding 

    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }

    //  Project Management 

    function createProject(
        string memory _name,
        address payable _contractor,
        uint _startTime,
        uint _endTime,
        string[] memory _phaseNames,
        uint[] memory _phaseBudgets
    ) public payable onlyOwner {
        require(_phaseNames.length == _phaseBudgets.length, "Phase names and budgets must match.");
        require(_phaseNames.length > 0, "Must have at least one phase.");
        require(_startTime < _endTime, "Start must be before end.");

        uint total = 0;
        for (uint i = 0; i < _phaseBudgets.length; i++) {
            total += _phaseBudgets[i];
        }
        require(msg.value == total, "ETH sent must equal total phase budgets.");

        projectCount++;
        Project storage p = projects[projectCount];
        p.id = projectCount;
        p.name = _name;
        p.contractor = _contractor;
        p.startTime = _startTime;
        p.endTime = _endTime;
        p.currentPhase = 0;
        p.exists = true;

        for (uint i = 0; i < _phaseNames.length; i++) {
            p.phases.push(Phase({
                name: _phaseNames[i],
                budget: _phaseBudgets[i],
                evidenceCID: "",
                status: PhaseStatus.Pending
            }));
        }

        emit ProjectCreated(projectCount, _name, _contractor);
        emit AddTimeline(projectCount, _startTime, _endTime);
    }

    //  Phase-Gated Fund Release

    function submitPhaseProof(uint _projectId, string memory _evidenceCID) public {
        Project storage p = projects[_projectId];
        require(p.exists, "Project does not exist.");
        require(msg.sender == p.contractor, "Only the contractor can submit proof.");
        require(p.currentPhase < p.phases.length, "All phases already completed.");

        Phase storage phase = p.phases[p.currentPhase];
        require(phase.status == PhaseStatus.Pending, "Proof already submitted for this phase.");

        phase.evidenceCID = _evidenceCID;
        phase.status = PhaseStatus.ProofSubmitted;

        emit PhaseProofSubmitted(_projectId, p.currentPhase, _evidenceCID);
    }

    function releasePhase(uint _projectId) public onlyOwner noReentrant {
        Project storage p = projects[_projectId];
        require(p.exists, "Project does not exist.");
        require(p.currentPhase < p.phases.length, "All phases already completed.");

        Phase storage phase = p.phases[p.currentPhase];
        require(phase.status == PhaseStatus.ProofSubmitted, "No proof submitted for this phase yet.");
        require(address(this).balance >= phase.budget, "Insufficient contract balance.");

        phase.status = PhaseStatus.Released;
        uint amount = phase.budget;
        uint phaseIndex = p.currentPhase;
        p.currentPhase++;

        (bool success, ) = p.contractor.call{value: amount}("");
        require(success, "Transfer failed.");

        emit PhaseReleased(_projectId, phaseIndex, amount, p.contractor);
    }

    // ─── Public Getter (for the citizen budget tracking page) ─────────────────

    function getPhases(uint _projectId) public view returns (
        string[] memory names,
        uint[] memory budgets,
        string[] memory evidenceCIDs,
        PhaseStatus[] memory statuses
    ) {
        Project storage p = projects[_projectId];
        require(p.exists, "Project does not exist.");

        uint len = p.phases.length;
        names       = new string[](len);
        budgets     = new uint[](len);
        evidenceCIDs = new string[](len);
        statuses    = new PhaseStatus[](len);

        for (uint i = 0; i < len; i++) {
            names[i]        = p.phases[i].name;
            budgets[i]      = p.phases[i].budget;
            evidenceCIDs[i] = p.phases[i].evidenceCID;
            statuses[i]     = p.phases[i].status;
        }
    }
}