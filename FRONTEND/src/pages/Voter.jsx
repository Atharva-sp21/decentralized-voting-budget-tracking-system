import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { VOTING_CONTRACT_ADDRESS, BUDGET_CONTRACT_ADDRESS } from "../contracts/contractConfig";
import { votingABI } from "../contracts/votingABI";
import { budgetABI } from "../contracts/BudgetABI";
import "../styles/Voter.css";

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET = import.meta.env.VITE_PINATA_SECRET;

export default function Voter() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusColor, setStatusColor] = useState("#6366f1");
  const [activeTab, setActiveTab] = useState("vote");

  const [voterStatus, setVoterStatus] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [voting, setVoting] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [resultsDeclared, setResultsDeclared] = useState(false);
  const [winner, setWinner] = useState(null);

  const [idProofFile, setIdProofFile] = useState(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [registering, setRegistering] = useState(false);

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
      const s = await contract.voterStatus(address);
      setVoterStatus(Number(s));
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

  function showStatus(msg, color = "#6366f1") {
    setStatus(msg); setStatusColor(color);
    setTimeout(() => setStatus(""), 4000);
  }

  function getElectionStatus() {
    if (!startTime || !endTime) return { label: "Not Scheduled", color: "#475569" };
    const now = new Date();
    if (now < startTime) return { label: "Upcoming", color: "#f59e0b" };
    if (now > endTime) return { label: "Ended", color: "#ef4444" };
    return { label: "Live Now", color: "#22c55e" };
  }

  async function uploadIdAndRegister() {
    if (!idProofFile) { showStatus("Select an ID proof file first.", "#ef4444"); return; }
    try {
      setUploadingId(true);
      showStatus("Uploading ID to IPFS...", "#f59e0b");
      const formData = new FormData();
      formData.append("file", idProofFile);
      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { pinata_api_key: PINATA_API_KEY, pinata_secret_api_key: PINATA_SECRET },
        body: formData,
      });
      const data = await res.json();
      if (!data.IpfsHash) { showStatus("Upload failed.", "#ef4444"); return; }
      setUploadingId(false);
      setRegistering(true);
      showStatus("Submitting registration...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.requestVoterRegistration(data.IpfsHash);
      await tx.wait();
      showStatus("Registration submitted! Awaiting admin approval.");
      setVoterStatus(1);
      setIdProofFile(null);
    } catch (err) {
      console.error(err); showStatus("Registration failed.", "#ef4444");
    } finally { setUploadingId(false); setRegistering(false); }
  }

  async function castVote(candidateId) {
    try {
      setVoting(true);
      showStatus("Waiting for MetaMask...", "#f59e0b");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.vote(candidateId);
      showStatus("Transaction submitted...", "#f59e0b");
      await tx.wait();
      showStatus("Vote cast successfully!");
      setHasVoted(true);
      await loadVotingData(provider, fullAddress);
    } catch (err) {
      console.error(err);
      showStatus("Vote failed. " + (err.reason || ""), "#ef4444");
    } finally { setVoting(false); }
  }

  const electionStatus = getElectionStatus();
  const statusLabels = ["Not Registered", "Pending Approval", "Approved", "Rejected"];
  const statusColors = ["#475569", "#f59e0b", "#22c55e", "#ef4444"];

  if (loading) return (
    <div className="voter-loading">
      <div className="loading-spinner" />
      <p>Loading voter dashboard...</p>
    </div>
  );

  return (
    <div className="voter-page">
      {/* Header */}
      <div className="voter-header">
        <div className="voter-brand">
          <div className="logo-mark" />
          <span>CivicChain</span>
        </div>
        <div className="wallet-pill">
          <span className="dot" style={{ background: statusColors[voterStatus] }} />
          {walletAddress}
          <span className="voter-status-tag" style={{
            color: statusColors[voterStatus],
            borderColor: statusColors[voterStatus] + "44",
            background: statusColors[voterStatus] + "18"
          }}>
            {statusLabels[voterStatus]}
          </span>
        </div>
      </div>

      {status && (
        <div className="global-status" style={{ color: statusColor, borderColor: statusColor + "33", background: statusColor + "11" }}>
          {status}
        </div>
      )}

      {/* Election status bar */}
      <div className="election-bar">
        <div className="election-bar-left">
          <span className="election-indicator" style={{ background: electionStatus.color, boxShadow: `0 0 8px ${electionStatus.color}` }} />
          <span className="election-label" style={{ color: electionStatus.color }}>{electionStatus.label}</span>
          {startTime && endTime && (
            <span className="election-time">{startTime.toLocaleString()} → {endTime.toLocaleString()}</span>
          )}
        </div>
        {resultsDeclared && winner && (
          <div className="winner-pill">
            🏆 Winner: <strong>{winner.name}</strong> · {winner.voteCount} votes
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="voter-tabs">
        <button className={`tab-btn ${activeTab === "vote" ? "active" : ""}`} onClick={() => setActiveTab("vote")}>
          Cast Vote
        </button>
        <button className={`tab-btn ${activeTab === "budget" ? "active" : ""}`} onClick={() => setActiveTab("budget")}>
          Budget Tracker
        </button>
      </div>

      <div className="voter-content">

        {activeTab === "vote" && (
          <div>
            {/* Registration states */}
            {voterStatus === 0 && (
              <div className="info-card register-card">
                <div className="info-card-icon">🪪</div>
                <div className="info-card-body">
                  <h3>Register to Vote</h3>
                  <p>Upload your government ID proof. An admin will verify and approve your registration.</p>
                  <div className="file-upload-row">
                    <label className="file-label">
                      <input type="file" accept="image/*,.pdf" onChange={e => setIdProofFile(e.target.files[0])} className="file-input-hidden" />
                      <span className="file-btn">{idProofFile ? idProofFile.name : "Choose ID File"}</span>
                    </label>
                    <button onClick={uploadIdAndRegister} disabled={uploadingId || registering || !idProofFile} className="register-btn">
                      {uploadingId ? "Uploading..." : registering ? "Registering..." : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {voterStatus === 1 && (
              <div className="info-card pending-card">
                <div className="info-card-icon">⏳</div>
                <div className="info-card-body">
                  <h3>Registration Pending</h3>
                  <p>Your ID has been submitted. An admin is reviewing your application — check back soon.</p>
                </div>
              </div>
            )}

            {voterStatus === 3 && (
              <div className="info-card rejected-card">
                <div className="info-card-icon">✕</div>
                <div className="info-card-body">
                  <h3>Registration Rejected</h3>
                  <p>Your voter registration was rejected. Please contact the election admin.</p>
                </div>
              </div>
            )}

            {hasVoted && (
              <div className="info-card voted-card">
                <div className="info-card-icon">✓</div>
                <div className="info-card-body">
                  <h3>Vote Recorded</h3>
                  <p>Your vote has been permanently recorded on the blockchain. Results are shown below.</p>
                </div>
              </div>
            )}

            {/* Candidates */}
            {candidates.length === 0 ? (
              <div className="empty-state">No candidates added yet. Check back soon.</div>
            ) : (
              <div className="candidates-grid">
                {candidates.map(c => (
                  <div key={c.id} className={`candidate-card ${hasVoted ? "has-voted" : ""}`}>
                    <div className="candidate-photo-wrap">
                      <img
                        src={c.photoCID.startsWith("http") ? c.photoCID : `https://gateway.pinata.cloud/ipfs/${c.photoCID}`}
                        alt={c.name}
                        onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${c.name}&background=6366f1&color=fff&size=100`; }}
                      />
                    </div>
                    <div className="candidate-info">
                      <h3>{c.name}</h3>
                      <div className="vote-stats">
                        <span>{c.voteCount} votes</span>
                        <span className="pct">{c.percentage}%</span>
                      </div>
                      <div className="vote-bar-track">
                        <div className="vote-bar-fill" style={{ width: `${c.percentage}%` }} />
                      </div>
                    </div>
                    <button
                      className={`vote-btn ${hasVoted ? "voted" : ""} ${voterStatus !== 2 ? "disabled" : ""}`}
                      onClick={() => castVote(c.id)}
                      disabled={voting || hasVoted || voterStatus !== 2}
                    >
                      {hasVoted ? "✓ Voted" : voting ? "Processing..." : voterStatus !== 2 ? "Not Approved" : "Vote"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "budget" && (
          <div>
            {/* Stats */}
            <div className="budget-stats-row">
              <div className="budget-stat-card">
                <div className="bsc-label">Contract Balance</div>
                <div className="bsc-value">{parseFloat(budgetBalance).toFixed(4)} <span>ETH</span></div>
              </div>
              <div className="budget-stat-card">
                <div className="bsc-label">Total Projects</div>
                <div className="bsc-value">{projects.length}</div>
              </div>
              <div className="budget-stat-card">
                <div className="bsc-label">Phases Released</div>
                <div className="bsc-value">{phaseEvents.length}</div>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="empty-state">No budget projects created yet.</div>
            ) : (
              projects.map(p => (
                <div key={p.id} className="project-card">
                  <div className="project-header">
                    <div>
                      <h3 className="project-name">{p.name}</h3>
                      <p className="project-contractor">
                        Contractor: <code>{p.contractor.slice(0, 8)}...{p.contractor.slice(-6)}</code>
                      </p>
                    </div>
                    <span className="project-phase-badge">Phase {p.currentPhase}</span>
                  </div>
                  <div className="phases-list">
                    {p.phaseNames.map((name, i) => (
                      <div key={i} className={`phase-row ${p.statuses[i] === 2 ? "released" : p.statuses[i] === 1 ? "submitted" : ""}`}>
                        <div className="phase-left">
                          <span className={`phase-dot ${p.statuses[i] === 2 ? "green" : p.statuses[i] === 1 ? "yellow" : "grey"}`} />
                          <span className="phase-name">{name}</span>
                        </div>
                        <div className="phase-right">
                          <span className="phase-budget">{p.phaseBudgets[i]} ETH</span>
                          <span className={`phase-status ${p.statuses[i] === 2 ? "s-released" : p.statuses[i] === 1 ? "s-submitted" : "s-pending"}`}>
                            {p.statuses[i] === 0 ? "Pending" : p.statuses[i] === 1 ? "Proof Submitted" : "Released"}
                          </span>
                          {p.evidenceCIDs[i] && (
                            <a href={`https://gateway.pinata.cloud/ipfs/${p.evidenceCIDs[i]}`} target="_blank" rel="noreferrer" className="proof-link">
                              View Proof ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            {phaseEvents.length > 0 && (
              <div className="release-history">
                <h3 className="section-title">Release History</h3>
                {phaseEvents.map((e, i) => (
                  <div key={i} className="release-item">
                    <div className="release-icon">↑</div>
                    <div className="release-details">
                      <span className="release-title">Project #{e.projectId} — Phase {e.phaseIndex}</span>
                      <span className="release-sub">{e.amount} ETH → {e.contractor.slice(0, 6)}...{e.contractor.slice(-4)}</span>
                    </div>
                    <a href={`https://sepolia.etherscan.io/tx/${e.hash}`} target="_blank" rel="noreferrer" className="tx-link">Tx ↗</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}