# ConfidPay

**Privacy-native payroll system for DAOs and Web3 teams.**

ConfidPay lets teams pay salaries, bonuses, and contractors without revealing amounts or recipient details on the blockchain. Built on Fhenix CoFHE for confidential computations.

---

## 🎯 What is ConfidPay?

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

## 🔐 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                         ADMIN (DAO Treasury)                  │
│  • Creates encrypted payroll for employees                    │
│  • Sets vesting schedules (linear, cliff)                    │
│  • Adds and completes milestones                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ createPayroll(encryptedSalary, ...)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONFIDENTIAL SMART CONTRACT               │
│                                                              │
│  • Stores: encryptedSalary, encryptedStartTime               │
│  • Computes: vestedAmount, claimableAmount                 │
│  • All math happens on encrypted data                        │
│  • No one sees actual numbers (except employee)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ claimPayment()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        EMPLOYEE (Team Member)                │
│  • Can only decrypt their own payroll info                  │
│  • Claims payments when due                                 │
│  • No one else knows the amounts                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Features

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

### Phase 3: Frontend & Testnet (Future)
- React/Next.js frontend
- Wallet integration (MetaMask, etc.)
- Deploy to Arbitrum Sepolia testnet
- Real USDC integration via ReineiraOS

---

## 🏗️ Architecture

### Contract Structure

```
contracts/
├── ConfidPay.sol              # Main payroll contract
├── interfaces/
│   └── IFHERC20.sol          # Token interface
└── mock/
    └── MockFHERC20.sol        # Mock for testing
```

### Core Components

| Contract | Purpose |
|----------|---------|
| `ConfidPay.sol` | Main payroll logic, encrypted storage |
| `IFHERC20.sol` | Interface for confidential token transfers |
| `MockFHERC20.sol` | Mock token for local testing |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Fhenix (FHE Coprocessor) |
| Smart Contracts | Solidity 0.8.25 |
| FHE Library | `@fhenixprotocol/cofhe-contracts` |
| SDK | `@cofhe/sdk` |
| Testing | Hardhat + Mocha |
| Payment Rails | ReineiraOS (future) |

### FHE Type Support
- `euint128` - Maximum for monetary values (USDC with 6 decimals)
- `euint64` - For timestamps (covers dates until year 292277026596)
- `InEuint128/64` - Input types for encrypted parameters

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm (or npm)

### Installation

```bash
# Clone the repository
git clone https://github.com/confidpay/ConfidPay-Starter.git
cd ConfidPay-Starter

# Install dependencies
pnpm install

# Compile contracts
pnpm compile
```

### Run Tests

```bash
# Run all tests with mock FHE environment
pnpm test

# Or with gas reporting
REPORT_GAS=true pnpm test
```

### Expected Output

```
✓ cofhe-hardhat-plugin :: deploy mocks

  ConfidPay
    Deployment
      ✔ Should set admin correctly
      ✔ Should set confidential token correctly
    Create Payroll
      ✔ Should create payroll as admin
      ✔ Should create payroll with Linear vesting
      ✔ Should create payroll with Cliff vesting
      ...
    
  26 passing (11s)
```

---

## 📖 Usage

### 1. Create Payroll (Admin)

```typescript
import { Encryptable } from '@cofhe/sdk';

// Encrypt salary and interval
const [encryptedSalary] = await cofheClient
  .encryptInputs([Encryptable.uint128(100_000_000n)]) // 100 USDC
  .execute();

const [encryptedInterval] = await cofheClient
  .encryptInputs([Encryptable.uint64(30n * 24n * 60n * 60n)]) // 30 days
  .execute();

// Create payroll
await confidPay.createPayroll(
  employeeAddress,
  encryptedSalary,
  encryptedInterval,
  vestingType,        // 0=Immediate, 1=Linear, 2=Cliff
  vestingDuration,    // seconds
  cliffDuration       // seconds
);
```

### 2. View Payroll (Employee)

```typescript
// Get encrypted payroll info
const payrollInfo = await confidPay.getMyPayrollInfo();

// Decrypt using SDK
const decryptedSalary = await cofheClient
  .decryptForView(payrollInfo.salary, FheTypes.Uint128)
  .execute();

console.log(`Your salary: ${decryptedSalary} USDC`);
```

