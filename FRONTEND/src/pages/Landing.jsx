import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { VOTING_CONTRACT_ADDRESS } from "../contracts/contractConfig";
import { votingABI } from "../contracts/votingABI";
import "../styles/Landing.css";

export default function Landing() {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => window.location.reload());
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not installed!");
      return;
    }
    try {
      setConnecting(true);
      setStatus("Requesting wallet access...");

      await window.ethereum.request({ method: "eth_requestAccounts" });

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      if (chainId !== 11155111) {
        alert("Please switch MetaMask to Sepolia Testnet (11155111)");
        setStatus("Wrong network! Please switch to Sepolia.");
        setConnecting(false);
        return;
      }

      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, provider);
      
      // Check if user is one of the 3 admins
      const admins = await contract.getAdmins();
      const isAdmin = admins.map(a => a.toLowerCase()).includes(userAddress.toLowerCase());

      setStatus("Connected! Redirecting...");

      if (isAdmin) {
        setTimeout(() => navigate("/admin"), 800);
      } else {
        setTimeout(() => navigate("/voter"), 800);
      }

    } catch (err) {
      console.error(err);
      setStatus("Connection failed. Please try again.");
      setConnecting(false);
    }
  }

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="nav-logo">
          <div className="logo-mark" />
          <span>CivicChain</span>
        </div>
        <div className="nav-links">
          <a href="https://sepolia.etherscan.io/address/0x7DD647c76f81ecdB20AFA88AbC72C3F789077c44" target="_blank" rel="noreferrer">Contract</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </nav>

      <div className="landing-body">
        <div className="landing-left">
          <div className="eyebrow">Built on Ethereum · Sepolia Testnet</div>
          <h1 className="landing-title">
            Elections that<br />
            <span className="title-accent">no one can rig.</span>
          </h1>
          <p className="landing-desc">
            A decentralized voting system governed by a 3-admin multi-sig with timelock protection. Every vote, every decision — permanently on-chain.
          </p>

          <div className="stat-row">
            <div className="stat">
              <div className="stat-num">3</div>
              <div className="stat-label">Admin Multi-sig</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-num">2/3</div>
              <div className="stat-label">Approval Threshold</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-num">2m</div>
              <div className="stat-label">Timelock Delay</div>
            </div>
          </div>

          <button
            className={`connect-btn ${connecting ? "loading" : ""}`}
            onClick={connectWallet}
            disabled={connecting}
          >
            {connecting ? (
              <><span className="btn-spinner" /> Connecting...</>
            ) : (
              <>Connect Wallet &rarr;</>
            )}
          </button>

          {status && <p className="status-msg">{status}</p>}
          <p className="network-note">Requires MetaMask · Sepolia Testnet · Chain ID 11155111</p>
        </div>

        <div className="landing-right">
          <div className="chain-card">
            <div className="chain-card-header">
              <div className="chain-dot green" />
              <span>Live on Sepolia</span>
            </div>
            <div className="chain-item">
              <span className="chain-label">Voting Contract</span>
              <a className="chain-addr" href="https://sepolia.etherscan.io/address/0x7DD647c76f81ecdB20AFA88AbC72C3F789077c44" target="_blank" rel="noreferrer">
                0x7DD6...7c44 ↗
              </a>
            </div>
            <div className="chain-item">
              <span className="chain-label">Budget Contract</span>
              <a className="chain-addr" href="https://sepolia.etherscan.io/address/0x71D679354E0c12fB6e1B03FB300d704dddAF04A8" target="_blank" rel="noreferrer">
                0x71D6...04A8 ↗
              </a>
            </div>
            <div className="chain-divider" />
            <div className="chain-feature-list">
              <div className="chain-feature">
                <span className="cf-icon">✦</span>
                <span>3-of-3 admin multi-sig governance</span>
              </div>
              <div className="chain-feature">
                <span className="cf-icon">✦</span>
                <span>Timelock on all critical actions</span>
              </div>
              <div className="chain-feature">
                <span className="cf-icon">✦</span>
                <span>On-chain audit logs for every action</span>
              </div>
              <div className="chain-feature">
                <span className="cf-icon">✦</span>
                <span>Phase-gated budget with IPFS proof</span>
              </div>
              <div className="chain-feature">
                <span className="cf-icon">✦</span>
                <span>Reentrancy-protected fund transfers</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}