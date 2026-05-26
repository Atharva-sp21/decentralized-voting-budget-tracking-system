import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { VOTING_CONTRACT_ADDRESS, BUDGET_CONTRACT_ADDRESS } from "../contracts/contractConfig";
import { votingABI } from "../contracts/votingABI";
import { budgetABI } from "../contracts/BudgetABI";
import "../styles/Admin.css";

const PINATA_API_KEY = "8a0487ef669e51109be9";
const PINATA_SECRET = "dfe7ea61ffde865330fdd3d2456ac4eef84fd14fc0a3175e7961645b5d6f5ae3";

export default function Admin() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusColor, setStatusColor] = useState("#4ade80");
  const [activeTab, setActiveTab] = useState("candidates");

  // Candidate form
  const [candidateName, setCandidateName] = useState("");
  const [candidatePhoto, setCandidatePhoto] = useState("");
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [candidates, setCandidates] = useState([]);

  // Election timer
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [settingTimer, setSettingTimer] = useState(false);

  // Voter management
  const [pendingVoters, setPendingVoters] = useState([]);
  const [approvingVoter, setApprovingVoter] = useState("");
  const [manualVoterAddress, setManualVoterAddress] = useState("");

  // Budget - Create Project
  const [projectName, setProjectName] = useState("");
  const [contractorAddress, setContractorAddress] = useState("");
  const [projectStart, setProjectStart] = useState("");
  const [projectEnd, setProjectEnd] = useState("");
  const [phases, setPhases] = useState([{ name: "", budget: "" }]);
  const [creatingProject, setCreatingProject] = useState(false);
  const [budgetBalance, setBudgetBalance] = useState("0");
  const [projects, setProjects] = useState([]);

  // Budget - Submit Proof
  const [proofProjectId, setProofProjectId] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofCID, setProofCID] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);

  // Budget - Release Phase
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
      const owner = await votingContract.admin();
      if (owner.toLowerCase() !== address.toLowerCase()) {
        alert("Access denied! Only the admin can view this page.");
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

  // ✅ FIX: dedicated function to refresh pending voters list
  async function refreshPendingVoters(votingContractInstance) {
    try {
      // if no contract instance passed in, create a fresh one
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const vc = votingContractInstance || new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      const pending = await vc.getPendingVoters();
      setPendingVoters(pending);
    } catch (err) {
      console.error("Failed to refresh pending voters:", err);
    }
  }

  function showStatus(msg, color = "#4ade80") {
    setStatus(msg);
    setStatusColor(color);
    setTimeout(() => setStatus(""), 4000);
  }

  async function addCandidate() {
    if (!candidateName || !candidatePhoto) { showStatus("Fill in name and photo CID.", "#f87171"); return; }
    try {
      setAddingCandidate(true);
      showStatus("Waiting for MetaMask...", "#f6c90e");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.addCandidate(candidateName, candidatePhoto);
      await tx.wait();
      showStatus("Candidate added!");
      setCandidateName(""); setCandidatePhoto("");
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const vc = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      await loadData(prov, vc);
    } catch (err) {
      console.error(err); showStatus("Failed to add candidate.", "#f87171");
    } finally { setAddingCandidate(false); }
  }

  async function setElectionTimer() {
    if (!startTime || !endTime) { showStatus("Set both times.", "#f87171"); return; }
    const start = Math.floor(new Date(startTime).getTime() / 1000);
    const end = Math.floor(new Date(endTime).getTime() / 1000);
    if (end <= start) { showStatus("End must be after start.", "#f87171"); return; }
    try {
      setSettingTimer(true);
      showStatus("Waiting for MetaMask...", "#f6c90e");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.setElectionTime(start, end);
      await tx.wait();
      showStatus("Election timer set!");
      setStartTime(""); setEndTime("");
    } catch (err) {
      console.error(err); showStatus("Failed to set timer.", "#f87171");
    } finally { setSettingTimer(false); }
  }

  async function approveVoter(address) {
    try {
      setApprovingVoter(address);
      showStatus("Approving voter...", "#f6c90e");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.approveVoter(address);
      await tx.wait();
      showStatus("Voter approved!");
      // ✅ FIX: refresh pending list immediately after approval
      await refreshPendingVoters();
    } catch (err) {
      console.error(err); showStatus("Failed to approve voter.", "#f87171");
    } finally { setApprovingVoter(""); }
  }

  async function rejectVoter(address) {
    try {
      showStatus("Rejecting voter...", "#f6c90e");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.rejectVoter(address);
      await tx.wait();
      showStatus("Voter rejected.");
      // ✅ FIX: refresh pending list immediately after rejection
      await refreshPendingVoters();
    } catch (err) {
      console.error(err); showStatus("Failed to reject voter.", "#f87171");
    }
  }

  async function approveManualVoter() {
    if (!manualVoterAddress || !ethers.utils.isAddress(manualVoterAddress)) {
      showStatus("Enter a valid address.", "#f87171"); return;
    }
    await approveVoter(manualVoterAddress);
    // ✅ FIX: clear the input field after approval
    setManualVoterAddress("");
  }

  async function declareResult() {
    try {
      showStatus("Declaring result...", "#f6c90e");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.declareResult();
      await tx.wait();
      showStatus("Results declared!");
    } catch (err) {
      console.error(err); showStatus("Failed to declare results: " + err.reason, "#f87171");
    }
  }

  async function uploadProofToIPFS() {
    if (!proofFile) { showStatus("Select a file first.", "#f87171"); return; }
    try {
      setUploadingProof(true);
      showStatus("Uploading to IPFS...", "#f6c90e");
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
      } else { showStatus("Upload failed.", "#f87171"); }
    } catch (err) {
      console.error(err); showStatus("Upload failed. Check Pinata keys.", "#f87171");
    } finally { setUploadingProof(false); }
  }

  async function submitPhaseProof() {
    if (!proofProjectId || !proofCID) { showStatus("Fill project ID and CID.", "#f87171"); return; }
    try {
      setSubmittingProof(true);
      showStatus("Submitting proof...", "#f6c90e");
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, signer);
      const tx = await contract.submitPhaseProof(proofProjectId, proofCID);
      await tx.wait();
      showStatus("Proof submitted!");
      setProofProjectId(""); setProofCID(""); setProofFile(null);
    } catch (err) {
      console.error(err); showStatus("Failed to submit proof.", "#f87171");
    } finally { setSubmittingProof(false); }
  }

  async function releasePhase() {
    if (!releaseProjectId) { showStatus("Enter project ID.", "#f87171"); return; }
    try {
      setReleasingPhase(true);
      showStatus("Releasing phase...", "#f6c90e");
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, signer);
      const tx = await contract.releasePhase(releaseProjectId);
      await tx.wait();
      showStatus("Phase released!");
      setReleaseProjectId("");
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const vc = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      await loadData(prov, vc);
    } catch (err) {
      console.error(err); showStatus("Failed to release phase: " + err.reason, "#f87171");
    } finally { setReleasingPhase(false); }
  }

  async function createProject() {
    if (!projectName || !contractorAddress || !projectStart || !projectEnd) {
      showStatus("Fill all project fields.", "#f87171"); return;
    }
    const phaseNames = phases.map(p => p.name).filter(n => n);
    const phaseBudgets = phases.map(p => ethers.utils.parseEther(p.budget || "0"));
    const totalBudget = phaseBudgets.reduce((a, b) => a.add(b), ethers.BigNumber.from(0));
    const start = Math.floor(new Date(projectStart).getTime() / 1000);
    const end = Math.floor(new Date(projectEnd).getTime() / 1000);
    try {
      setCreatingProject(true);
      showStatus("Creating project...", "#f6c90e");
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
      console.error(err); showStatus("Failed to create project.", "#f87171");
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
      <div className="bg-grid" />
      <div className="admin-header">
        <div className="admin-brand">
          <span className="admin-badge">ADMIN</span>
          <h1>Dashboard</h1>
        </div>
        <div className="wallet-pill">
          <span className="dot" />
          {walletAddress}
          <span className="owner-tag">Admin</span>
        </div>
      </div>

      {status && (
        <div className="global-status" style={{ color: statusColor, borderColor: statusColor + "33" }}>
          {status}
        </div>
      )}

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
            <p className="card-desc">Add candidates to the election. Photo can be IPFS CID or URL.</p>
            <div className="form-group">
              <label>Candidate Name</label>
              <input type="text" placeholder="e.g. Alice Johnson" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="admin-input" />
            </div>
            <div className="form-group">
              <label>Photo CID or URL</label>
              <input type="text" placeholder="Qm... or https://..." value={candidatePhoto} onChange={e => setCandidatePhoto(e.target.value)} className="admin-input" />
            </div>
            <button className="admin-btn" onClick={addCandidate} disabled={addingCandidate}>
              {addingCandidate ? <><span className="spinner" /> Adding...</> : "Add Candidate"}
            </button>

            {candidates.length > 0 && (
              <div className="candidates-list">
                <h3>Current Candidates ({candidates.length})</h3>
                {candidates.map(c => (
                  <div key={c.id} className="candidate-item">
                    <img src={c.photoCID.startsWith("http") ? c.photoCID : `https://gateway.pinata.cloud/ipfs/${c.photoCID}`} alt={c.name}
                      onError={e => e.target.src = `https://ui-avatars.com/api/?name=${c.name}&background=3b82f6&color=fff`} />
                    <span>{c.name}</span>
                    <span className="vote-badge">{c.voteCount} votes</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "1.5rem", borderTop: "1px solid #1e2d45", paddingTop: "1.25rem" }}>
              <h3 style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.75rem" }}>Declare Results</h3>
              <p className="card-desc">Only after election ends. This is permanent.</p>
              <button className="admin-btn" style={{ background: "linear-gradient(135deg, #f87171, #ef4444)" }} onClick={declareResult}>
                Declare Results
              </button>
            </div>
          </div>
        )}

        {activeTab === "timer" && (
          <div className="admin-card">
            <h2>Set Election Timer</h2>
            <p className="card-desc">Define when voting opens and closes. Start time must be in the future.</p>
            <div className="form-group">
              <label>Voting Start</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="admin-input" />
            </div>
            <div className="form-group">
              <label>Voting End</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="admin-input" />
            </div>
            <button className="admin-btn" onClick={setElectionTimer} disabled={settingTimer}>
              {settingTimer ? <><span className="spinner" /> Setting...</> : "Set Election Timer"}
            </button>
          </div>
        )}

        {activeTab === "voters" && (
          <div className="admin-card">
            <h2>Voter Management</h2>
            <p className="card-desc">Approve or reject voters who have requested registration</p>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label>Manually Approve Voter</label>
              <input type="text" placeholder="0x... wallet address" value={manualVoterAddress} onChange={e => setManualVoterAddress(e.target.value)} className="admin-input" />
              <button className="admin-btn approve-btn" onClick={approveManualVoter} style={{ marginTop: "0.5rem" }}>
                Approve Voter
              </button>
            </div>

            <div style={{ borderTop: "1px solid #1e2d45", paddingTop: "1.25rem" }}>
              <h3 style={{ fontSize: "0.78rem", color: "#64748b", fontFamily: "Space Mono", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "0.75rem" }}>
                Pending Requests ({pendingVoters.length})
              </h3>
              {pendingVoters.length === 0 ? (
                <p style={{ color: "#334155", fontFamily: "Space Mono", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No pending voter requests</p>
              ) : (
                pendingVoters.map((voter, i) => (
                  <div key={i} className="candidate-item" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "Space Mono", fontSize: "0.78rem" }}>{voter.slice(0, 10)}...{voter.slice(-6)}</span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => approveVoter(voter)} disabled={approvingVoter === voter}
                        style={{ background: "rgba(6,214,160,0.1)", border: "1px solid rgba(6,214,160,0.3)", color: "#06d6a0", padding: "0.3rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontFamily: "Syne, sans-serif", fontSize: "0.8rem" }}>
                        {approvingVoter === voter ? "..." : "Approve"}
                      </button>
                      <button onClick={() => rejectVoter(voter)}
                        style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "0.3rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontFamily: "Syne, sans-serif", fontSize: "0.8rem" }}>
                        Reject
                      </button>
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
              <p className="card-desc">Create a new budget project with phases. ETH is locked per phase.</p>
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
                      <button onClick={() => setPhases(phases.filter((_, idx) => idx !== i))}
                        style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: "8px", padding: "0 0.75rem", cursor: "pointer" }}>
                        x
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => setPhases([...phases, { name: "", budget: "" }])}
                  style={{ background: "rgba(59,130,246,0.08)", border: "1px dashed rgba(59,130,246,0.3)", color: "#3b82f6", borderRadius: "8px", padding: "0.5rem", width: "100%", cursor: "pointer", fontFamily: "Syne, sans-serif", marginTop: "0.25rem" }}>
                  + Add Phase
                </button>
              </div>
              <button className="admin-btn" onClick={createProject} disabled={creatingProject}>
                {creatingProject ? <><span className="spinner" /> Creating...</> : "Create Project"}
              </button>
            </div>

            <div className="admin-card" style={{ marginBottom: "1rem" }}>
              <h2>Submit Phase Proof</h2>
              <p className="card-desc">Contractor submits IPFS evidence before phase can be released</p>
              <div className="form-group">
                <label>Project ID</label>
                <input type="number" placeholder="e.g. 1" value={proofProjectId} onChange={e => setProofProjectId(e.target.value)} className="admin-input" />
              </div>
              <div className="form-group">
                <label>Upload Evidence to IPFS</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setProofFile(e.target.files[0])} className="admin-input file-input" />
                <button className="admin-btn ipfs-btn" onClick={uploadProofToIPFS} disabled={uploadingProof || !proofFile}>
                  {uploadingProof ? <><span className="spinner" /> Uploading...</> : "Upload to IPFS"}
                </button>
              </div>
              {proofCID && (
                <div className="cid-display">
                  CID: <a href={`https://gateway.pinata.cloud/ipfs/${proofCID}`} target="_blank" rel="noreferrer">{proofCID.slice(0, 25)}...</a>
                </div>
              )}
              <div className="form-group">
                <label>IPFS CID (auto-filled after upload)</label>
                <input type="text" placeholder="Qm..." value={proofCID} onChange={e => setProofCID(e.target.value)} className="admin-input" />
              </div>
              <button className="admin-btn" onClick={submitPhaseProof} disabled={submittingProof}>
                {submittingProof ? <><span className="spinner" /> Submitting...</> : "Submit Phase Proof"}
              </button>
            </div>

            <div className="admin-card">
              <h2>Release Phase Funds</h2>
              <p className="card-desc">Release funds for the current phase after proof is submitted</p>
              <div className="balance-mini">Contract Balance: <strong>{parseFloat(budgetBalance).toFixed(4)} ETH</strong></div>
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
              <button className="admin-btn release-btn" onClick={releasePhase} disabled={releasingPhase}>
                {releasingPhase ? <><span className="spinner" /> Releasing...</> : "Release Phase Funds"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
