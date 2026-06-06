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
  const [connectedAccount, setConnectedAccount] = useState("");

  // On mount: check if already connected but DO NOT auto-navigate
  useEffect(() => {
    async function checkExisting() {
      if (!window.ethereum) return;
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts(); // does NOT prompt
        if (accounts.length > 0) {
          setConnectedAccount(accounts[0]);
        }
      } catch (_) {}
    }
    checkExisting();

    // When account changes, come back to landing — don't reload in place
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

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not installed!");
      return;
    }
    try {
      setConnecting(true);
      setStatus("Requesting wallet access...");

      // Always prompt MetaMask so user can pick any account
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== 11155111) {
        setStatus("Wrong network — please switch to Sepolia (11155111).");
        setConnecting(false);
        return;
      }

      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();
      setConnectedAccount(userAddress);

      const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingABI, provider);
      const admins = await contract.getAdmins();
      const isAdmin = admins.map(a => a.toLowerCase()).includes(userAddress.toLowerCase());

      setStatus("Verified! Redirecting...");
      setTimeout(() => navigate(isAdmin ? "/admin" : "/voter"), 700);
    } catch (err) {
      console.error(err);
      setStatus("Connection failed — please try again.");
      setConnecting(false);
    }
  }

  async function switchAccount() {
    if (!window.ethereum) return;
    try {
      // This opens MetaMask's account switcher
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      // After they pick, reconnect
      await connectWallet();
    } catch (err) {
      console.error(err);
    }
  }

  const shortAddr = connectedAccount
    ? connectedAccount.slice(0, 6) + "..." + connectedAccount.slice(-4)
    : "";

  return (
    <div className="landing">
      {/* Ambient background */}
      <div className="landing-bg">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="bg-grid" />
      </div>

      {/* Nav */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <div className="nav-logo-hex">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 8L16 10.5V15.5L12 18L8 15.5V10.5L12 8Z" fill="currentColor" opacity="0.4"/>
            </svg>
          </div>
        </div>
        {connectedAccount && (
          <div className="nav-account">
            <span className="nav-dot" />
            <span>{shortAddr}</span>
            <button className="nav-switch-btn" onClick={switchAccount}>Switch</button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <main className="landing-hero">
        <div className="hero-eyebrow">
          <span className="eyebrow-dot" />
          <span>Ethereum · Sepolia Testnet</span>
        </div>

        <h1 className="hero-title">
          <span className="title-line">Elections that</span>
          <span className="title-line title-accent">no one can rig.</span>
        </h1>

        <p className="hero-desc">
          A decentralized voting system secured by a 3-admin multi-sig and timelock protection.
          Every vote, every decision — permanently on-chain.
        </p>

        <div className="hero-stats">
          <div className="hstat">
            <div className="hstat-num">3</div>
            <div className="hstat-label">Admin Multi-sig</div>
          </div>
          <div className="hstat-div" />
          <div className="hstat">
            <div className="hstat-num">2/3</div>
            <div className="hstat-label">Approval Threshold</div>
          </div>
          <div className="hstat-div" />
          <div className="hstat">
            <div className="hstat-num">2m</div>
            <div className="hstat-label">Timelock Delay</div>
          </div>
        </div>

        <div className="hero-actions">
          <button
            className={`connect-btn ${connecting ? "loading" : ""}`}
            onClick={connectWallet}
            disabled={connecting}
          >
            {connecting ? (
              <><span className="btn-spinner" />Connecting...</>
            ) : connectedAccount ? (
              <>Enter as {shortAddr} &rarr;</>
            ) : (
              <>Connect Wallet &rarr;</>
            )}
          </button>
          {connectedAccount && (
            <button className="switch-btn" onClick={switchAccount}>
              Switch Account
            </button>
          )}
        </div>

        {status && <p className="hero-status">{status}</p>}

        <p className="hero-footnote">
          Requires MetaMask &nbsp;·&nbsp; Sepolia Testnet &nbsp;·&nbsp; Chain ID 11155111
        </p>
      </main>

      {/* Feature strip */}
      <div className="feature-strip">
        {[
          { icon: "⬡", text: "3-of-3 multi-sig governance" },
          { icon: "⏱", text: "Timelock on all critical actions" },
          { icon: "🔗", text: "On-chain audit log" },
          { icon: "📦", text: "Phase-gated budget with IPFS proof" },
          { icon: "🛡", text: "Reentrancy-protected transfers" },
        ].map((f, i) => (
          <div className="fstrip-item" key={i}>
            <span className="fstrip-icon">{f.icon}</span>
            <span>{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}