# ConfidPay

**Privacy-native payroll system for DAOs and Web3 teams.**

ConfidPay lets teams pay salaries, bonuses, and contractors without revealing amounts or recipient details on the blockchain. Built on Fhenix CoFHE for confidential computations.

---

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/confidpay/ConfidPay-Starter.git
cd ConfidPay-Starter/cofhe-hardhat-starter
npm install

# 2. Run tests
npm test
# Expected: 26 passing

# 3. Run frontend
cd frontend && npm install && npm run dev
# Open http://localhost:3000
```

## Already Deployed (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| ConfidPay | `0x5f5669b3CC1B83b3aA75f598Cb345889231BB224` |
| Escrow | `0x8573cb0699ED9Af67f31c63aE421FDEF5554F5ef` |
| USDC | `0xeCEFF42D397469E2D052277E241383737a3eDaB1` |

---

## What is ConfidPay?

ConfidPay is a smart contract system that stores encrypted salaries, vesting rules, and payment schedules on-chain. The blockchain never sees actual amounts — only the contract can compute on encrypted data.

### The Problem
On public blockchains (Ethereum, Base), every transaction, salary, and recipient is visible to everyone. This is problematic for:
- DAOs paying competitive salaries
- Teams with privacy-sensitive compensation
- Businesses that don't want to reveal financial details

### The Solution
ConfidPay uses **Fully Homomorphic Encryption (FHE)** to:
- Store salaries encrypted on-chain
- Calculate vesting without decrypting
- Release payments based on time/conditions
- Keep everything private by default

---

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| **ConfidPay** | `0x5f5669b3CC1B83b3aA75f598Cb345889231BB224` |
| **MockConfidentEscrow** | `0x8573cb0699ED9Af67f31c63aE421FDEF5554F5ef` |
| **MockFHERC20 (USDC)** | `0xeCEFF42D397469E2D052277E241383737a3eDaB1` |

---

## Features

### Phase 1: Create Payroll ✅
- Admin creates private payroll for any employee
- Encrypted salary storage (euint128)
- Employee can view their own encrypted payroll info
- Access control ensures only employee can decrypt their data

### Phase 2: Vesting & Milestones ✅
- **3 Vesting Types:**
  - **Immediate** - Full amount available from start
  - **Linear** - Vests gradually over time
  - **Cliff** - Nothing until cliff, then linear
- **Time-based payments** - Employees claim when payment is due
- **Milestones** - Bonus payments for completed tasks

### Phase 3: Frontend & Testnet ✅
- React/Next.js frontend
- Wallet integration (via wagmi)
- Deployed to Arbitrum Sepolia testnet
- Mock escrow and USDC for testing

---

## Architecture

### Contract Structure

```
contracts/
├── ConfidPay.sol              # Main payroll contract
├── interfaces/
│   └── IFHERC20.sol          # Token interface
└── mock/
    ├── MockFHERC20.sol        # Mock token
    ├── MockConfidentEscrow.sol # Mock escrow
    └── MockInsuranceManager.sol # Mock insurance
```

### Core Components

| Contract | Purpose |
|----------|---------|
| `ConfidPay.sol` | Main payroll logic, encrypted storage |
| `IFHERC20.sol` | Interface for confidential token transfers |
| `MockFHERC20.sol` | Mock token for local testing |
| `MockConfidentEscrow.sol` | Mock escrow for payment flows |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Fhenix (FHE Coprocessor) |
| Smart Contracts | Solidity 0.8.25 |
| FHE Library | `@fhenixprotocol/cofhe-contracts` |
| SDK | `@cofhe/sdk` |
| Frontend | Next.js + wagmi + viem |
| Testing | Hardhat + Mocha |
| Payment Rails | ReineiraOS (mock) |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Testnet ETH on Arbitrum Sepolia

### Installation

```bash
# Clone the repository
git clone https://github.com/confidpay/ConfidPay-Starter.git
cd ConfidPay-Starter/cofhe-hardhat-starter

# Install dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Run Tests

```bash
npm test
```

Expected: **26 passing tests**

### Run Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` and connect your wallet.

---

## Deployment

### Deploy to Arbitrum Sepolia

```bash
# Configure .env
echo "PRIVATE_KEY=your_key" > .env
echo "ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc" >> .env

# Deploy
npx hardhat run scripts/deploy.ts --network arb-sepolia
```

### Update Frontend

After deployment, update `frontend/.env.local`:
```
NEXT_PUBLIC_CONFIDPAY_ADDRESS=your_confidpay_address
NEXT_PUBLIC_ESCROW_ADDRESS=your_escrow_address
NEXT_PUBLIC_USDC_ADDRESS=your_usdc_address
```

---

## Frontend Usage

### Connect Wallet
1. Open the app at `http://localhost:3000`
2. Click "Connect" to connect your wallet (MetaMask or injected)

### Admin: Create Payroll
1. Enter employee address
2. Enter monthly salary (USDC)
3. Select vesting type (Immediate/Linear/Cliff)
4. Click "Create Payroll"

### Employee: Claim Payment
1. Click "Claim Payment" to create escrow
2. Funds will be held in escrow until released

---

## Security

### ACL (Access Control List)

Every encrypted variable MUST have proper ACL permissions:

| Function | Purpose |
|----------|---------|
| `FHE.allowThis(value)` | Grant contract access |
| `FHE.allow(value, address)` | Grant specific address access |

### Critical Rules
1. Always set `FHE.allowThis()` for contract access
2. Always use `FHE.allow(value, employee)` for employee access
3. Use `FHE.select()` for encrypted conditionals
4. Never use `if (FHE.eq(...))` - use `FHE.select()` instead

---

## Project Structure

```
cofhe-hardhat-starter/
├── contracts/
│   ├── ConfidPay.sol              # Main contract
│   ├── interfaces/
│   │   └── IFHERC20.sol          # Token interface
│   └── mock/
│       ├── MockFHERC20.sol
│       ├── MockConfidentEscrow.sol
│       └── MockInsuranceManager.sol
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Main dashboard
│   │   └── providers.tsx          # Web3 providers
│   ├── lib/
│   │   ├── wagmi.ts              # Wallet config
│   │   └── config.ts             # Contract addresses
│   └── package.json
├── scripts/
│   └── deploy.ts                 # Deployment script
└── test/
    └── ConfidPay.test.ts         # 26 tests
```

---

## Resources

### Documentation
- [ConfidPay Docs](https://confidpay.github.io/docs)
- [Fhenix CoFHE Docs](https://cofhe-docs.fhenix.zone/)
- [ReineiraOS Docs](https://docs.reineira.xyz/)

### Fhenix Documentation
- [CoFHE Library](https://cofhe-docs.fhenix.zone/fhe-library)
- [Client SDK](https://cofhe-docs.fhenix.zone/client-sdk)

---

## Disclaimer

This is alpha software. Always test on testnet first.

---

## License

MIT

---

Built with [Fhenix CoFHE](https://fhenix.io/)  
Payment rails by [ReineiraOS](https://reineira.xyz/)
