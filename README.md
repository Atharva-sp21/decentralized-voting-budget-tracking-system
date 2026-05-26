# 🗳️ Decentralized Voting & Budget Tracker

![Project Banner](assets/banner.png)

## 🌟 Overview

The **Decentralized Voting & Budget Tracker** is a robust Web3 application designed to bring transparency, security, and accountability to community governance and financial management. Built on the Ethereum blockchain, this system ensures that every vote is tamper-proof and every penny spent is accounted for through phase-gated funding.

---

## 🚀 Key Features

### 1. Decentralized Voting System
- **Transparent Elections**: All votes are recorded on-chain, ensuring immutability and public verifiability.
- **Voter Verification**: Admin-controlled registration process to prevent Sybil attacks and ensure only verified citizens can vote.
- **Candidate Management**: Dynamic addition of candidates with photo support (via IPFS).
- **Automated Results**: Smart contract logic handle vote counting and winner declaration once the election ends.

### 2. Smart Budget Tracking
- **Phase-Gated Funding**: Projects are broken down into milestones. Funds are only released when milestones are met.
- **Proof of Work**: Contractors must submit evidence (IPFS CIDs of receipts, photos, or documents) to claim funding.
- **Real-time Balance**: Transparent view of public funds and contract balances.
- **Transaction History**: Complete immutable log of all incoming deposits and outgoing releases.

---

## 🛠️ Tech Stack

- **Frontend**: React.js, Vite, Framer Motion (Aesthetics), React Router DOM
- **Blockchain Interaction**: Ethers.js (v5.7.2)
- **Smart Contracts**: Solidity (^0.8.0)
- **Development Environment**: Hardhat
- **Storage**: IPFS (for candidate photos and project evidence)

---

## 💻 Getting Started

### Prerequisites

- **Node.js**: v16.x or higher
- **MetaMask**: Browser extension for wallet management
- **Git**: To clone the repository

### 1. Backend Setup (Smart Contracts)

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Start a local Hardhat node:

```bash
npx hardhat node
```

In a **new terminal**, deploy the smart contracts to the local network:

```bash
# Deploy Voting Contract
npx hardhat run scripts/deploy.js --network localhost

# Deploy Budget Contract
npx hardhat run scripts/deployBudget.js --network localhost
```

> [!TIP]
> Note down the contract addresses printed in the console. You will need them for the frontend configuration.

### 2. Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd FRONTEND
npm install
```

**Configure Contract Addresses:**
Open `FRONTEND/src/contracts/contractConfig.js` and update the addresses with the ones from the deployment step:

```javascript
export const VOTING_CONTRACT_ADDRESS = "YOUR_VOTING_ADDRESS_HERE";
export const BUDGET_CONTRACT_ADDRESS = "YOUR_BUDGET_ADDRESS_HERE";
```

Start the development server:

```bash
npm run dev
```

The app should now be running at `http://localhost:5173`.

---

## 🦊 MetaMask Configuration

To interact with the local blockchain:
1. Open MetaMask and add a **New Network**.
2. **Network Name**: Hardhat Local
3. **RPC URL**: `http://127.0.0.1:8545`
4. **Chain ID**: `31337`
5. **Currency Symbol**: `ETH`
6. **Import Accounts**: Copy private keys from the `hardhat node` console to import test accounts with 10,000 ETH.

---

## 🏗️ Project Structure

```text
├── FRONTEND/              # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Main views (Landing, Voting, Budget)
│   │   ├── contracts/     # ABIs and Config
│   │   └── styles/        # CSS Modules
├── backend/               # Hardhat project
│   ├── contracts/         # Solidity smart contracts
│   ├── scripts/           # Deployment scripts
│   └── test/              # Contract unit tests
└── assets/                # Design assets and images
```

---

## 🛡️ License

Distributed under the ISC License. See `LICENSE` for more information.

---