### 3. Claim Payment

```typescript
// Employee claims payment when due
await confidPay.claimPayment();
```

### 4. Milestones

```typescript
// Admin adds milestone
await confidPay.addMilestone(
  employeeAddress,
  milestoneId,
  encryptedBonusAmount
);

// Admin completes milestone
await confidPay.completeMilestone(employeeAddress, milestoneIndex);

// Employee claims milestone payment
await confidPay.claimMilestone(milestoneIndex);
```

---

## 🔒 Security

### ACL (Access Control List)

Every encrypted variable MUST have proper ACL permissions:

| Function | Purpose |
|----------|---------|
| `FHE.allowThis(value)` | Grant contract access |
| `FHE.allow(value, address)` | Grant specific address access |
| `FHE.allowSender(value)` | Grant caller access |

### Critical Rules
1. ❌ Never forget ACL on encrypted values
2. ❌ Never use `FHE.decrypt()` (deprecated)
3. ✅ Use `FHE.allowPublic()` + off-chain decryption for viewing
4. ✅ Use `FHE.select()` for encrypted conditionals

### Privacy Guarantees
- Salaries are encrypted (euint128) on-chain
- Only the employee can decrypt their own data
- Admins see encrypted values only
- Public blockchain sees ciphertext handles

---

## 📁 Project Structure

```
ConfidPay-Starter/
├── contracts/
│   ├── ConfidPay.sol              # Main contract
│   ├── Counter.sol                 # Example FHE contract
│   ├── interfaces/
│   │   └── IFHERC20.sol          # Token interface
│   └── mock/
│       └── MockFHERC20.sol        # Mock token
├── test/
│   ├── ConfidPay.test.ts          # Phase 1 & 2 tests
│   └── Counter.test.ts            # Example tests
├── tasks/                         # Hardhat tasks
├── hardhat.config.ts              # Hardhat configuration
├── package.json
└── README.md
```

---

## 🧪 Testing

### Local Testing
```bash
pnpm test
```
Runs against mock FHE environment (fast iteration).

### Test Coverage
- Deployment tests
- Create payroll (all vesting types)
- Milestone management
- Access control
- Error handling

---

## 🚢 Deployment

### Testnet (Arbitrum Sepolia)

1. Configure `hardhat.config.ts`:
```typescript
networks: {
  'arb-sepolia': {
    url: process.env.ARB_SEPOLIA_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 421614,
  }
}
```

2. Deploy contracts:
```bash
npx hardhat deploy --network arb-sepolia
```

3. Verify on Arbiscan:
```bash
npx hardhat verify --network arb-sepolia <CONTRACT_ADDRESS>
```

---

## 🔮 Future Roadmap

### Phase 3: Frontend & Integration
- [ ] Next.js/React frontend
- [ ] Wallet connection (MetaMask, WalletConnect)
- [ ] Deploy to Arbitrum Sepolia
- [ ] Integrate ReineiraOS for production payments

### Phase 4: Advanced Features
- [ ] Multi-signature admin controls
- [ ] On-chain governance for payroll proposals
- [ ] Cross-chain payment support
- [ ] Real USDC integration

---

## 📚 Resources

### Fhenix Documentation
- [CoFHE Docs](https://cofhe-docs.fhenix.zone/)
- [FHE Library](https://cofhe-docs.fhenix.zone/fhe-library/introduction/overview)
- [Client SDK](https://cofhe-docs.fhenix.zone/client-sdk/introduction/overview)

### ReineiraOS
- [Documentation](https://docs.reineira.xyz/)
- [SDK](https://www.npmjs.com/package/@reineira-os/sdk)

---

## ⚠️ Disclaimer

This is alpha software. Do not use in production without auditing:
- Smart contracts handle real funds
- FHE implementations may have vulnerabilities
- ACL errors can permanently lock funds
- Always test on testnet first

---

## 📄 License

MIT

---

## 🙏 Credits

Built with [Fhenix CoFHE](https://fhenix.io/)  
Payment rails by [ReineiraOS](https://reineira.xyz/)
