# 🌍 AidShare: Blockchain Marketplace for Surplus Aid Trading

Welcome to AidShare, a decentralized platform built on the Stacks blockchain that connects NGOs to trade and redistribute surplus aid resources efficiently. In the real world, NGOs often face challenges with excess supplies (like food, medicine, or equipment) going to waste while others struggle with shortages. AidShare solves this by providing a transparent, trustless marketplace where surplus items can be listed, traded, and tracked on-chain, reducing waste and ensuring aid reaches those in need faster.

Using Clarity smart contracts, the system ensures immutable records, secure transactions, and automated processes without intermediaries.

## ✨ Features

🔗 NGO registration with on-chain verification  
📦 List surplus aid items with descriptions, quantities, and expiration dates  
💰 Token-based trading using a custom fungible token (AID) for payments  
🤝 Escrow for secure trades, releasing funds only on confirmation  
⭐ Reputation system to build trust among participants  
⚖️ Governance for community-driven updates and dispute resolution  
📈 Immutable tracking of aid distribution for transparency and audits  
🚫 Anti-fraud measures to prevent duplicate or invalid listings  

## 🛠 How It Works

**For NGO Sellers (Listing Surplus Aid)**  
- Register your NGO using the NGORegistry contract.  
- Mint or acquire AID tokens via the AidToken contract.  
- Create a listing in the SurplusListing contract with item details (e.g., hash of item manifest, quantity, location).  
- Set a price or enable auctions through the TradeEscrow contract.  

**For NGO Buyers (Acquiring Aid)**  
- Browse listings via off-chain interfaces querying the SurplusListing contract.  
- Initiate a trade by sending AID tokens to the TradeEscrow contract.  
- Confirm receipt using the DeliveryConfirmation contract, which releases escrow.  

**For All Users**  
- Rate completed trades in the ReputationSystem contract to build trust scores.  
- Participate in governance votes via the Governance contract for protocol upgrades.  
- Use the DisputeResolution contract for any conflicts, with on-chain arbitration.  

Transactions are atomic and secured by Stacks' Proof-of-Transfer consensus, anchored to Bitcoin for added security.

## 📑 Smart Contracts Overview

AidShare is composed of 8 Clarity smart contracts, each handling a specific aspect of the marketplace for modularity and security:

1. **NGORegistry.clar**: Handles NGO registration, verification (e.g., via STX address linking), and profile storage. Prevents unauthorized participation.  
2. **AidToken.clar**: A fungible token (SIP-010 compliant) for marketplace payments. Includes minting for verified NGOs and transfer functions.  
3. **SurplusListing.clar**: Allows creating, updating, and querying listings of surplus items. Stores hashes for item authenticity and metadata like quantity/expiration.  
4. **TradeEscrow.clar**: Manages escrow for trades, holding AID tokens until both parties confirm. Supports fixed-price sales and simple auctions.  
5. **DeliveryConfirmation.clar**: Tracks shipment and receipt confirmations. Integrates with off-chain logistics proofs (e.g., hashed delivery receipts).  
6. **ReputationSystem.clar**: Calculates and stores reputation scores based on trade ratings. Influences visibility in listings.  
7. **Governance.clar**: Enables DAO-style voting for parameter changes (e.g., fees) using AID tokens as voting power.  
8. **DisputeResolution.clar**: Handles disputes with timed arbitration periods and resolution by governance voters.

These contracts interact via public functions, ensuring composability. For example, a trade in TradeEscrow calls NGORegistry to verify participants and updates ReputationSystem post-completion.

## 🚀 Getting Started

1. Set up a Stacks wallet and acquire STX for gas fees.  
2. Deploy the contracts using the Clarity CLI or Hiro's tools.  
3. Build a frontend (e.g., with React) to interact with the contracts via @stacks/transactions.  
4. Test on the Stacks testnet before mainnet deployment.

This project promotes efficient aid distribution, potentially saving lives by minimizing waste in humanitarian efforts. Contributions welcome—fork and PR!