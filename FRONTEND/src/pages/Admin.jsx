import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { VOTING_CONTRACT_ADDRESS, BUDGET_CONTRACT_ADDRESS } from "../contracts/contractConfig";
import { votingABI } from "../contracts/votingABI";
import { budgetABI } from "../contracts/BudgetABI";
import "../styles/Admin.css";

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET = import.meta.env.VITE_PINATA_SECRET;

export default function Admin() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusColor, setStatusColor] = useState("#6366f1");
  const [activeTab, setActiveTab] = useState("candidates");

  // Candidate form
  const [candidateName, setCandidateName] = useState("");
  const [candidatePhoto, setCandidatePhoto] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [addingCandidate, setAddingCandidate] = useState(false);

  // Election timer
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [settingTimer, setSettingTimer] = useState(false);

  // Pending actions (multi-sig)
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [approvingAction, setApprovingAction] = useState(false);
  const [executingAction, setExecutingAction] = useState(false);

  // Stored keys for execute steps
  const [electionTimeKey, setElectionTimeKey] = useState("");
  const [candidateKey, setCandidateKey] = useState("");
  const [pendingCandidateName, setPendingCandidateName] = useState("");
  const [pendingCandidatePhoto, setPendingCandidatePhoto] = useState("");
  const [pendingStartTime, setPendingStartTime] = useState(null);
  const [pendingEndTime, setPendingEndTime] = useState(null);

  // Voter management
  const [pendingVoters, setPendingVoters] = useState([]);
  const [approvingVoter, setApprovingVoter] = useState("");
  const [manualVoterAddress, setManualVoterAddress] = useState("");

  // Budget
  const [projectName, setProjectName] = useState("");
  const [contractorAddress, setContractorAddress] = useState("");
  const [projectStart, setProjectStart] = useState("");
  const [projectEnd, setProjectEnd] = useState("");
  const [phases, setPhases] = useState([{ name: "", budget: "" }]);
  const [creatingProject, setCreatingProject] = useState(false);
  const [budgetBalance, setBudgetBalance] = useState("0");
  const [projects, setProjects] = useState([]);
  const [proofProjectId, setProofProjectId] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofCID, setProofCID] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [releaseProjectId, setReleaseProjectId] = useState("");
  const [releasingPhase, setReleasingPhase] = useState(false);

  useEffect(() => { initWallet(); }, []);

  async function initWallet() {
    if (!window.ethereum) { navigate("/"); return; }
    try {
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await prov.listAccounts();
      if (accounts.length === 0) { navigate("/"); return; }
      const sign = prov.getSigner();
      const address = await sign.getAddress();
      const votingContract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      const admins = await votingContract.getAdmins();
      const isAdmin = admins.map(a => a.toLowerCase()).includes(address.toLowerCase());
      if (!isAdmin) {
        alert("Access denied! Only admins can view this page.");
        navigate("/");
        return;
      }
      setProvider(prov);
      setSigner(sign);
      setWalletAddress(address.slice(0, 6) + "..." + address.slice(-4));
      await loadData(prov, votingContract);
    } catch (err) {
      console.error(err);
      navigate("/");
    } finally {
      setLoading(false);
    }
  }

  async function loadData(prov, votingContract) {
    try {
      const count = await votingContract.candidatesCount();
      const list = [];
      for (let i = 1; i <= count; i++) {
        const c = await votingContract.candidates(i);
        list.push({ id: c.id.toString(), name: c.name, photoCID: c.photoCID, voteCount: c.voteCount.toString() });
      }
      setCandidates(list);
      await refreshPendingVoters(votingContract);
      const budgetContract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, prov);
      const bal = await budgetContract.getBalance();
      setBudgetBalance(ethers.utils.formatEther(bal));
      const projCount = await budgetContract.projectCount();
      const projList = [];
      for (let i = 1; i <= projCount; i++) {
        const p = await budgetContract.projects(i);
        projList.push({ id: p.id.toString(), name: p.name, contractor: p.contractor, currentPhase: p.currentPhase.toString() });
      }
      setProjects(projList);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  }

  async function refreshPendingVoters(votingContractInstance) {
    try {
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const vc = votingContractInstance || new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      const pending = await vc.getPendingVoters();
      setPendingVoters(pending);
    } catch (err) {
      console.error("Failed to refresh pending voters:", err);
    }
  }

  function showStatus(msg, color = "#6366f1") {
    setStatus(msg);
    setStatusColor(color);
    setTimeout(() => setStatus(""), 5000);
  }

  // ── MULTI-SIG: Propose add candidate
  async function proposeCandidate() {
    if (!candidateName || !candidatePhoto) { showStatus("Fill in name and photo CID.", "#ef4444"); return; }
    try {
      setAddingCandidate(true);
      showStatus("Step 1/3 — Proposing candidate...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.proposeAddCandidate(candidateName, candidatePhoto);
      await tx.wait();
      // Store for execute step
      setPendingCandidateName(candidateName);
      setPendingCandidatePhoto(candidatePhoto);
      // Compute key
      const key = ethers.utils.solidityKeccak256(
        ["string", "string", "string"],
        ["addCandidate", candidateName, candidatePhoto]
      );
      setCandidateKey(key);
      showStatus("✓ Proposed! Now Admin 2 or 3 must approve, then execute.", "#22c55e");
      setCandidateName(""); setCandidatePhoto("");
    } catch (err) {
      console.error(err); showStatus("Failed to propose candidate.", "#ef4444");
    } finally { setAddingCandidate(false); }
  }

  // ── MULTI-SIG: Approve any action by key
  async function approveAction() {
    if (!pendingActionKey) { showStatus("Enter the action key to approve.", "#ef4444"); return; }
    try {
      setApprovingAction(true);
      showStatus("Step 2/3 — Approving action...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.approveAction(pendingActionKey);
      await tx.wait();
      showStatus("✓ Approved! Timelock started. Wait 2 mins then execute.", "#22c55e");
    } catch (err) {
      console.error(err); showStatus("Failed to approve: " + (err.reason || err.message), "#ef4444");
    } finally { setApprovingAction(false); }
  }

  // ── MULTI-SIG: Execute add candidate
  async function executeCandidate() {
    if (!pendingCandidateName || !pendingCandidatePhoto) {
      showStatus("No pending candidate to execute.", "#ef4444"); return;
    }
    try {
      setExecutingAction(true);
      showStatus("Step 3/3 — Executing...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.executeAddCandidate(pendingCandidateName, pendingCandidatePhoto);
      await tx.wait();
      showStatus("✓ Candidate added to blockchain!", "#22c55e");
      setPendingCandidateName(""); setPendingCandidatePhoto(""); setCandidateKey("");
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const vc = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      await loadData(prov, vc);
    } catch (err) {
      console.error(err); showStatus("Failed to execute: " + (err.reason || err.message), "#ef4444");
    } finally { setExecutingAction(false); }
  }

  // ── MULTI-SIG: Propose election time
  async function proposeElectionTimer() {
    if (!startTime || !endTime) { showStatus("Set both times.", "#ef4444"); return; }
    const start = Math.floor(new Date(startTime).getTime() / 1000);
    const end = Math.floor(new Date(endTime).getTime() / 1000);
    if (end <= start) { showStatus("End must be after start.", "#ef4444"); return; }
    try {
      setSettingTimer(true);
      showStatus("Step 1/3 — Proposing election time...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.proposeSetElectionTime(start, end);
      await tx.wait();
      setPendingStartTime(start);
      setPendingEndTime(end);
      const key = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256"],
        ["setElectionTime", start, end]
      );
      setElectionTimeKey(key);
      showStatus("✓ Proposed! Now Admin 2 or 3 must approve, then execute.", "#22c55e");
    } catch (err) {
      console.error(err); showStatus("Failed to propose.", "#ef4444");
    } finally { setSettingTimer(false); }
  }

  // ── MULTI-SIG: Execute election time
  async function executeElectionTimer() {
    if (!pendingStartTime || !pendingEndTime) {
      showStatus("No pending election time to execute.", "#ef4444"); return;
    }
    try {
      setExecutingAction(true);
      showStatus("Step 3/3 — Executing election time...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.executeSetElectionTime(pendingStartTime, pendingEndTime);
      await tx.wait();
      showStatus("✓ Election time set on blockchain!", "#22c55e");
      setStartTime(""); setEndTime("");
      setPendingStartTime(null); setPendingEndTime(null); setElectionTimeKey("");
    } catch (err) {
      console.error(err); showStatus("Failed to execute: " + (err.reason || err.message), "#ef4444");
    } finally { setExecutingAction(false); }
  }

  async function approveVoter(address) {
    try {
      setApprovingVoter(address);
      showStatus("Approving voter...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.approveVoter(address);
      await tx.wait();
      showStatus("Voter approved!");
      await refreshPendingVoters();
    } catch (err) {
      console.error(err); showStatus("Failed to approve voter.", "#ef4444");
    } finally { setApprovingVoter(""); }
  }

  async function rejectVoter(address) {
    try {
      showStatus("Rejecting voter...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.rejectVoter(address);
      await tx.wait();
      showStatus("Voter rejected.");
      await refreshPendingVoters();
    } catch (err) {
      console.error(err); showStatus("Failed to reject voter.", "#ef4444");
    }
  }

  async function approveManualVoter() {
    if (!manualVoterAddress || !ethers.utils.isAddress(manualVoterAddress)) {
      showStatus("Enter a valid address.", "#ef4444"); return;
    }
    await approveVoter(manualVoterAddress);
    setManualVoterAddress("");
  }

  async function declareResult() {
    try {
      showStatus("Declaring result...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.declareResult();
      await tx.wait();
      showStatus("Results declared!");
    } catch (err) {
      console.error(err); showStatus("Failed: " + err.reason, "#ef4444");
    }
  }

  async function uploadProofToIPFS() {
    if (!proofFile) { showStatus("Select a file first.", "#ef4444"); return; }
    try {
      setUploadingProof(true);
      showStatus("Uploading to IPFS...", "#f59e0b");
      const formData = new FormData();
      formData.append("file", proofFile);
      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { pinata_api_key: PINATA_API_KEY, pinata_secret_api_key: PINATA_SECRET },
        body: formData,
      });
      const data = await res.json();
      if (data.IpfsHash) {
        setProofCID(data.IpfsHash);
        showStatus("Uploaded! CID: " + data.IpfsHash.slice(0, 20) + "...");
      } else { showStatus("Upload failed.", "#ef4444"); }
    } catch (err) {
      console.error(err); showStatus("Upload failed.", "#ef4444");
    } finally { setUploadingProof(false); }
  }

  async function submitPhaseProof() {
    if (!proofProjectId || !proofCID) { showStatus("Fill project ID and CID.", "#ef4444"); return; }
    try {
      setSubmittingProof(true);
      showStatus("Submitting proof...", "#f59e0b");
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, signer);
      const tx = await contract.submitPhaseProof(proofProjectId, proofCID);
      await tx.wait();
      showStatus("Proof submitted!");
      setProofProjectId(""); setProofCID(""); setProofFile(null);
    } catch (err) {
      console.error(err); showStatus("Failed to submit proof.", "#ef4444");
    } finally { setSubmittingProof(false); }
  }

  async function releasePhase() {
    if (!releaseProjectId) { showStatus("Enter project ID.", "#ef4444"); return; }
    try {
      setReleasingPhase(true);
      showStatus("Releasing phase...", "#f59e0b");
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, signer);
      const tx = await contract.releasePhase(releaseProjectId);
      await tx.wait();
      showStatus("Phase released!");
      setReleaseProjectId("");
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const vc = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      await loadData(prov, vc);
    } catch (err) {
      console.error(err); showStatus("Failed: " + err.reason, "#ef4444");
    } finally { setReleasingPhase(false); }
  }

  async function createProject() {
    if (!projectName || !contractorAddress || !projectStart || !projectEnd) {
      showStatus("Fill all project fields.", "#ef4444"); return;
    }
    const phaseNames = phases.map(p => p.name).filter(n => n);
    const phaseBudgets = phases.map(p => ethers.utils.parseEther(p.budget || "0"));
    const totalBudget = phaseBudgets.reduce((a, b) => a.add(b), ethers.BigNumber.from(0));
    const start = Math.floor(new Date(projectStart).getTime() / 1000);
    const end = Math.floor(new Date(projectEnd).getTime() / 1000);
    try {
      setCreatingProject(true);
      showStatus("Creating project...", "#f59e0b");
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, signer);
      const tx = await contract.createProject(projectName, contractorAddress, start, end, phaseNames, phaseBudgets, { value: totalBudget });
      await tx.wait();
      showStatus("Project created!");
      setProjectName(""); setContractorAddress(""); setProjectStart(""); setProjectEnd("");
      setPhases([{ name: "", budget: "" }]);
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const vc = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      await loadData(prov, vc);
    } catch (err) {
      console.error(err); showStatus("Failed to create project.", "#ef4444");
    } finally { setCreatingProject(false); }
  }

  if (loading) return (
    <div className="admin-loading">
      <div className="loading-spinner" />
      <p>Verifying admin access...</p>
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-brand">
          <div className="logo-mark" />
          <span>CivicChain</span>
          <span className="admin-badge">Admin</span>
        </div>
        <div className="wallet-pill">
          <span className="dot" />
          {walletAddress}
        </div>
      </div>

      {status && (
        <div className="global-status" style={{ color: statusColor, borderColor: statusColor + "33", background: statusColor + "11" }}>
          {status}
        </div>
      )}

      {/* Multi-sig approve panel — always visible */}
      <div className="multisig-bar">
        <span className="multisig-label">Multi-sig Approve</span>
        <input
          type="text"
          placeholder="Paste action key (bytes32) to approve as Admin 2 or 3"
          value={pendingActionKey}
          onChange={e => setPendingActionKey(e.target.value)}
          className="multisig-input"
        />
        <button className="multisig-btn" onClick={approveAction} disabled={approvingAction}>
          {approvingAction ? "Approving..." : "Approve"}
        </button>
      </div>

      <div className="admin-tabs">
        {["candidates", "timer", "voters", "budget"].map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab === "candidates" && `Candidates (${candidates.length})`}
            {tab === "timer" && "Election Timer"}
            {tab === "voters" && `Voters (${pendingVoters.length} pending)`}
            {tab === "budget" && `Budget (${parseFloat(budgetBalance).toFixed(3)} ETH)`}
          </button>
        ))}
      </div>

      <div className="admin-content">

        {activeTab === "candidates" && (
          <div className="admin-card">
            <h2>Add Candidate</h2>
            <p className="card-desc">Multi-sig required — propose → approve → execute after 2 min timelock.</p>

            <div className="form-group">
              <label>Candidate Name</label>
              <input type="text" placeholder="e.g. Alice Johnson" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="admin-input" />
            </div>
            <div className="form-group">
              <label>Photo CID or URL</label>
              <input type="text" placeholder="Qm... or https://..." value={candidatePhoto} onChange={e => setCandidatePhoto(e.target.value)} className="admin-input" />
            </div>

            <div className="multisig-steps">
              <button className="admin-btn step-btn" onClick={proposeCandidate} disabled={addingCandidate}>
                {addingCandidate ? "Proposing..." : "1. Propose"}
              </button>
              <span className="step-arrow">→</span>
              <span className="step-note">Admin 2/3 approves via bar above</span>
              <span className="step-arrow">→</span>
              <button className="admin-btn step-btn execute-btn" onClick={executeCandidate} disabled={executingAction}>
                {executingAction ? "Executing..." : "3. Execute"}
              </button>
            </div>

            {candidateKey && (
              <div className="key-display">
                <span className="key-label">Action Key (share with Admin 2/3):</span>
                <code className="key-value">{candidateKey}</code>
              </div>
            )}

            {candidates.length > 0 && (
              <div className="candidates-list">
                <h3>Current Candidates ({candidates.length})</h3>
                {candidates.map(c => (
                  <div key={c.id} className="candidate-item">
                    <img
                      src={c.photoCID.startsWith("http") ? c.photoCID : `https://gateway.pinata.cloud/ipfs/${c.photoCID}`}
                      alt={c.name}
                      onError={e => e.target.src = `https://ui-avatars.com/api/?name=${c.name}&background=6366f1&color=fff`}
                    />
                    <span>{c.name}</span>
                    <span className="vote-badge">{c.voteCount} votes</span>
                  </div>
                ))}
              </div>
            )}

            <div className="declare-section">
              <h3>Declare Results</h3>
              <p className="card-desc">Only after election ends. This is permanent.</p>
              <button className="admin-btn danger-btn" onClick={declareResult}>Declare Results</button>
            </div>
          </div>
        )}

        {activeTab === "timer" && (
          <div className="admin-card">
            <h2>Set Election Timer</h2>
            <p className="card-desc">Multi-sig required — propose → approve → execute after 2 min timelock.</p>
            <div className="form-group">
              <label>Voting Start</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="admin-input" />
            </div>
            <div className="form-group">
              <label>Voting End</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="admin-input" />
            </div>
            <div className="multisig-steps">
              <button className="admin-btn step-btn" onClick={proposeElectionTimer} disabled={settingTimer}>
                {settingTimer ? "Proposing..." : "1. Propose"}
              </button>
              <span className="step-arrow">→</span>
              <span className="step-note">Admin 2/3 approves via bar above</span>
              <span className="step-arrow">→</span>
              <button className="admin-btn step-btn execute-btn" onClick={executeElectionTimer} disabled={executingAction}>
                {executingAction ? "Executing..." : "3. Execute"}
              </button>
            </div>
            {electionTimeKey && (
              <div className="key-display">
                <span className="key-label">Action Key (share with Admin 2/3):</span>
                <code className="key-value">{electionTimeKey}</code>
              </div>
            )}
          </div>
        )}

        {activeTab === "voters" && (
          <div className="admin-card">
            <h2>Voter Management</h2>
            <p className="card-desc">Approve or reject voter registration requests</p>
            <div className="form-group">
              <label>Manually Approve Voter</label>
              <input type="text" placeholder="0x... wallet address" value={manualVoterAddress} onChange={e => setManualVoterAddress(e.target.value)} className="admin-input" />
              <button className="admin-btn" onClick={approveManualVoter} style={{ marginTop: "0.5rem" }}>Approve Voter</button>
            </div>
            <div className="pending-section">
              <h3>Pending Requests ({pendingVoters.length})</h3>
              {pendingVoters.length === 0 ? (
                <p className="empty-msg">No pending voter requests</p>
              ) : (
                pendingVoters.map((voter, i) => (
                  <div key={i} className="voter-item">
                    <span className="voter-addr">{voter.slice(0, 10)}...{voter.slice(-6)}</span>
                    <div className="voter-actions">
                      <button onClick={() => approveVoter(voter)} disabled={approvingVoter === voter} className="approve-btn">
                        {approvingVoter === voter ? "..." : "Approve"}
                      </button>
                      <button onClick={() => rejectVoter(voter)} className="reject-btn">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "budget" && (
          <div>
            <div className="admin-card" style={{ marginBottom: "1rem" }}>
              <h2>Create Project</h2>
              <p className="card-desc">ETH is locked per phase and released only after proof verification.</p>
              <div className="form-group">
                <label>Project Name</label>
                <input type="text" placeholder="e.g. Road Construction Phase 1" value={projectName} onChange={e => setProjectName(e.target.value)} className="admin-input" />
              </div>
              <div className="form-group">
                <label>Contractor Address</label>
                <input type="text" placeholder="0x..." value={contractorAddress} onChange={e => setContractorAddress(e.target.value)} className="admin-input" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label>Project Start</label>
                  <input type="datetime-local" value={projectStart} onChange={e => setProjectStart(e.target.value)} className="admin-input" />
                </div>
                <div className="form-group">
                  <label>Project End</label>
                  <input type="datetime-local" value={projectEnd} onChange={e => setProjectEnd(e.target.value)} className="admin-input" />
                </div>
              </div>
              <div className="form-group">
                <label>Phases</label>
                {phases.map((phase, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input type="text" placeholder={`Phase ${i + 1} name`} value={phase.name} onChange={e => { const p = [...phases]; p[i].name = e.target.value; setPhases(p); }} className="admin-input" />
                    <input type="number" placeholder="Budget (ETH)" value={phase.budget} onChange={e => { const p = [...phases]; p[i].budget = e.target.value; setPhases(p); }} className="admin-input" />
                    {phases.length > 1 && (
                      <button onClick={() => setPhases(phases.filter((_, idx) => idx !== i))} className="remove-phase-btn">×</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setPhases([...phases, { name: "", budget: "" }])} className="add-phase-btn">+ Add Phase</button>
              </div>
              <button className="admin-btn" onClick={createProject} disabled={creatingProject}>
                {creatingProject ? "Creating..." : "Create Project"}
              </button>
            </div>

            <div className="admin-card" style={{ marginBottom: "1rem" }}>
              <h2>Submit Phase Proof</h2>
              <p className="card-desc">Upload IPFS evidence before phase funds can be released</p>
              <div className="form-group">
                <label>Project ID</label>
                <input type="number" placeholder="e.g. 1" value={proofProjectId} onChange={e => setProofProjectId(e.target.value)} className="admin-input" />
              </div>
              <div className="form-group">
                <label>Upload Evidence to IPFS</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setProofFile(e.target.files[0])} className="admin-input" />
                <button className="admin-btn" onClick={uploadProofToIPFS} disabled={uploadingProof || !proofFile} style={{ marginTop: "0.5rem" }}>
                  {uploadingProof ? "Uploading..." : "Upload to IPFS"}
                </button>
              </div>
              {proofCID && (
                <div className="cid-display">
                  CID: <a href={`https://gateway.pinata.cloud/ipfs/${proofCID}`} target="_blank" rel="noreferrer">{proofCID.slice(0, 25)}...</a>
                </div>
              )}
              <div className="form-group">
                <label>IPFS CID</label>
                <input type="text" placeholder="Qm..." value={proofCID} onChange={e => setProofCID(e.target.value)} className="admin-input" />
              </div>
              <button className="admin-btn" onClick={submitPhaseProof} disabled={submittingProof}>
                {submittingProof ? "Submitting..." : "Submit Phase Proof"}
              </button>
            </div>

            <div className="admin-card">
              <h2>Release Phase Funds</h2>
              <p className="card-desc">Release funds after proof is verified</p>
              <div className="balance-pill">Contract Balance: <strong>{parseFloat(budgetBalance).toFixed(4)} ETH</strong></div>
              {projects.length > 0 && (
                <div className="candidates-list">
                  <h3>Active Projects</h3>
                  {projects.map(p => (
                    <div key={p.id} className="candidate-item">
                      <span>{p.name}</span>
                      <span className="vote-badge">Phase {p.currentPhase}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-group" style={{ marginTop: "1rem" }}>
                <label>Project ID to Release</label>
                <input type="number" placeholder="e.g. 1" value={releaseProjectId} onChange={e => setReleaseProjectId(e.target.value)} className="admin-input" />
              </div>
              <button className="admin-btn" onClick={releasePhase} disabled={releasingPhase}>
                {releasingPhase ? "Releasing..." : "Release Phase Funds"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}