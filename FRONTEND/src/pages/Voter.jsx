import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { VOTING_CONTRACT_ADDRESS, BUDGET_CONTRACT_ADDRESS } from "../contracts/contractConfig";
import { votingABI } from "../contracts/votingABI";
import { budgetABI } from "../contracts/BudgetABI";
import "../styles/Voter.css";

const PINATA_API_KEY = "8a0487ef669e51109be9";
const PINATA_SECRET = "dfe7ea61ffde865330fdd3d2456ac4eef84fd14fc0a3175e7961645b5d6f5ae3";

export default function Voter() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusColor, setStatusColor] = useState("#4ade80");
  const [activeTab, setActiveTab] = useState("vote");

  // Voter status: 0=None, 1=Pending, 2=Approved, 3=Rejected
  const [voterStatus, setVoterStatus] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [voting, setVoting] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [resultsDeclared, setResultsDeclared] = useState(false);
  const [winner, setWinner] = useState(null);

  // Registration
  const [idProofFile, setIdProofFile] = useState(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Budget
  const [projects, setProjects] = useState([]);
  const [budgetBalance, setBudgetBalance] = useState("0");
  const [phaseEvents, setPhaseEvents] = useState([]);

  useEffect(() => { initWallet(); }, []);

  async function initWallet() {
    if (!window.ethereum) { navigate("/"); return; }
    try {
      const prov = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await prov.listAccounts();
      if (accounts.length === 0) { navigate("/"); return; }
      const sign = prov.getSigner();
      const address = await sign.getAddress();
      setProvider(prov);
      setSigner(sign);
      setWalletAddress(address.slice(0, 6) + "..." + address.slice(-4));
      setFullAddress(address);
      await loadVotingData(prov, address);
      await loadBudgetData(prov);
    } catch (err) {
      console.error(err);
      navigate("/");
    } finally { setLoading(false); }
  }

  async function loadVotingData(prov, address) {
    try {
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, prov);
      const status = await contract.voterStatus(address);
      setVoterStatus(Number(status));
      const voted = await contract.hasVoted(address);
      setHasVoted(voted);
      const sTime = await contract.startTime();
      const eTime = await contract.endTime();
      if (sTime.toNumber() > 0) setStartTime(new Date(sTime.toNumber() * 1000));
      if (eTime.toNumber() > 0) setEndTime(new Date(eTime.toNumber() * 1000));
      const declared = await contract.resultsDeclared();
      setResultsDeclared(declared);
      if (declared) {
        const w = await contract.getWinner();
        setWinner({ name: w.name, photoCID: w.photoCID, voteCount: w.voteCount.toString() });
      }
      const count = await contract.candidatesCount();
      const list = [];
      let total = 0;
      for (let i = 1; i <= count; i++) {
        const c = await contract.candidates(i);
        total += Number(c.voteCount);
      }
      for (let i = 1; i <= count; i++) {
        const c = await contract.candidates(i);
        list.push({
          id: c.id.toString(), name: c.name, photoCID: c.photoCID,
          voteCount: c.voteCount.toString(),
          percentage: total > 0 ? Math.round((Number(c.voteCount) / total) * 100) : 0
        });
      }
      setCandidates(list);
    } catch (err) { console.error("Failed to load voting data:", err); }
  }

  async function loadBudgetData(prov) {
    try {
      const contract = new ethers.Contract(BUDGET_CONTRACT_ADDRESS, budgetABI, prov);
      const bal = await contract.getBalance();
      setBudgetBalance(ethers.utils.formatEther(bal));
      const projCount = await contract.projectCount();
      const projList = [];
      for (let i = 1; i <= projCount; i++) {
        const p = await contract.projects(i);
        const phases = await contract.getPhases(i);
        projList.push({
          id: p.id.toString(), name: p.name,
          contractor: p.contractor,
          currentPhase: p.currentPhase.toString(),
          phaseNames: phases.names,
          phaseBudgets: phases.budgets.map(b => ethers.utils.formatEther(b)),
          evidenceCIDs: phases.evidenceCIDs,
          statuses: phases.statuses.map(s => Number(s))
        });
      }
      setProjects(projList);

      // Load PhaseReleased events
      const filter = contract.filters.PhaseReleased();
      const events = await contract.queryFilter(filter);
      setPhaseEvents(events.map(e => ({
        projectId: e.args.projectId.toString(),
        phaseIndex: e.args.phaseIndex.toString(),
        amount: ethers.utils.formatEther(e.args.amount),
        contractor: e.args.contractor,
        hash: e.transactionHash
      })).reverse());
    } catch (err) { console.error("Failed to load budget data:", err); }
  }

  function showStatus(msg, color = "#4ade80") {
    setStatus(msg); setStatusColor(color);
    setTimeout(() => setStatus(""), 4000);
  }

  function getElectionStatus() {
    if (!startTime || !endTime) return { label: "Not scheduled", color: "#64748b" };
    const now = new Date();
    if (now < startTime) return { label: "Upcoming", color: "#f6c90e" };
    if (now > endTime) return { label: "Ended", color: "#f87171" };
    return { label: "Live", color: "#4ade80" };
  }

  async function uploadIdAndRegister() {
    if (!idProofFile) { showStatus("Select an ID proof file first.", "#f87171"); return; }
    try {
      setUploadingId(true);
      showStatus("Uploading ID to IPFS...", "#f6c90e");
      const formData = new FormData();
      formData.append("file", idProofFile);
      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { pinata_api_key: PINATA_API_KEY, pinata_secret_api_key: PINATA_SECRET },
        body: formData,
      });
      const data = await res.json();
      if (!data.IpfsHash) { showStatus("Upload failed.", "#f87171"); return; }
      setUploadingId(false);
      setRegistering(true);
      showStatus("Submitting registration request...", "#f6c90e");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.requestVoterRegistration(data.IpfsHash);
      await tx.wait();
      showStatus("Registration submitted! Wait for admin approval.");
      setVoterStatus(1);
      setIdProofFile(null);
    } catch (err) {
      console.error(err); showStatus("Registration failed.", "#f87171");
    } finally { setUploadingId(false); setRegistering(false); }
  }

  async function castVote(candidateId) {
    try {
      setVoting(true);
      showStatus("Waiting for MetaMask...", "#f6c90e");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.vote(candidateId);
      showStatus("Transaction submitted...", "#f6c90e");
      await tx.wait();
      showStatus("Vote cast successfully!");
      setHasVoted(true);
      await loadVotingData(provider, fullAddress);
    } catch (err) {
      console.error(err);
      if (err.message.includes("not a verified voter")) showStatus("You are not an approved voter.", "#f87171");
      else if (err.message.includes("already voted")) showStatus("You have already voted!", "#f87171");
      else if (err.message.includes("not open")) showStatus("Voting is not currently open.", "#f87171");
      else showStatus("Vote failed.", "#f87171");
    } finally { setVoting(false); }
  }

  const electionStatus = getElectionStatus();
  const statusLabels = ["Not Registered", "Pending Approval", "Approved", "Rejected"];
  const statusColors = ["#64748b", "#f6c90e", "#4ade80", "#f87171"];

  if (loading) return (
    <div className="voter-loading">
      <div className="loading-spinner" />
      <p>Loading voter dashboard...</p>
    </div>
  );

  return (
    <div className="voter-page">
      <div className="bg-grid" />
      <div className="voter-header">
        <button className="back-btn" onClick={() => navigate("/")}>Back</button>
        <h2 className="header-title">Voter Dashboard</h2>
        <div className="wallet-pill">
          <span className="dot" style={{ background: statusColors[voterStatus] }} />
          {walletAddress}
          <span className="status-tag" style={{ color: statusColors[voterStatus], borderColor: statusColors[voterStatus] + "33", background: statusColors[voterStatus] + "1a" }}>
            {statusLabels[voterStatus]}
          </span>
        </div>
      </div>

      {status && (
        <div className="global-status" style={{ color: statusColor, borderColor: statusColor + "33" }}>{status}</div>
      )}

      <div className="voter-tabs">
        <button className={`tab-btn ${activeTab === "vote" ? "active" : ""}`} onClick={() => setActiveTab("vote")}>Cast Vote</button>
        <button className={`tab-btn ${activeTab === "budget" ? "active" : ""}`} onClick={() => setActiveTab("budget")}>Budget Tracker</button>
      </div>

      <div className="voter-content">

        {activeTab === "vote" && (
          <div>
            <div className="election-status-bar">
              <span className="election-dot" style={{ background: electionStatus.color }} />
              <span>Election: </span>
              <strong style={{ color: electionStatus.color }}>{electionStatus.label}</strong>
              {startTime && endTime && (
                <span className="election-time">{startTime.toLocaleString()} — {endTime.toLocaleString()}</span>
              )}
            </div>

            {resultsDeclared && winner && (
              <div className="voted-box" style={{ background: "rgba(246,201,14,0.06)", borderColor: "rgba(246,201,14,0.2)", color: "#f6c90e" }}>
                Election Ended! Winner: <strong>{winner.name}</strong> with {winner.voteCount} votes
              </div>
            )}

            {voterStatus === 0 && (
              <div className="warning-box">
                <strong>Register to Vote</strong>
                <p style={{ margin: "0.5rem 0", fontSize: "0.82rem" }}>Upload your ID proof to request voter registration. Admin will approve your request.</p>
                <input type="file" accept="image/*,.pdf" onChange={e => setIdProofFile(e.target.files[0])}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1e2d45", borderRadius: "8px", padding: "0.5rem", width: "100%", color: "#e2e8f0", marginBottom: "0.5rem" }} />
                <button onClick={uploadIdAndRegister} disabled={uploadingId || registering || !idProofFile}
                  style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white", border: "none", borderRadius: "8px", padding: "0.6rem 1.5rem", fontFamily: "Syne, sans-serif", fontWeight: "700", cursor: "pointer", opacity: (!idProofFile || uploadingId || registering) ? 0.5 : 1 }}>
                  {uploadingId ? "Uploading..." : registering ? "Registering..." : "Request Registration"}
                </button>
              </div>
            )}

            {voterStatus === 1 && (
              <div className="warning-box" style={{ borderColor: "rgba(246,201,14,0.2)", color: "#f6c90e", background: "rgba(246,201,14,0.06)" }}>
                Your registration is pending admin approval. Check back soon!
              </div>
            )}

            {voterStatus === 3 && (
              <div className="warning-box">
                Your voter registration was rejected. Contact the admin.
              </div>
            )}

            {hasVoted && (
              <div className="voted-box">You have already cast your vote! Results shown below.</div>
            )}

            {candidates.length === 0 ? (
              <div className="empty-state">No candidates added yet. Check back soon!</div>
            ) : (
              <div className="candidates-grid">
                {candidates.map(c => (
                  <div key={c.id} className={`candidate-card ${hasVoted ? "voted" : ""}`}>
                    <div className="candidate-photo">
                      <img
                        src={c.photoCID.startsWith("http") ? c.photoCID : `https://gateway.pinata.cloud/ipfs/${c.photoCID}`}
                        alt={c.name}
                        onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${c.name}&background=3b82f6&color=fff&size=100`; }}
                      />
                    </div>
                    <div className="candidate-info">
                      <h3>{c.name}</h3>
                      <span className="vote-count">{c.voteCount} votes · {c.percentage}%</span>
                    </div>
                    <div className="vote-bar-wrap">
                      <div className="vote-bar" style={{ width: `${c.percentage}%` }} />
                    </div>
                    <button className="vote-btn" onClick={() => castVote(c.id)} disabled={voting || hasVoted || voterStatus !== 2}>
                      {hasVoted ? "Voted" : voting ? "Processing..." : voterStatus !== 2 ? "Not Approved" : "Vote"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "budget" && (
          <div>
            <div className="budget-summary">
              <div className="budget-stat">
                <p>CONTRACT BALANCE</p>
                <h2>{parseFloat(budgetBalance).toFixed(4)} ETH</h2>
              </div>
              <div className="budget-stat">
                <p>TOTAL PROJECTS</p>
                <h2>{projects.length}</h2>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="empty-state">No budget projects created yet.</div>
            ) : (
              projects.map(p => (
                <div key={p.id} style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: "14px", padding: "1.25rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "1rem", fontWeight: "700" }}>{p.name}</h3>
                    <span style={{ fontFamily: "Space Mono, monospace", fontSize: "0.72rem", color: "#06d6a0" }}>Phase {p.currentPhase}</span>
                  </div>
                  <p style={{ fontFamily: "Space Mono, monospace", fontSize: "0.72rem", color: "#64748b", marginBottom: "0.75rem" }}>
                    Contractor: {p.contractor.slice(0, 6)}...{p.contractor.slice(-4)}
                  </p>
                  {p.phaseNames.map((name, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", marginBottom: "0.4rem", border: `1px solid ${p.statuses[i] === 2 ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)"}` }}>
                      <span style={{ fontSize: "0.85rem" }}>{name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontFamily: "Space Mono, monospace", fontSize: "0.72rem", color: "#f6c90e" }}>{p.phaseBudgets[i]} ETH</span>
                        <span style={{ fontFamily: "Space Mono, monospace", fontSize: "0.65rem", color: p.statuses[i] === 2 ? "#4ade80" : p.statuses[i] === 1 ? "#f6c90e" : "#64748b" }}>
                          {p.statuses[i] === 0 ? "Pending" : p.statuses[i] === 1 ? "Proof Submitted" : "Released"}
                        </span>
                        {p.evidenceCIDs[i] && (
                          <a href={`https://gateway.pinata.cloud/ipfs/${p.evidenceCIDs[i]}`} target="_blank" rel="noreferrer"
                            style={{ fontFamily: "Space Mono, monospace", fontSize: "0.65rem", color: "#3b82f6", textDecoration: "none" }}>
                            View Proof
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}

            {phaseEvents.length > 0 && (
              <div>
                <h3 className="receipts-title">Phase Release History</h3>
                <div className="receipts-list">
                  {phaseEvents.map((e, i) => (
                    <div key={i} className="receipt-item">
                      <div className="receipt-icon">↑</div>
                      <div className="receipt-details">
                        <span className="receipt-to">Project #{e.projectId} Phase {e.phaseIndex}</span>
                        <span className="receipt-amount">{e.amount} ETH to {e.contractor.slice(0, 6)}...{e.contractor.slice(-4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
