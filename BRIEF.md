# Builder Brief — ReineiraOS

---

## 1. Identity

- **Venture name:** ConfidPay
- **One-liner:** Privacy-native payroll system for DAOs using FHE-encrypted escrow payments
- **Domain:** Confidential programmable finance (FHE-encrypted settlement)
- **Protocol:** ReineiraOS on Arbitrum (Fhenix CoFHE)
- **Stage:** MVP

---

## 2. Problem

- DAOs leak salary information publicly — contributor payouts are visible on-chain, revealing competitive compensation data
- Traditional payroll systems expose employee salaries to HR/departments who don't need visibility
- Token grants and vesting schedules are transparent, making it easy to front-run contributor movements
- Existing crypto payroll (Superfluid, Request Network) exposes all payment amounts on-chain
- Our edge: FHE-encrypted escrow payments keep salary amounts private from everyone except payer and payee, while still settling on-chain

---

## 3. Product

**Core features** (order by priority):

1. Payroll schedule creation with encrypted salary amounts
2. Contributor management with role-based permissions
3. Automated recurring payments via escrow release
4. Vesting schedule support with time-locked token grants
5. Payroll analytics dashboard (anonymized/aggregated only)

**User flow:**

DAO admin creates payroll schedule → adds contributors with encrypted FHE salary amounts → 
schedule triggers → escrow locks payment → contributor claims → funds released → repeat on schedule

**Architecture (AA + BE Connectors):**

```
Frontend (React + ZeroDev) → Smart Account (AA) → Protocol
Backend (Clean Architecture) → BE Connectors → Protocol (NO SDK on BE)
```

**Tech stack** (pre-filled — adjust if needed):

- **Smart contracts:** Solidity ^0.8.24 on Arbitrum Sepolia (via `reineira-code`)
- **Frontend:** React 19 + TypeScript + Vite + Zustand + TanStack Router + TailwindCSS + ZeroDev (via
  `platform-modules/app`)
- **Backend:** TypeScript + Clean Architecture, DB-agnostic (via `platform-modules/backend`)
- **Wallet (primary):** ZeroDev — ERC-4337 smart accounts, passkey auth
- **Encryption:** Fhenix CoFHE (FHE on-chain), cofhejs for client-side encryption
- **Settlement:** Stablecoin-agnostic (IFHERC20) — supports any wrapped stablecoin
- **Cross-chain:** CCTP v2 (USDC cross-chain transfers)
- **Verification:** Reclaim Protocol (zkTLS) for compliance receipts
- **Deploy:** Hardhat (contracts), Vercel (apps — fastest path)

**Key architectural decisions:**
- **NO SDK on backend** — use AA + BE Connectors for protocol interactions (faster, non-custodial)
- **Client-side FHE encryption** — cofhejs runs in frontend, encrypted data sent to contract
- **ZeroDev for user ops** — smart accounts handle transaction signing, passkey auth

**Key integrations:**

- ReineiraOS ConfidentialEscrow contract
- ZeroDev smart accounts (primary wallet)
- Reclaim Protocol zkTLS proofs (optional compliance)
- CCTP v2 for cross-chain USDC deposits

**Data entities:**

- PayrollSchedules (dao, name, token, frequency, nextRun, status)
- Contributors (dao, wallet, role, encryptedSalary, paymentToken, status)
- VestingGrants (contributor, amount, startTime, cliff, duration, claimed, encrypted)
- Escrows (encrypted: owner, amount, paidAmount, isRedeemed) — from protocol
- Users (wallet, dao membership, role) — from protocol

**What exists already:**

- ConfidPay.sol (payroll contract) deployed on Arbitrum Sepolia
- MockConfidentEscrow.sol for testing escrow integration
- MockFHERC20.sol (mock USDC) deployed on Arbitrum Sepolia
- 31 passing tests for core payroll functionality
- Starter Next.js frontend with tabs UI (needs migration to platform-modules/app)
- Backend skeleton (needs migration to platform-modules/backend)

**Contract addresses (Arbitrum Sepolia):**
- ConfidPay: `0x5f5669b3CC1B83b3aA75f598Cb345889231BB224`
- MockConfidentEscrow: `0x8573cb0699ED9Af67f31c63aE421FDEF5554F5ef`
- MockFHERC20: `0xeCEFF42D397469E2D052277E241383737a3eDaB1`

---

## 4. Business

**Revenue model:**

- Platform fee: 0.5% on each payroll release
- Subscription tier: $49/mo for advanced analytics, multi-sig controls, API access
- Enterprise: custom pricing for large DAOs

**Pricing:** 0.5% per release, free tier up to $10,000/mo volume

**Key metrics:**

- GMV (total payroll volume) through escrows
- Number of active DAOs
- Monthly active contributors paid
- Average payroll size
- Payment completion rate
- Retention rate (DAOs returning)

**Growth channels:**

- DAO ecosystem partnerships (Llama, DeepDAO, Messari)
- Developer community (hackathons, grants, ETHGlobal)
- Web3 Twitter / Farcaster / Lens
- Content marketing (privacy in web3 payroll guides)
- Direct outreach to established DAOs

**First 100 users:**

Target established DAOs with 5-50 contributors doing recurring payments. Pilot with 5 DAOs on testnet. Mainnet launch with zero-fee first quarter.

---

## 5. Team

- **Size:** 2-person team
- **Strengths:** Solidity, product, DAO operations
- **Gaps:** marketing, design, business development
- **Working style:** Ship fast, iterate on feedback

---

## 6. Constraints

- **Budget:** bootstrapped
- **Timeline:** Testnet MVP by May 2026, mainnet by August 2026
- **Regulatory:** MiCA (EU), AML/KYC for fiat ramps, GDPR if EU users, tax reporting for token vesting
- **Locked-in decisions:**
  - Must build on ReineiraOS protocol (Arbitrum + Fhenix CoFHE)
  - Stablecoin-agnostic settlement (IFHERC20 — any wrapped stablecoin)
  - ZeroDev smart accounts as primary wallet (passkey auth)
  - Smart contracts must be UUPS upgradeable

---

## 7. Branding

- **App name:** ConfidPay
- **Tagline:** Private payroll for public teams
- **Colors:**
  - Primary: #6366F1
  - Secondary: #4F46E5
  - Accent: #10B981
  - Background: #0F172A
  - Surface: #1E293B
  - Success: #10B981
  - Error: #EF4444
  - Warning: #F59E0B
- **Typography:** Inter
- **Border radius:** 12px
- **Mode:** dark
- **Logo:** (none — use text logo)

---

## 8. Priorities

1. Migrate frontend to platform-modules/app (ZeroDev smart accounts, cofhejs for FHE encryption)
2. Migrate backend to platform-modules/backend with Clean Architecture (NO SDK — use BE Connectors)
3. Implement payroll schedule + contributor management with escrowed payments
4. Wire end-to-end flow: Frontend → ZeroDev AA → BE Connectors → ConfidentialEscrow
