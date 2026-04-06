## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| **ConfidPay** | `0x5f5669b3CC1B83b3aA75f598Cb345889231BB224` |
| **MockConfidentEscrow** | `0x8573cb0699ED9Af67f31c63aE421FDEF5554F5ef` |
| **MockFHERC20 (USDC)** | `0xeCEFF42D397469E2D052277E241383737a3eDaB1` |

---

## What it does
ConfidPay is a privacy-native payroll and treasury rail for DAOs and Web3 teams. It allows fully encrypted salaries, bonuses, contractor payouts, and treasury movements where amounts, recipients, vesting schedules, and milestones stay encrypted during computation using Fhenix CoFHE. Payments are settled via confidential escrow with optional insurance coverage through ReineiraOS.

## The problem it solves
Public blockchains expose every salary and treasury flow, leading to social attacks, doxxing, tax leakage, MEV front-running on recurring payments, and making it impossible for institutions/RWA players to use on-chain rails due to compliance requirements.

## Technologies we used
- Fhenix CoFHE (euint128, euint64, FHE operations, coprocessor)
- ReineiraOS for confidential escrow and insurance
- Solidity 0.8.25 + Hardhat
- Next.js + wagmi + viem for frontend
- Arbitrum Sepolia testnet

## How we built it
Started with the cofhe-hardhat-starter, created ConfidPay contract with encrypted payroll storage, implemented 3 vesting types (Immediate, Linear, Cliff), added milestone tracking, integrated mock escrow contracts, and built a React frontend with wallet connection for end-to-end testing.

**Completed:**
- Phase 1: Create payroll with encrypted salary storage ✅
- Phase 2: Vesting (Immediate, Linear, Cliff) + Milestones ✅
- Phase 3: Frontend + Testnet deployment ✅
- 26 passing tests
- Deployed to Arbitrum Sepolia testnet

## What we learned
How powerful FHE is for privacy-by-design applications and how critical proper ACL management is when working with encrypted state. Key discoveries:
- Use `FHE.allow(value, employee)` NOT `FHE.allowSender()` for employee access
- Use `FHE.select()` for encrypted conditionals, never `if (FHE.eq(...))`
- `InEuint128.Constructor` for input types, `FHE.asEuint128()` for conversion
- Stack too deep issues solved with `viaIR: true`

## What's next for ConfidPay
- Real USDC integration with production ReineiraOS escrow
- Cross-chain funding (ETH → Arbitrum)
- Selective disclosure for auditors
- Real-time event listening via SDK
- Gas optimization and mainnet deployment
