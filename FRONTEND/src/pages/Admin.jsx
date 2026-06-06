import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { VOTING_CONTRACT_ADDRESS, BUDGET_CONTRACT_ADDRESS } from "../contracts/contractConfig";
import { votingABI } from "../contracts/votingABI";
import { budgetABI } from "../contracts/BudgetABI";
import "../styles/Admin.css";

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET = import.meta.env.VITE_PINATA_SECRET;

const TABS = [
  { id: "candidates", label: "Candidates", icon: "👤" },
  { id: "timer",      label: "Election Timer", icon: "⏱" },
  { id: "voters",     label: "Voters", icon: "✓" },
  { id: "budget",     label: "Budget", icon: "◎" },
];

export default function Admin() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("info"); // info | success | error | warn
  const [activeTab, setActiveTab] = useState("candidates");

  // Candidate
  const [candidateName, setCandidateName] = useState("");
  const [candidatePhoto, setCandidatePhoto] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [candidateKey, setCandidateKey] = useState("");
  const [pendingCandidateName, setPendingCandidateName] = useState("");
  const [pendingCandidatePhoto, setPendingCandidatePhoto] = useState("");
  const [executingAction, setExecutingAction] = useState(false);

  // Timer
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [settingTimer, setSettingTimer] = useState(false);
  const [electionTimeKey, setElectionTimeKey] = useState("");
  const [pendingStartTime, setPendingStartTime] = useState(null);
  const [pendingEndTime, setPendingEndTime] = useState(null);

  // Multi-sig approve (per-tab)
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [approvingAction, setApprovingAction] = useState(false);

  // Voters
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

  useEffect(() => {
    initWallet();
    if (window.ethereum) {
      const handler = () => { window.location.href = "/"; };
      window.ethereum.on("accountsChanged", handler);
      window.ethereum.on("chainChanged", handler);
      return () => {
        window.ethereum.removeListener("accountsChanged", handler);
        window.ethereum.removeListener("chainChanged", handler);
      };
    }
  }, []);

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
      if (!isAdmin) { alert("Access denied — admins only."); navigate("/"); return; }
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
    } catch (err) { console.error("Load error:", err); }
  }

  async function refreshPendingVoters(vc) {
    try {
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const contract = vc || new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      const pending = await contract.getPendingVoters();
      setPendingVoters(pending);
    } catch (err) { console.error(err); }
  }

  function showStatus(msg, type = "info") {
    setStatus(msg); setStatusType(type);
    setTimeout(() => setStatus(""), 5000);
  }

  async function proposeCandidate() {
    if (!candidateName || !candidatePhoto) { showStatus("Fill name and photo CID.", "error"); return; }
    try {
      setAddingCandidate(true);
      showStatus("Step 1/3 — Proposing candidate...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.proposeAddCandidate(candidateName, candidatePhoto);
      await tx.wait();
      setPendingCandidateName(candidateName);
      setPendingCandidatePhoto(candidatePhoto);
      const key = ethers.utils.solidityKeccak256(["string","string","string"], ["addCandidate", candidateName, candidatePhoto]);
      setCandidateKey(key);
      showStatus("Proposed! Share the key with Admin 2 or 3 to approve.", "success");
      setCandidateName(""); setCandidatePhoto("");
    } catch (err) { console.error(err); showStatus("Proposal failed.", "error"); }
    finally { setAddingCandidate(false); }
  }

  async function approveAction() {
    if (!pendingActionKey) { showStatus("Paste the action key first.", "error"); return; }
    try {
      setApprovingAction(true);
      showStatus("Step 2/3 — Approving...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.approveAction(pendingActionKey);
      await tx.wait();
      showStatus("Approved! Wait 2 min timelock, then execute.", "success");
    } catch (err) { showStatus("Approval failed: " + (err.reason || err.message), "error"); }
    finally { setApprovingAction(false); }
  }

  async function executeCandidate() {
    if (!pendingCandidateName || !pendingCandidatePhoto) { showStatus("No pending candidate.", "error"); return; }
    try {
      setExecutingAction(true);
      showStatus("Step 3/3 — Executing...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.executeAddCandidate(pendingCandidateName, pendingCandidatePhoto);
      await tx.wait();
      showStatus("Candidate added!", "success");
      setPendingCandidateName(""); setPendingCandidatePhoto(""); setCandidateKey("");
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      await loadData(prov, new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov));
    } catch (err) { showStatus("Execute failed: " + (err.reason || err.message), "error"); }
    finally { setExecutingAction(false); }
  }

  async function proposeElectionTimer() {
    if (!startTime || !endTime) { showStatus("Set both times.", "error"); return; }
    const start = Math.floor(new Date(startTime).getTime() / 1000);
    const end = Math.floor(new Date(endTime).getTime() / 1000);
    if (end <= start) { showStatus("End must be after start.", "error"); return; }
    try {
      setSettingTimer(true);
      showStatus("Proposing election time...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.proposeSetElectionTime(start, end);
      await tx.wait();
      setPendingStartTime(start); setPendingEndTime(end);
      const key = ethers.utils.solidityKeccak256(["string","uint256","uint256"], ["setElectionTime", start, end]);
      setElectionTimeKey(key);
      showStatus("Proposed! Share the key with Admin 2 or 3.", "success");
    } catch (err) { showStatus("Proposal failed.", "error"); }
    finally { setSettingTimer(false); }
  }

  async function executeElectionTimer() {
    if (!pendingStartTime || !pendingEndTime) { showStatus("No pending election time.", "error"); return; }
    try {
      setExecutingAction(true);
      showStatus("Executing election time...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.executeSetElectionTime(pendingStartTime, pendingEndTime);
      await tx.wait();
      showStatus("Election time set!", "success");
      setStartTime(""); setEndTime(""); setPendingStartTime(null); setPendingEndTime(null); setElectionTimeKey("");
    } catch (err) { showStatus("Execute failed: " + (err.reason || err.message), "error"); }
    finally { setExecutingAction(false); }
  }

  async function approveVoter(address) {
    try {
      setApprovingVoter(address);
      showStatus("Approving voter...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.approveVoter(address);
      await tx.wait();
      showStatus("Voter approved!", "success");
      await refreshPendingVoters();
    } catch (err) { showStatus("Failed.", "error"); }
    finally { setApprovingVoter(""); }
  }

  async function rejectVoter(address) {
    try {
      showStatus("Rejecting voter...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.rejectVoter(address);
      await tx.wait();
      showStatus("Voter rejected.", "info");
      await refreshPendingVoters();
    } catch (err) { showStatus("Failed.", "error"); }
  }

  async function approveManualVoter() {
    if (!manualVoterAddress || !ethers.utils.isAddress(manualVoterAddress)) {
      showStatus("Enter a valid address.", "error"); return;
    }
    await approveVoter(manualVoterAddress);
    setManualVoterAddress("");
  }

  async function declareResult() {
    try {
      showStatus("Declaring result...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.declareResult();
      await tx.wait();
      showStatus("Results declared!", "success");
    } catch (err) { showStatus("Failed: " + err.reason, "error"); }
  }

  async function uploadProofToIPFS() {
    if (!proofFile) { showStatus("Select a file first.", "error"); return; }
    try {
      setUploadingProof(true);
      showStatus("Uploading to IPFS...", "warn");
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
        showStatus("Uploaded! CID: " + data.IpfsHash.slice(0, 20) + "...", "success");
      } else { showStatus("Upload failed.", "error"); }
    } catch (err) { showStatus("Upload failed.", "error"); }
    finally { setUploadingProof(false); }
  }

  async function submitPhaseProof() {
    if (!proofProjectId || !proofCID) { showStatus("Fill project ID and CID.", "error"); return; }
    try {
      setSubmittingProof(true);
      showStatus("Submitting proof...", "warn");
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, signer);
      const tx = await contract.submitPhaseProof(proofProjectId, proofCID);
      await tx.wait();
      showStatus("Proof submitted!", "success");
      setProofProjectId(""); setProofCID(""); setProofFile(null);
    } catch (err) { showStatus("Failed.", "error"); }
    finally { setSubmittingProof(false); }
  }

  async function releasePhase() {
    if (!releaseProjectId) { showStatus("Enter project ID.", "error"); return; }
    try {
      setReleasingPhase(true);
      showStatus("Releasing phase...", "warn");
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, signer);
      const tx = await contract.releasePhase(releaseProjectId);
      await tx.wait();
      showStatus("Phase released!", "success");
      setReleaseProjectId("");
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      await loadData(prov, new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov));
    } catch (err) { showStatus("Failed: " + err.reason, "error"); }
    finally { setReleasingPhase(false); }
  }

  async function createProject() {
    if (!projectName || !contractorAddress || !projectStart || !projectEnd) {
      showStatus("Fill all project fields.", "error"); return;
    }
    const phaseNames = phases.map(p => p.name).filter(n => n);
    const phaseBudgets = phases.map(p => ethers.utils.parseEther(p.budget || "0"));
    const totalBudget = phaseBudgets.reduce((a, b) => a.add(b), ethers.BigNumber.from(0));
    const start = Math.floor(new Date(projectStart).getTime() / 1000);
    const end = Math.floor(new Date(projectEnd).getTime() / 1000);
    try {
      setCreatingProject(true);
      showStatus("Creating project...", "warn");
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, signer);
      const tx = await contract.createProject(projectName, contractorAddress, start, end, phaseNames, phaseBudgets, { value: totalBudget });
      await tx.wait();
      showStatus("Project created!", "success");
      setProjectName(""); setContractorAddress(""); setProjectStart(""); setProjectEnd("");
      setPhases([{ name: "", budget: "" }]);
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      await loadData(prov, new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov));
    } catch (err) { showStatus("Failed to create project.", "error"); }
    finally { setCreatingProject(false); }
  }

  if (loading) return (
    <div className="admin-loading">
      <div className="loading-spinner" />
      <p>Verifying admin access...</p>
    </div>
  );

  return (
    <div className="admin-shell">

      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 8L16 10.5V15.5L12 18L8 15.5V10.5L12 8Z" fill="currentColor" opacity="0.4"/>
            </svg>
          </div>

          <nav className="sidebar-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="stab-icon">{tab.icon}</span>
                <span className="stab-label">{tab.label}</span>
                {tab.id === "candidates" && candidates.length > 0 && (
                  <span className="stab-badge">{candidates.length}</span>
                )}
                {tab.id === "voters" && pendingVoters.length > 0 && (
                  <span className="stab-badge stab-badge-warn">{pendingVoters.length}</span>
                )}
                {tab.id === "budget" && (
                  <span className="stab-badge stab-badge-eth">{parseFloat(budgetBalance).toFixed(2)} ETH</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="wallet-info">
            <span className="wallet-dot" />
            <span className="wallet-addr">{walletAddress}</span>
          </div>
          <span className="admin-tag">Admin</span>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="admin-main">

        {/* Status toast */}
        {status && (
          <div className={`status-toast status-${statusType}`}>
            {statusType === "success" && "✓ "}{statusType === "error" && "✕ "}{statusType === "warn" && "⏳ "}
            {status}
          </div>
        )}

        {/* ── CANDIDATES ── */}
        {activeTab === "candidates" && (
          <div className="tab-content">
            <div className="tab-header">
              <h1>Candidates</h1>
              <p>Multi-sig required: propose → approve (Admin 2/3) → execute after 2 min timelock</p>
            </div>

            <div className="content-grid">
              <div className="panel">
                <h2 className="panel-title">Add Candidate</h2>
                <div className="field">
                  <label>Name</label>
                  <input type="text" placeholder="e.g. Alice Johnson" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="input" />
                </div>
                <div className="field">
                  <label>Photo CID or URL</label>
                  <input type="text" placeholder="Qm... or https://..." value={candidatePhoto} onChange={e => setCandidatePhoto(e.target.value)} className="input" />
                </div>

                <div className="step-row">
                  <button className="btn btn-primary" onClick={proposeCandidate} disabled={addingCandidate}>
                    {addingCandidate ? "Proposing..." : "1 · Propose"}
                  </button>
                  <div className="step-arrow">→</div>
                  <div className="step-mid">Admin 2 or 3 approves below</div>
                  <div className="step-arrow">→</div>
                  <button className="btn btn-accent" onClick={executeCandidate} disabled={executingAction}>
                    {executingAction ? "Executing..." : "3 · Execute"}
                  </button>
                </div>

                {candidateKey && (
                  <div className="key-box">
                    <span className="key-label">Action Key — share with Admin 2/3</span>
                    <code className="key-val">{candidateKey}</code>
                  </div>
                )}

                <div className="divider" />

                <h2 className="panel-title">Approve Action (Admin 2 or 3)</h2>
                <div className="field">
                  <label>Action Key</label>
                  <input type="text" placeholder="Paste bytes32 key here" value={pendingActionKey} onChange={e => setPendingActionKey(e.target.value)} className="input mono" />
                </div>
                <button className="btn btn-primary" onClick={approveAction} disabled={approvingAction}>
                  {approvingAction ? "Approving..." : "2 · Approve Action"}
                </button>
              </div>

              <div className="panel">
                <h2 className="panel-title">Current Candidates ({candidates.length})</h2>
                {candidates.length === 0 ? (
                  <div className="empty-panel">No candidates yet</div>
                ) : (
                  <div className="candidate-list">
                    {candidates.map(c => (
                      <div key={c.id} className="cand-row">
                        <img
                          src={c.photoCID.startsWith("http") ? c.photoCID : `https://gateway.pinata.cloud/ipfs/${c.photoCID}`}
                          alt={c.name}
                          onError={e => e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=6c63ff&color=fff`}
                          className="cand-img"
                        />
                        <span className="cand-name">{c.name}</span>
                        <span className="cand-votes">{c.voteCount} votes</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="divider" />
                <h2 className="panel-title">Declare Results</h2>
                <p className="panel-sub">Permanent — only after election ends.</p>
                <button className="btn btn-danger" onClick={declareResult}>Declare Results</button>
              </div>
            </div>
          </div>
        )}

        {/* ── TIMER ── */}
        {activeTab === "timer" && (
          <div className="tab-content">
            <div className="tab-header">
              <h1>Election Timer</h1>
              <p>Multi-sig required: propose → approve → execute after 2 min timelock</p>
            </div>
            <div className="content-grid">
              <div className="panel">
                <h2 className="panel-title">Set Schedule</h2>
                <div className="field-row">
                  <div className="field">
                    <label>Voting Start</label>
                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="input" />
                  </div>
                  <div className="field">
                    <label>Voting End</label>
                    <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="input" />
                  </div>
                </div>
                <div className="step-row">
                  <button className="btn btn-primary" onClick={proposeElectionTimer} disabled={settingTimer}>
                    {settingTimer ? "Proposing..." : "1 · Propose"}
                  </button>
                  <div className="step-arrow">→</div>
                  <div className="step-mid">Admin 2 or 3 approves below</div>
                  <div className="step-arrow">→</div>
                  <button className="btn btn-accent" onClick={executeElectionTimer} disabled={executingAction}>
                    {executingAction ? "Executing..." : "3 · Execute"}
                  </button>
                </div>
                {electionTimeKey && (
                  <div className="key-box">
                    <span className="key-label">Action Key — share with Admin 2/3</span>
                    <code className="key-val">{electionTimeKey}</code>
                  </div>
                )}
              </div>

              <div className="panel">
                <h2 className="panel-title">Approve Action (Admin 2 or 3)</h2>
                <div className="field">
                  <label>Action Key</label>
                  <input type="text" placeholder="Paste bytes32 key here" value={pendingActionKey} onChange={e => setPendingActionKey(e.target.value)} className="input mono" />
                </div>
                <button className="btn btn-primary" onClick={approveAction} disabled={approvingAction}>
                  {approvingAction ? "Approving..." : "2 · Approve Action"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── VOTERS ── */}
        {activeTab === "voters" && (
          <div className="tab-content">
            <div className="tab-header">
              <h1>Voter Management</h1>
              <p>Approve or reject voter registration requests</p>
            </div>
            <div className="content-grid">
              <div className="panel">
                <h2 className="panel-title">Manually Approve</h2>
                <div className="field">
                  <label>Wallet Address</label>
                  <input type="text" placeholder="0x..." value={manualVoterAddress} onChange={e => setManualVoterAddress(e.target.value)} className="input mono" />
                </div>
                <button className="btn btn-primary" onClick={approveManualVoter}>Approve Voter</button>
              </div>

              <div className="panel">
                <h2 className="panel-title">Pending Requests ({pendingVoters.length})</h2>
                {pendingVoters.length === 0 ? (
                  <div className="empty-panel">No pending requests</div>
                ) : (
                  <div className="voter-list">
                    {pendingVoters.map((voter, i) => (
                      <div key={i} className="voter-row">
                        <span className="voter-addr mono">{voter.slice(0,10)}...{voter.slice(-6)}</span>
                        <div className="voter-btns">
                          <button onClick={() => approveVoter(voter)} disabled={approvingVoter === voter} className="btn btn-sm btn-success">
                            {approvingVoter === voter ? "..." : "Approve"}
                          </button>
                          <button onClick={() => rejectVoter(voter)} className="btn btn-sm btn-danger">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BUDGET ── */}
        {activeTab === "budget" && (
          <div className="tab-content">
            <div className="tab-header">
              <h1>Budget Management</h1>
              <p>ETH locked per phase — released only after proof verification</p>
            </div>

            <div className="budget-balance-bar">
              <span className="bb-label">Contract Balance</span>
              <span className="bb-value">{parseFloat(budgetBalance).toFixed(4)} ETH</span>
            </div>

            <div className="content-grid three-col">

              <div className="panel">
                <h2 className="panel-title">Create Project</h2>
                <div className="field">
                  <label>Project Name</label>
                  <input type="text" placeholder="e.g. Road Construction" value={projectName} onChange={e => setProjectName(e.target.value)} className="input" />
                </div>
                <div className="field">
                  <label>Contractor Address</label>
                  <input type="text" placeholder="0x..." value={contractorAddress} onChange={e => setContractorAddress(e.target.value)} className="input mono" />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Start</label>
                    <input type="datetime-local" value={projectStart} onChange={e => setProjectStart(e.target.value)} className="input" />
                  </div>
                  <div className="field">
                    <label>End</label>
                    <input type="datetime-local" value={projectEnd} onChange={e => setProjectEnd(e.target.value)} className="input" />
                  </div>
                </div>
                <div className="field">
                  <label>Phases</label>
                  {phases.map((phase, i) => (
                    <div key={i} className="phase-input-row">
                      <input type="text" placeholder={`Phase ${i + 1} name`} value={phase.name} onChange={e => { const p=[...phases]; p[i].name=e.target.value; setPhases(p); }} className="input" />
                      <input type="number" placeholder="ETH" value={phase.budget} onChange={e => { const p=[...phases]; p[i].budget=e.target.value; setPhases(p); }} className="input input-sm" />
                      {phases.length > 1 && (
                        <button onClick={() => setPhases(phases.filter((_,idx) => idx!==i))} className="btn-remove">×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setPhases([...phases, { name:"", budget:"" }])} className="btn-add-phase">+ Add Phase</button>
                </div>
                <button className="btn btn-primary" onClick={createProject} disabled={creatingProject}>
                  {creatingProject ? "Creating..." : "Create Project"}
                </button>
              </div>

              <div className="panel">
                <h2 className="panel-title">Submit Phase Proof</h2>
                <div className="field">
                  <label>Project ID</label>
                  <input type="number" placeholder="e.g. 1" value={proofProjectId} onChange={e => setProofProjectId(e.target.value)} className="input" />
                </div>
                <div className="field">
                  <label>Upload Evidence</label>
                  <input type="file" accept="image/*,.pdf" onChange={e => setProofFile(e.target.files[0])} className="input" />
                  <button className="btn btn-primary" onClick={uploadProofToIPFS} disabled={uploadingProof || !proofFile} style={{marginTop:"0.5rem"}}>
                    {uploadingProof ? "Uploading..." : "Upload to IPFS"}
                  </button>
                </div>
                {proofCID && (
                  <div className="cid-box">
                    CID: <a href={`https://gateway.pinata.cloud/ipfs/${proofCID}`} target="_blank" rel="noreferrer">{proofCID.slice(0,22)}...</a>
                  </div>
                )}
                <div className="field">
                  <label>IPFS CID</label>
                  <input type="text" placeholder="Qm..." value={proofCID} onChange={e => setProofCID(e.target.value)} className="input mono" />
                </div>
                <button className="btn btn-primary" onClick={submitPhaseProof} disabled={submittingProof}>
                  {submittingProof ? "Submitting..." : "Submit Proof"}
                </button>
              </div>

              <div className="panel">
                <h2 className="panel-title">Release Phase Funds</h2>
                {projects.length > 0 && (
                  <div className="project-mini-list">
                    {projects.map(p => (
                      <div key={p.id} className="proj-mini-row">
                        <span>{p.name}</span>
                        <span className="proj-phase-tag">Phase {p.currentPhase}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="field" style={{marginTop:"1rem"}}>
                  <label>Project ID</label>
                  <input type="number" placeholder="e.g. 1" value={releaseProjectId} onChange={e => setReleaseProjectId(e.target.value)} className="input" />
                </div>
                <button className="btn btn-accent" onClick={releasePhase} disabled={releasingPhase}>
                  {releasingPhase ? "Releasing..." : "Release Phase Funds"}
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}