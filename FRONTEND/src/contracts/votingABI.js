export const votingABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_admin2", "type": "address" },
      { "internalType": "address", "name": "_admin3", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  { "inputs": [], "name": "ActionAlreadyQueued", "type": "error" },
  { "inputs": [], "name": "ActionNotQueued", "type": "error" },
  { "inputs": [], "name": "AlreadyApproved", "type": "error" },
  { "inputs": [], "name": "AlreadyRegistered", "type": "error" },
  { "inputs": [], "name": "AlreadyVoted", "type": "error" },
  { "inputs": [], "name": "CandidatesLocked", "type": "error" },
  { "inputs": [], "name": "ElectionNotClosed", "type": "error" },
  { "inputs": [], "name": "ElectionNotOpen", "type": "error" },
  { "inputs": [], "name": "InvalidCandidate", "type": "error" },
  { "inputs": [], "name": "InvalidTime", "type": "error" },
  { "inputs": [], "name": "NoCandidates", "type": "error" },
  { "inputs": [], "name": "NotAdmin", "type": "error" },
  { "inputs": [], "name": "NotAnAdmin", "type": "error" },
  { "inputs": [], "name": "NotEnoughApprovals", "type": "error" },
  { "inputs": [], "name": "NotPending", "type": "error" },
  { "inputs": [], "name": "NotVerified", "type": "error" },
  { "inputs": [], "name": "ResultsAlreadyDeclared", "type": "error" },
  { "inputs": [], "name": "ResultsNotDeclared", "type": "error" },
  { "inputs": [], "name": "TimelockNotExpired", "type": "error" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "actionKey", "type": "bytes32" },
      { "indexed": false, "internalType": "address", "name": "approvedBy", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "approvalCount", "type": "uint256" }
    ],
    "name": "ActionApproved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "actionKey", "type": "bytes32" },
      { "indexed": false, "internalType": "string", "name": "description", "type": "string" }
    ],
    "name": "ActionCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "actionKey", "type": "bytes32" },
      { "indexed": false, "internalType": "string", "name": "description", "type": "string" }
    ],
    "name": "ActionExecuted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "actionKey", "type": "bytes32" },
      { "indexed": false, "internalType": "string", "name": "description", "type": "string" },
      { "indexed": false, "internalType": "address", "name": "proposedBy", "type": "address" }
    ],
    "name": "ActionProposed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "actor", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "action", "type": "string" }
    ],
    "name": "AuditLogAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "photoCID", "type": "string" }
    ],
    "name": "CandidateAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256" }
    ],
    "name": "ElectionTimeSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "winnerId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "winnerName", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "voteCount", "type": "uint256" }
    ],
    "name": "ResultsDeclared",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "candidateId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "voter", "type": "address" }
    ],
    "name": "VotedEvent",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "address", "name": "voter", "type": "address" }],
    "name": "VoterApproved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "address", "name": "voter", "type": "address" }],
    "name": "VoterRejected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "voter", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "idProofCID", "type": "string" }
    ],
    "name": "VoterRequested",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "REQUIRED_APPROVALS",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "TIMELOCK_DELAY",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "admins",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "key", "type": "bytes32" }],
    "name": "approveAction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_voter", "type": "address" }],
    "name": "approveVoter",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "auditLogs",
    "outputs": [
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "internalType": "address", "name": "actor", "type": "address" },
      { "internalType": "string", "name": "action", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "key", "type": "bytes32" },
      { "internalType": "string", "name": "description", "type": "string" }
    ],
    "name": "cancelAction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "candidates",
    "outputs": [
      { "internalType": "uint32", "name": "id", "type": "uint32" },
      { "internalType": "uint32", "name": "voteCount", "type": "uint32" },
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "string", "name": "photoCID", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "candidatesCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "declareResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "endTime",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string", "name": "_photoCID", "type": "string" }
    ],
    "name": "executeAddCandidate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_startTime", "type": "uint256" },
      { "internalType": "uint256", "name": "_endTime", "type": "uint256" }
    ],
    "name": "executeSetElectionTime",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAdmins",
    "outputs": [{ "internalType": "address[3]", "name": "", "type": "address[3]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "key", "type": "bytes32" }],
    "name": "getApprovalCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAuditLogs",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
          { "internalType": "address", "name": "actor", "type": "address" },
          { "internalType": "string", "name": "action", "type": "string" }
        ],
        "internalType": "struct Voting.AuditLog[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPendingVoters",
    "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "key", "type": "bytes32" }],
    "name": "getTimeRemaining",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getWinner",
    "outputs": [
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "string", "name": "photoCID", "type": "string" },
      { "internalType": "uint256", "name": "voteCount", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "key", "type": "bytes32" },
      { "internalType": "address", "name": "_admin", "type": "address" }
    ],
    "name": "hasApproved",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "hasVoted",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "name": "pendingActions",
    "outputs": [
      { "internalType": "uint256", "name": "approvalCount", "type": "uint256" },
      { "internalType": "uint256", "name": "executeAfter", "type": "uint256" },
      { "internalType": "bool", "name": "executed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "pendingVoters",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string", "name": "_photoCID", "type": "string" }
    ],
    "name": "proposeAddCandidate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_startTime", "type": "uint256" },
      { "internalType": "uint256", "name": "_endTime", "type": "uint256" }
    ],
    "name": "proposeSetElectionTime",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_voter", "type": "address" }],
    "name": "rejectVoter",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "_idProofCID", "type": "string" }],
    "name": "requestVoterRegistration",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "resultsDeclared",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "startTime",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_candidateId", "type": "uint256" }],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "voterIdCID",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "voterStatus",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "winnerId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];