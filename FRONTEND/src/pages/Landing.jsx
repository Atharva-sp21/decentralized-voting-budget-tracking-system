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

      if (chainId !== 31337 && chainId !== 1337) {
        alert("Please switch MetaMask to Hardhat Localhost (31337)");
        setStatus("Wrong network!");
        setConnecting(false);
        return;
      }

      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      // Check if user is owner (admin)
      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, provider);
      const ownerAddress = await contract.admin();

      setStatus("Connected! Redirecting...");

      if (ownerAddress.toLowerCase() === userAddress.toLowerCase()) {
        // Owner → Admin Dashboard
        setTimeout(() => navigate("/admin"), 800);
      } else {
        // Everyone else → Voter Dashboard
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
      <div className="bg-grid" />
      <div className="bg-glow" />

      <div className="landing-content">
  
        <h1 className="landing-title">
          Decentralized Voting<br />
          <span className="gradient-text">System</span>
        </h1>

        <p className="landing-desc">
          Transparent, tamper-proof voting and budget tracking
          built on blockchain technology. Your vote is immutable.
        </p>

        <div className="features">
          <div className="feature">
            <span className="feature-icon">🔒</span>
            <span>Tamper-proof</span>
          </div>
          <div className="feature">
            <span className="feature-icon">👁</span>
            <span>Transparent</span>
          </div>
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Instant Results</span>
          </div>
        </div>

        <button
          className={`landing-btn ${connecting ? "connecting" : ""}`}
          onClick={connectWallet}
          disabled={connecting}
        >
          {connecting ? (
            <><span className="spinner" /> Connecting...</>
          ) : (
            <>Connect Wallet to Vote &rarr;</>
          )}
        </button>

        {status && <p className="landing-status">{status}</p>}

        <p className="metamask-note">
          Requires MetaMask on Hardhat Localhost (Chain ID: 31337)
        </p>
      </div>
    </div>
  );
}
