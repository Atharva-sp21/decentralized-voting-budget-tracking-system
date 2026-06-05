const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

function getElectionTimeKey(start, end) {
  return ethers.solidityPackedKeccak256(
    ["string", "uint256", "uint256"],
    ["setElectionTime", start, end]
  );
}

function getCandidateKey(name, photoCID) {
  return ethers.solidityPackedKeccak256(
    ["string", "string", "string"],
    ["addCandidate", name, photoCID]
  );
}

describe("Voting Contract", function () {
  let voting;
  let admin1, admin2, admin3, voter1, voter2, voter3;

  beforeEach(async function () {
    [admin1, admin2, admin3, voter1, voter2, voter3] = await ethers.getSigners();
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy(admin2.address, admin3.address);
  });

  // Test 1 — Deployment
  it("should deploy with 3 admins correctly", async function () {
    const admins = await voting.getAdmins();
    expect(admins[0]).to.equal(admin1.address);
    expect(admins[1]).to.equal(admin2.address);
    expect(admins[2]).to.equal(admin3.address);
  });

  // Test 2 — Non-admin cannot propose actions
  it("should reject non-admin proposing election time", async function () {
    const start = (await time.latest()) + 1000;
    const end = start + 5000;
    await expect(
      voting.connect(voter1).proposeSetElectionTime(start, end)
    ).to.be.revertedWithCustomError(voting, "NotAdmin");
  });

  // Test 3 — Multi-sig requires 2 approvals
  it("should not execute action with only 1 approval", async function () {
    const start = (await time.latest()) + 1000;
    const end = start + 5000;
    await voting.connect(admin1).proposeSetElectionTime(start, end);
    await expect(
      voting.connect(admin1).executeSetElectionTime(start, end)
    ).to.be.revertedWithCustomError(voting, "NotEnoughApprovals");
  });

  // Test 4 — Multi-sig + timelock full flow
  it("should execute election time after 2 approvals and timelock", async function () {
    const start = (await time.latest()) + 10000;
    const end = start + 5000;

    await voting.connect(admin1).proposeSetElectionTime(start, end);
    await voting.connect(admin2).approveAction(getElectionTimeKey(start, end));

    await time.increase(130);

    await voting.connect(admin1).executeSetElectionTime(start, end);
    expect(await voting.startTime()).to.equal(start);
    expect(await voting.endTime()).to.equal(end);
  });

  // Test 5 — Voter registration flow
  it("should allow voter to register and admin to approve", async function () {
    await voting.connect(voter1).requestVoterRegistration("QmTestCID");
    expect(await voting.voterStatus(voter1.address)).to.equal(1); // Pending

    await voting.connect(admin1).approveVoter(voter1.address);
    expect(await voting.voterStatus(voter1.address)).to.equal(2); // Verified
  });

  // Test 6 — Approved voter removed from pending list
  it("should remove voter from pending list after approval", async function () {
    await voting.connect(voter1).requestVoterRegistration("QmTestCID");
    await voting.connect(admin1).approveVoter(voter1.address);
    const pending = await voting.getPendingVoters();
    expect(pending.length).to.equal(0);
  });

  // Test 7 — Voting works correctly
  it("should allow verified voter to cast vote", async function () {
    const start = (await time.latest()) + 10000;
    const end = start + 5000;

    await voting.connect(admin1).proposeSetElectionTime(start, end);
    await voting.connect(admin2).approveAction(getElectionTimeKey(start, end));
    await time.increase(130);
    await voting.connect(admin1).executeSetElectionTime(start, end);

    await voting.connect(admin1).proposeAddCandidate("Alice", "QmAliceCID");
    await voting.connect(admin2).approveAction(getCandidateKey("Alice", "QmAliceCID"));
    await time.increase(130);
    await voting.connect(admin1).executeAddCandidate("Alice", "QmAliceCID");

    await voting.connect(voter1).requestVoterRegistration("QmVoterCID");
    await voting.connect(admin1).approveVoter(voter1.address);

    await time.increaseTo(start + 1);
    await voting.connect(voter1).vote(1);

    const candidate = await voting.candidates(1);
    expect(candidate.voteCount).to.equal(1);
  });

  // Test 8 — Cannot vote twice
  it("should prevent double voting", async function () {
    const start = (await time.latest()) + 10000;
    const end = start + 5000;

    await voting.connect(admin1).proposeSetElectionTime(start, end);
    await voting.connect(admin2).approveAction(getElectionTimeKey(start, end));
    await time.increase(130);
    await voting.connect(admin1).executeSetElectionTime(start, end);

    await voting.connect(admin1).proposeAddCandidate("Alice", "QmAliceCID");
    await voting.connect(admin2).approveAction(getCandidateKey("Alice", "QmAliceCID"));
    await time.increase(130);
    await voting.connect(admin1).executeAddCandidate("Alice", "QmAliceCID");

    await voting.connect(voter1).requestVoterRegistration("QmVoterCID");
    await voting.connect(admin1).approveVoter(voter1.address);

    await time.increaseTo(start + 1);
    await voting.connect(voter1).vote(1);

    await expect(
      voting.connect(voter1).vote(1)
    ).to.be.revertedWithCustomError(voting, "AlreadyVoted");
  });

  // Test 9 — Declare result correctly
  it("should declare correct winner", async function () {
    const start = (await time.latest()) + 10000;
    const end = start + 5000;

    await voting.connect(admin1).proposeSetElectionTime(start, end);
    await voting.connect(admin2).approveAction(getElectionTimeKey(start, end));
    await time.increase(130);
    await voting.connect(admin1).executeSetElectionTime(start, end);

    await voting.connect(admin1).proposeAddCandidate("Alice", "QmAliceCID");
    await voting.connect(admin2).approveAction(getCandidateKey("Alice", "QmAliceCID"));
    await time.increase(130);
    await voting.connect(admin1).executeAddCandidate("Alice", "QmAliceCID");

    await voting.connect(admin1).proposeAddCandidate("Bob", "QmBobCID");
    await voting.connect(admin2).approveAction(getCandidateKey("Bob", "QmBobCID"));
    await time.increase(130);
    await voting.connect(admin1).executeAddCandidate("Bob", "QmBobCID");

    await voting.connect(voter1).requestVoterRegistration("QmV1");
    await voting.connect(voter2).requestVoterRegistration("QmV2");
    await voting.connect(admin1).approveVoter(voter1.address);
    await voting.connect(admin1).approveVoter(voter2.address);

    await time.increaseTo(start + 1);
    await voting.connect(voter1).vote(1);
    await voting.connect(voter2).vote(1);

    await time.increaseTo(end + 1);
    await voting.connect(admin1).declareResult();

    const winner = await voting.getWinner();
    expect(winner.name).to.equal("Alice");
    expect(winner.voteCount).to.equal(2);
  });

  // Test 10 — Audit logs recorded correctly
  it("should record audit logs for key actions", async function () {
    await voting.connect(voter1).requestVoterRegistration("QmTestCID");
    await voting.connect(admin1).approveVoter(voter1.address);

    const logs = await voting.getAuditLogs();
    expect(logs.length).to.be.greaterThan(0);
    expect(logs[logs.length - 1].action).to.equal("Voter approved");
    expect(logs[logs.length - 1].actor).to.equal(admin1.address);
  });
});