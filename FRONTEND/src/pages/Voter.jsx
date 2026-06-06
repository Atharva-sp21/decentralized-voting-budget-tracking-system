import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { VOTING_CONTRACT_ADDRESS, BUDGET_CONTRACT_ADDRESS } from "../contracts/contractConfig";
import { votingABI } from "../contracts/votingABI";
import { budgetABI } from "../contracts/BudgetABI";
import "../styles/Voter.css";

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET = import.meta.env.VITE_PINATA_SECRET;

const TABS = [
  { id: "vote",   label: "Cast Vote",      icon: "✓" },
  { id: "budget", label: "Budget Tracker", icon: "◎" },
];

const STATUS_LABELS = ["Not Registered", "Pending Approval", "Approved", "Rejected"];
const STATUS_COLORS = ["#475569", "#f59e0b", "#22c55e", "#ef4444"];

export default function Voter() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("info");
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
      let total = 0;
      for (let i = 1; i <= count; i++) {
        const c = await contract.candidates(i);
        total += Number(c.voteCount);
      }
      const list = [];
      for (let i = 1; i <= count; i++) {
        const c = await contract.candidates(i);
        list.push({
          id: c.id.toString(), name: c.name, photoCID: c.photoCID,
          voteCount: c.voteCount.toString(),
          percentage: total > 0 ? Math.round((Number(c.voteCount) / total) * 100) : 0
        });
      }
      setCandidates(list);
    } catch (err) { console.error("Voting data error:", err); }
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
          id: p.id.toString(), name: p.name, contractor: p.contractor,
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
    } catch (err) { console.error("Budget data error:", err); }
  }

  function showStatus(msg, type = "info") {
    setStatus(msg); setStatusType(type);
    setTimeout(() => setStatus(""), 4000);
  }

  function getElectionStatus() {
    if (!startTime || !endTime) return { label: "Not Scheduled", color: "#475569" };
    const now = new Date();
    if (now < startTime) return { label: "Upcoming", color: "#f59e0b" };
    if (now > endTime)   return { label: "Ended",    color: "#ef4444" };
    return { label: "Live", color: "#22c55e" };
  }

  async function uploadIdAndRegister() {
    if (!idProofFile) { showStatus("Select an ID proof file first.", "error"); return; }
    try {
      setUploadingId(true);
      showStatus("Uploading ID to IPFS...", "warn");
      const formData = new FormData();
      formData.append("file", idProofFile);
      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { pinata_api_key: PINATA_API_KEY, pinata_secret_api_key: PINATA_SECRET },
        body: formData,
      });
      const data = await res.json();
      if (!data.IpfsHash) { showStatus("Upload failed.", "error"); return; }
      setUploadingId(false);
      setRegistering(true);
      showStatus("Submitting registration...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.requestVoterRegistration(data.IpfsHash);
      await tx.wait();
      showStatus("Registration submitted — awaiting admin approval.", "success");
      setVoterStatus(1);
      setIdProofFile(null);
    } catch (err) {
      console.error(err);
      showStatus("Registration failed.", "error");
    } finally { setUploadingId(false); setRegistering(false); }
  }

  async function castVote(candidateId) {
    try {
      setVoting(true);
      showStatus("Waiting for MetaMask...", "warn");
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, signer);
      const tx = await contract.vote(candidateId);
      showStatus("Transaction submitted...", "warn");
      await tx.wait();
      showStatus("Vote recorded on-chain!", "success");
      setHasVoted(true);
      await loadVotingData(provider, fullAddress);
    } catch (err) {
      console.error(err);
      showStatus("Vote failed. " + (err.reason || ""), "error");
    } finally { setVoting(false); }
  }

  const electionStatus = getElectionStatus();

  if (loading) return (
    <div className="voter-loading">
      <div className="loading-spinner" />
      <p>Loading voter dashboard...</p>
    </div>
  );

  return (
    <div className="voter-shell">

      {/* ── Sidebar ── */}
      <aside className="voter-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 8L16 10.5V15.5L12 18L8 15.5V10.5L12 8Z" fill="currentColor" opacity="0.4"/>
            </svg>
          </div>

          {/* Election status */}
          <div className="sidebar-election-card">
            <div className="sec-row">
              <span className="sec-dot" style={{ background: electionStatus.color, boxShadow: `0 0 6px ${electionStatus.color}` }} />
              <span className="sec-label" style={{ color: electionStatus.color }}>{electionStatus.label}</span>
            </div>
            {startTime && (
              <div className="sec-time">{startTime.toLocaleDateString()}</div>
            )}
            {endTime && (
              <div className="sec-time">→ {endTime.toLocaleDateString()}</div>
            )}
          </div>

          {/* Voter status */}
          <div className="sidebar-status-card">
            <div className="ssc-label">Your Status</div>
            <div className="ssc-value" style={{ color: STATUS_COLORS[voterStatus] }}>
              {STATUS_LABELS[voterStatus]}
            </div>
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
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="wallet-info">
            <span className="wallet-dot" style={{ background: STATUS_COLORS[voterStatus] }} />
            <span className="wallet-addr">{walletAddress}</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="voter-main">

        {status && (
          <div className={`status-toast status-${statusType}`}>
            {statusType === "success" && "✓ "}{statusType === "error" && "✕ "}{statusType === "warn" && "⏳ "}
            {status}
          </div>
        )}

        {/* Winner banner */}
        {resultsDeclared && winner && (
          <div className="winner-banner">
            <span className="winner-trophy">🏆</span>
            <div>
              <div className="winner-label">Election Winner</div>
              <div className="winner-name">{winner.name}</div>
            </div>
            <div className="winner-votes">{winner.voteCount} votes</div>
          </div>
        )}

        {/* ── VOTE TAB ── */}
        {activeTab === "vote" && (
          <div className="tab-content">
            <div className="tab-header">
              <h1>{hasVoted ? "Your Vote" : "Cast Your Vote"}</h1>
              <p>
                {voterStatus === 0 && "Register to participate in this election."}
                {voterStatus === 1 && "Your registration is pending admin approval."}
                {voterStatus === 2 && !hasVoted && "Select a candidate and cast your vote."}
                {voterStatus === 2 && hasVoted && "Your vote has been permanently recorded on-chain."}
                {voterStatus === 3 && "Your registration was rejected. Contact the admin."}
              </p>
            </div>

            {/* Registration */}
            {voterStatus === 0 && (
              <div className="info-panel register-panel">
                <div className="ip-icon">🪪</div>
                <div className="ip-body">
                  <h3>Register to Vote</h3>
                  <p>Upload your government ID proof. An admin will verify and approve your registration.</p>
                  <div className="file-row">
                    <label className="file-label">
                      <input type="file" accept="image/*,.pdf" onChange={e => setIdProofFile(e.target.files[0])} className="file-hidden" />
                      <span className="file-pill">{idProofFile ? idProofFile.name : "Choose ID File"}</span>
                    </label>
                    <button onClick={uploadIdAndRegister} disabled={uploadingId || registering || !idProofFile} className="btn btn-primary">
                      {uploadingId ? "Uploading..." : registering ? "Registering..." : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {voterStatus === 1 && (
              <div className="info-panel pending-panel">
                <div className="ip-icon">⏳</div>
                <div className="ip-body">
                  <h3>Registration Pending</h3>
                  <p>Your ID has been submitted. An admin is reviewing your application — check back soon.</p>
                </div>
              </div>
            )}

            {voterStatus === 3 && (
              <div className="info-panel rejected-panel">
                <div className="ip-icon">✕</div>
                <div className="ip-body">
                  <h3>Registration Rejected</h3>
                  <p>Your registration was rejected. Please contact the election admin.</p>
                </div>
              </div>
            )}

            {hasVoted && (
              <div className="info-panel voted-panel">
                <div className="ip-icon">✓</div>
                <div className="ip-body">
                  <h3>Vote Recorded</h3>
                  <p>Your vote has been permanently recorded on the blockchain.</p>
                </div>
              </div>
            )}

            {/* Candidates */}
            {candidates.length === 0 ? (
              <div className="empty-state">No candidates added yet — check back soon.</div>
            ) : (
              <div className="candidates-grid">
                {candidates.map(c => (
                  <div key={c.id} className={`cand-card ${hasVoted ? "voted-state" : ""}`}>
                    <div className="cand-photo">
                      <img
                        src={c.photoCID.startsWith("http") ? c.photoCID : `https://gateway.pinata.cloud/ipfs/${c.photoCID}`}
                        alt={c.name}
                        onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=6c63ff&color=fff&size=100`; }}
                      />
                    </div>
                    <div className="cand-info">
                      <h3 className="cand-name">{c.name}</h3>
                      <div className="cand-stats">
                        <span>{c.voteCount} votes</span>
                        <span className="cand-pct">{c.percentage}%</span>
                      </div>
                      <div className="vote-bar">
                        <div className="vote-bar-fill" style={{ width: `${c.percentage}%` }} />
                      </div>
                    </div>
                    <button
                      className={`vote-btn ${hasVoted ? "btn-voted" : voterStatus !== 2 ? "btn-locked" : "btn-castable"}`}
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

        {/* ── BUDGET TAB ── */}
        {activeTab === "budget" && (
          <div className="tab-content">
            <div className="tab-header">
              <h1>Budget Tracker</h1>
              <p>Transparent on-chain fund management — every release is publicly auditable.</p>
            </div>

            <div className="budget-stat-row">
              <div className="bstat">
                <div className="bstat-label">Contract Balance</div>
                <div className="bstat-value">{parseFloat(budgetBalance).toFixed(4)} <span>ETH</span></div>
              </div>
              <div className="bstat">
                <div className="bstat-label">Total Projects</div>
                <div className="bstat-value">{projects.length}</div>
              </div>
              <div className="bstat">
                <div className="bstat-label">Phases Released</div>
                <div className="bstat-value">{phaseEvents.length}</div>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="empty-state">No budget projects created yet.</div>
            ) : (
              projects.map(p => (
                <div key={p.id} className="project-card">
                  <div className="proj-header">
                    <div>
                      <h3 className="proj-name">{p.name}</h3>
                      <p className="proj-contractor">
                        Contractor: <code>{p.contractor.slice(0, 8)}...{p.contractor.slice(-6)}</code>
                      </p>
                    </div>
                    <span className="proj-phase-badge">Phase {p.currentPhase}</span>
                  </div>
                  <div className="phases-list">
                    {p.phaseNames.map((name, i) => (
                      <div key={i} className={`phase-row ${p.statuses[i] === 2 ? "ph-released" : p.statuses[i] === 1 ? "ph-submitted" : ""}`}>
                        <div className="phase-l">
                          <span className={`phase-dot ${p.statuses[i] === 2 ? "pd-green" : p.statuses[i] === 1 ? "pd-yellow" : "pd-grey"}`} />
                          <span>{name}</span>
                        </div>
                        <div className="phase-r">
                          <span className="phase-budget">{p.phaseBudgets[i]} ETH</span>
                          <span className={`phase-status ps-${p.statuses[i]}`}>
                            {p.statuses[i] === 0 ? "Pending" : p.statuses[i] === 1 ? "Proof Submitted" : "Released"}
                          </span>
                          {p.evidenceCIDs[i] && (
                            <a href={`https://gateway.pinata.cloud/ipfs/${p.evidenceCIDs[i]}`} target="_blank" rel="noreferrer" className="proof-link">
                              Proof ↗
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
                <h2 className="section-title">Release History</h2>
                {phaseEvents.map((e, i) => (
                  <div key={i} className="release-row">
                    <div className="release-icon-wrap">↑</div>
                    <div className="release-info">
                      <span className="release-title">Project #{e.projectId} — Phase {e.phaseIndex}</span>
                      <span className="release-sub">{e.amount} ETH → {e.contractor.slice(0,6)}...{e.contractor.slice(-4)}</span>
                    </div>
                    <a href={`https://sepolia.etherscan.io/tx/${e.hash}`} target="_blank" rel="noreferrer" className="tx-link">Tx ↗</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}