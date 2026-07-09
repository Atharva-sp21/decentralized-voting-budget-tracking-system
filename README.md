# Decentralized Voting & Budget Tracking System

A fully on-chain voting and budget tracking dApp built on Ethereum Sepolia Testnet. The system is designed for transparent election handling, voter verification, project budget tracking, and controlled fund release through admin approval.

The app uses MetaMask for wallet login, IPFS for document/proof storage, and smart contracts for recording votes, approvals, budget releases, and governance actions on-chain.

## Live Deployment

[decentralized-voting-budget-trackin.vercel.app](https://decentralized-voting-budget-trackin.vercel.app/)

## About the Project

This project combines decentralized voting with budget monitoring. Voters can register, upload ID proof, get approved by admins, and cast votes directly through the blockchain. Along with voting, the system also tracks public project budgets, phase-wise fund allocation, contractor proof submission, and fund release history.

Admin access is restricted to the existing admin wallet IDs already configured in the project/smart contract. Any wallet that is not part of the admin list will be treated as a voter.

The goal of the project is to make voting and budget-related decisions more transparent, traceable, and resistant to tampering.

## Project Outcomes

This project delivers:

- A deployed blockchain-based voting and budget tracking dApp
- MetaMask wallet-based login
- Separate dashboards for admins and voters
- Voter registration with ID proof upload to IPFS
- Admin approval or rejection of voter requests
- On-chain candidate and election management
- Single-vote enforcement for approved voters
- Public result visibility after election completion
- Budget project creation with phase-wise ETH allocation
- Contractor proof submission using IPFS
- On-chain fund release tracking
- 2-of-3 admin multi-sig approval for critical actions
- Timelock protection before executing sensitive admin actions
- Smart contract deployment on Sepolia Testnet

## Features

### Voting

- Voter registration with IPFS ID proof upload
- Admin approval and rejection of voter requests
- Candidate management through multi-sig approval
- Election start and end time stored on-chain
- One vote per approved wallet
- Vote records stored permanently on-chain
- Election results declared after the voting period ends

### Budget Tracking

- Admins can create budget projects
- Projects can be divided into multiple phases
- ETH is locked in the contract for each phase
- Contractors can submit completion proof through IPFS
- Admins can verify work and release funds
- Fund release history is visible on-chain
- Reentrancy protection for ETH transfers

### Governance

- Critical actions use a 2-of-3 admin multi-sig flow
- At least 2 out of 3 admins must approve before execution
- A timelock is applied before execution
- Actions are tracked using a shared `bytes32` action key
- Admin wallets are predefined and cannot be created from the app

## How to Use the Deployed App

Open the app:

[https://decentralized-voting-budget-trackin.vercel.app/](https://decentralized-voting-budget-trackin.vercel.app/)

## Requirements

Before using the app, make sure you have:

- Chrome, Brave, Edge, or Firefox
- MetaMask browser extension
- A MetaMask wallet account
- Sepolia Testnet selected in MetaMask
- Some Sepolia ETH for gas fees

## Step 1: Install MetaMask

1. Go to [https://metamask.io](https://metamask.io)
2. Download and install the browser extension.
3. Create a new wallet or import an existing wallet.
4. Set a strong password.
5. Save your Secret Recovery Phrase safely.

Never share your Secret Recovery Phrase with anyone.

## Step 2: Switch to Sepolia Testnet

This project runs on Sepolia Testnet.

1. Open MetaMask.
2. Click the network dropdown at the top.
3. Enable test networks if Sepolia is not visible.
4. Select `Sepolia`.

If Sepolia is not listed, add it manually:

```txt
Network Name: Sepolia
RPC URL: https://rpc.sepolia.org
Chain ID: 11155111
Currency Symbol: ETH
Block Explorer: https://sepolia.etherscan.io
