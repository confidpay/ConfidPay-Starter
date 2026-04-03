Docs›API Reference›Contracts 

Contracts 

All ReineiraOS contracts deployed on Arbitrum Sepolia. Addresses are baked into the SDK — no manual configuration needed. 

4 min read 

Testnet deployment 

All contracts below are deployed on Arbitrum Sepolia. Addresses are baked into the SDK — you do not need to configure them manually. 

Escrow 

Contract 

Address 

ConfidentialEscrow 

0xC4333F84F5034D8691CB95f068def2e3B6DC60Fa 

CCTPV2EscrowReceiver 

0x48F2Ad7B9895683b865eaA5dfb852CB144895Eb7 

SimpleCondition 

0x9817DA50DB5CE4316D2f0fF6bb6DBfe252C29593 

Insurance 

Contract 

Address 

PolicyRegistry 

0xf421363B642315BD3555dE2d9BD566b7f9213c8E 

ConfidentialCoverageManager 

0x766e9508BD41BCE0e788F16Da86B3615386Ff6f6 

PoolFactory 

0x03bAc36d45fA6f5aD8661b95D73452b3BedcaBFD 

Orchestration 

Contract 

Address 

OperatorRegistry 

0x1422ccC8B42079D810835631a5DFE1347a602959 

TaskExecutor 

0x7F24077A3341Af05E39fC232A77c21A03Bbd2262 

FeeManager 

0x5a11DC96CEfd2fB46759F08aCE49515aa23F0156 

CCTPHandler 

0xb37A83461B01097e1E440405264dA59EE9a3F273 

Tokens 

Contract 

Address 

ConfidentialUSDC (cUSDC) 

0x6b6e6479b8b3237933c3ab9d8be969862d4ed89f 

USDC 

0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d 

GovernanceToken 

0xb847e041bB3bC78C3CD951286AbCa28593739D12 

External dependencies 

Contract 

Address 

CCTP MessageTransmitter 

0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275 

TrustedForwarder (ERC-2771) 

0x7ceA357B5AC0639F89F9e378a1f03Aa5005C0a25 

CCTP source chains 

Chain 

Domain 

USDC Address 

TokenMessenger 

Ethereum Sepolia 

0 

0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 

0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA 

Base Sepolia 

6 

0x036CbD53842c5426634e7929541eC2318f3dCF7e 

0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA 

Arbitrum Sepolia 

3 (destination) 

0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d 

— 

Plugin interfaces 

These are the two interfaces you implement to extend the protocol: 

IConditionResolver 

IConditionResolver.solCopy 

interface IConditionResolver { 

function isConditionMet(uint256 escrowId) external view returns (bool); 

function onConditionSet(uint256 escrowId, bytes calldata data) external; 

} 

IUnderwriterPolicy 

IUnderwriterPolicy.solCopy 

interface IUnderwriterPolicy { 

function onPolicySet(uint256 coverageId, bytes calldata data) external; 

function evaluateRisk(uint256 escrowId, bytes calldata riskProof) 

external returns (euint64 riskScore); 

function judge(uint256 coverageId, bytes calldata disputeProof) 

external returns (ebool valid); 

} 

ERC-165 required 

Both interfaces require ERC-165 support. Your contract must implement supportsInterface(bytes4) and return true for the relevant interface ID. 

 
Docs›API Reference›ReineiraSDK 

ReineiraSDK 

The main entry point for all ReineiraOS operations. Create escrows, manage insurance, bridge cross-chain, and listen to events. 

5 min read 

Install 

terminalCopy 

npm install @reineira-os/sdk 

Create and initialize 

setup.tsCopy 

import { ReineiraSDK } from '@reineira-os/sdk' 

 

const sdk = ReineiraSDK.create({ 

network: 'testnet', 

privateKey: '0x...', 

coordinatorUrl: 'https://dswtxw6k9mker.cloudfront.net', 

onFHEInit: (status) => console.log('FHE:', status), 

}) 

 

await sdk.initialize() 

Configuration 

ReineiraSDK.create(options) 

network"testnet"required 

Target network. Currently only testnet is available. 

privateKeystringoptional 

Wallet private key. Provide either privateKey or signer. 

signerethers.Signeroptional 

Ethers.js signer instance. Provide either privateKey or signer. 

providerethers.Provideroptional 

Custom RPC provider. 

rpcUrlstringoptional 

Custom RPC URL (overrides default). 

coordinatorUrlstringoptional 

Coordinator service URL for cross-chain operations. 

onFHEInit(status) => voidoptional 

FHE initialization progress callback. 

addressesPartial<NetworkAddresses>optional 

Override default contract addresses. 

Authentication 

You must provide either privateKey or signer. If both are provided, signer takes precedence. 

Modules 

The SDK exposes four modules accessible as properties: 

modules.tsCopy 

sdk.escrow // EscrowModule — create, fund, redeem escrows 

sdk.insurance // InsuranceModule — pools, policies, coverage 

sdk.bridge // BridgeModule — CCTP health check, coordinator submit 

sdk.events // EventsModule — real-time event listeners 

Utilities 

utilities.tsCopy 

// Amount helpers 

sdk.usdc(1000) // → 1000_000000n (6 decimals) 

sdk.formatUsdc(1000000n) // → "1.00" 

 

// Balances 

const bal = await sdk.balances(); 

// bal.usdc, bal.eth, bal.confidentialUSDC 

 

// Approval check 

await sdk.isOperatorApproved(spender, holder?); 

 

// Accessors 

sdk.signer // ethers.Signer 

sdk.provider // ethers.Provider 

sdk.addresses // NetworkAddresses (all deployed contract addresses) 

Viem interop 

If you use Viem instead of ethers.js, the SDK provides adapter functions: 

viem-setup.tsCopy 

import { walletClientToSigner, publicClientToProvider } from '@reineira-os/sdk' 

 

const signer = walletClientToSigner(viemWalletClient) 

const provider = publicClientToProvider(viemPublicClient) 

 

const sdk = ReineiraSDK.create({ 

network: 'testnet', 

signer, 

provider, 

}) 

Error types 

All SDK methods throw typed errors that can be caught and handled: 

Error 

When thrown 

ApprovalRequiredError 

Fund or stake called without token approval 

ValidationError 

Invalid parameters passed to SDK method 

TransactionFailedError 

On-chain transaction reverted (has .txHash) 

EscrowNotFoundError 

Escrow ID does not exist 

TimeoutError 

waitFor* method exceeded timeout 

FHEInitError 

FHE backend failed to initialize 

EncryptionError 

FHE encryption of value failed 

ConditionNotMetError 

Redeem called when condition resolver returns false 

InsufficientFundsError 

Wallet balance too low for operation 

CoverageNotActiveError 

Dispute filed on non-active coverage 

 
Docs›API Reference›Escrow Module 

Escrow Module 

sdk.escrow — create, fund, and settle Escrows (confidential escrows). 

6 min read 

Create 

Create options 

Simple create with minimal options: 

simple-create.tsCopy 

// Simple create 

const escrow = await sdk.escrow.create({ 

amount: sdk.usdc(1000), 

owner: '0xRecipient...', 

}) 

Full create with resolver and insurance: 

full-create.tsCopy 

const escrow = await sdk.escrow.create({ 

amount: sdk.usdc(1000), 

owner: '0xRecipient...', 

resolver: '0xResolver...', 

resolverData: '0x...', 

insurance: { 

pool: '0xPool...', 

policy: '0xPolicy...', 

coverageAmount: sdk.usdc(1000), 

expiry: Math.floor(Date.now() / 1000) + 86400 * 30, 

}, 

}) 

sdk.escrow.create(options) 

amountbigintrequired 

Escrow amount in token base units. Use sdk.usdc(n) for USDC. 

ownerstringrequired 

Address of the escrow recipient/owner. 

resolverstringoptional 

Address of the IConditionResolver contract. 

resolverDatastringoptional 

ABI-encoded data passed to the resolver's onConditionSet hook. 

insurance.poolstringoptional 

Insurance pool address. 

insurance.policystringoptional 

Insurance policy contract address. 

insurance.coverageAmountbigintoptional 

Coverage amount in token base units. 

insurance.expirynumberoptional 

Coverage expiry as Unix timestamp. 

Builder pattern 

Alternatively, use the fluent builder API: 

builder.tsCopy 

const escrow = await sdk.escrow 

.build() 

.amount(sdk.usdc(1000)) 

.owner('0xRecipient...') 

.condition('0xResolver...', encodedData) 

.insurance({ 

pool: '0xPool...', 

policy: '0xPolicy...', 

coverageAmount: sdk.usdc(1000), 

expiry, 

}) 

.create() 

Returns: EscrowInstance 

EscrowInstance 

Property / Method 

Type 

Description 

id 

bigint 

Sequential escrow identifier 

createTx 

{ hash, blockNumber, gasUsed } 

Creation transaction details 

coverage 

CoverageInstance | undefined 

Insurance coverage (if purchased) 

approve(opts?) 

Promise<TransactionResult> 

Approve token spending 

fund(amount, opts?) 

Promise<FundResult> 

Fund the escrow 

redeem() 

Promise<TransactionResult> 

Redeem funds to owner 

isApproved() 

Promise<boolean> 

Check if operator is approved 

exists() 

Promise<boolean> 

Check if escrow exists 

isFunded() 

Promise<boolean> 

Check if fully funded 

isConditionMet() 

Promise<boolean> 

Check resolver condition 

isRedeemable() 

Promise<boolean> 

funded + condition met + not redeemed 

waitForFunded(timeout?) 

Promise<void> 

Wait for funding event 

waitForRedeemable(opts?) 

Promise<void> 

Poll until redeemable 

Fund options 

Same-chain funding: 

fund-same-chain.tsCopy 

await escrow.fund(sdk.usdc(1000), { autoApprove: true }) 

Cross-chain funding with settlement wait: 

fund-cross-chain.tsCopy 

await escrow.fund(sdk.usdc(1000), { 

autoApprove: true, 

crossChain: { 

sourceRpc: 'https://eth-sepolia-rpc...', 

sourcePrivateKey: process.env.SOURCE_KEY, 

}, 

waitForSettlement: true, 

settlementTimeoutMs: 600_000, 

}) 

Fund parameters 

escrow.fund(amount, options) 

autoApprovebooleanoptionaldefault: false 

Automatically approve token spending before funding. 

crossChain.sourceRpcstringoptional 

RPC URL for the source chain (cross-chain funding). 

crossChain.sourcePrivateKeystringoptional 

Private key on the source chain. 

waitForSettlementbooleanoptionaldefault: false 

Wait for cross-chain settlement to complete before returning. 

settlementTimeoutMsnumberoptionaldefault: 600000 

Timeout in milliseconds for settlement wait. 

Cross-chain settlement 

Cross-chain funding uses Circle CCTP v2. Settlement typically takes 2-5 minutes. Set waitForSettlement: true to block until the escrow is funded on the destination chain. 

Redeem options 

redeem.tsCopy 

// Redeem a single escrow 

const result = await escrow.redeem() 

console.log('Redeemed:', result.hash) 

 

// Batch redeem multiple escrows 

await sdk.escrow.redeemMultiple([0n, 1n, 2n]) 

Static methods 

static-methods.tsCopy 

sdk.escrow.get(42n) // get EscrowInstance by ID 

sdk.escrow.total() // total escrows created (Promise<bigint>) 

Events 

events.tsCopy 

sdk.events.onEscrowCreated((escrowId) => { ... }); 

sdk.events.onEscrowFunded((escrowId, payer) => { ... }, filterEscrowId?); 

sdk.events.onEscrowRedeemed((escrowId) => { ... }, filterEscrowId?); 

 
Docs›API Reference›Insurance Module 

Insurance Module 

sdk.insurance — create Insurance pools, manage policies, purchase coverage, and handle disputes. 

5 min read 

Pools 

Create a pool 

create-pool.tsCopy 

const pool = await sdk.insurance.createPool({ 

paymentToken: sdk.addresses.confidentialUSDC, 

}) 

// pool.id, pool.address, pool.createTx.hash 

Get existing pool 

get-pool.tsCopy 

const pool = await sdk.insurance.getPool(0n) 

const count = await sdk.insurance.poolCount() 

PoolInstance 

Method 

Returns 

Description 

addPolicy(address) 

Promise<TransactionResult> 

Allow a policy contract on this pool 

removePolicy(address) 

Promise<TransactionResult> 

Revoke a policy from this pool 

stake(amount, opts?) 

Promise<StakeResult> 

Deposit liquidity. Returns { stakeId, tx }. 

unstake(stakeId) 

Promise<TransactionResult> 

Withdraw staked liquidity 

approve() 

Promise<TransactionResult> 

Approve token spending for staking 

isApproved() 

Promise<boolean> 

Check if token spending is approved 

Coverage 

Purchase coverage 

purchase-coverage.tsCopy 

// Required fields 

const coverage = await sdk.insurance.purchaseCoverage({ 

pool: '0xPool...', 

policy: '0xPolicy...', 

escrowId: escrow.id, 

coverageAmount: sdk.usdc(50000), 

expiry: Math.floor(Date.now() / 1000) + 86400 * 30, 

}) 

With optional policy data and risk proof: 

purchase-coverage-full.tsCopy 

const coverage = await sdk.insurance.purchaseCoverage({ 

pool: '0xPool...', 

policy: '0xPolicy...', 

escrowId: escrow.id, 

coverageAmount: sdk.usdc(50000), 

expiry: Math.floor(Date.now() / 1000) + 86400 * 30, 

policyData: '0x...', 

riskProof: '0x...', 

}) 

sdk.insurance.purchaseCoverage(options) 

poolstringrequired 

Insurance pool address. 

policystringrequired 

Policy contract address. 

escrowIdbigintrequired 

Escrow ID to cover. 

coverageAmountbigintrequired 

Coverage amount in token base units. 

expirynumberrequired 

Coverage expiry as Unix timestamp. 

policyDatastringoptional 

Optional ABI-encoded data for the policy contract. 

riskProofstringoptional 

Optional risk assessment proof bytes. 

CoverageInstance 

Method 

Returns 

Description 

status() 

Promise<CoverageStatus> 

Active, Disputed, Claimed, or Expired 

dispute(proof) 

Promise<TransactionResult> 

File a dispute with proof bytes 

id 

bigint 

Coverage identifier 

createTx 

{ hash } 

Purchase transaction details 

Policy management 

Policies are managed at the pool level via addPolicy() and removePolicy() on PoolInstance. See the Pools section above. 

Bridge 

bridge.tsCopy 

// Check operator network health 

const health = await sdk.bridge.checkHealth() 

// health.reachable, health.connectedOperators, health.operators[] 

 

// Submit burn tx to coordinator (used internally by fund()) 

const taskId = await sdk.bridge.submitToCoordinator('0xBurnTxHash...') 

Events 

events.tsCopy 

sdk.events.onPoolCreated((poolId, pool, underwriter) => { ... }); 

sdk.events.onCoveragePurchased((coverageId) => { ... }); 

sdk.events.onDisputeFiled((coverageId) => { ... }); 

 

// Query past events 

const logs = await sdk.events.queryEscrowEvents("EscrowCreated", fromBlock); 

 

// Cleanup 

sdk.events.removeAllListeners(); 

 
Docs›API Reference›MCP Server 

MCP Documentation Server 

Give AI assistants direct access to protocol documentation, deployed contracts, and plugin interfaces via the Model Context Protocol. 

3 min read 

Endpoint 

MCP endpointCopy 

https://zyx576c546w4m4ag7nzhf467du0wixjg.lambda-url.us-east-2.on.aws/ 

Transport: HTTP Streamable (SSE). No authentication required. 

Setup 

Claude Code 

terminalCopy 

claude mcp add reineira-docs --transport http https://zyx576c546w4m4ag7nzhf467du0wixjg.lambda-url.us-east-2.on.aws/ 

Restart Claude Code after adding. Five tools become available automatically. 

Claude Desktop 

Add to your claude_desktop_config.json: 

claude_desktop_config.jsonCopy 

{ 

"mcpServers": { 

"reineira-docs": { 

"type": "url", 

"url": "https://zyx576c546w4m4ag7nzhf467du0wixjg.lambda-url.us-east-2.on.aws/" 

} 

} 

} 

Cursor / other MCP clients 

Use the HTTP Streamable transport with the endpoint URL above. Refer to your client's MCP configuration documentation. 

Available tools 

Tool 

Description 

get_docs 

Browse documentation by section and topic. Sections: overview, guides, protocol, reference, whitepaper, litepaper. 

search_docs 

Full-text keyword search across all documentation with context snippets. 

get_contracts 

Deployed contract addresses on Arbitrum Sepolia, filterable by category (Escrow, Insurance, Orchestration, etc.). 

get_interfaces 

Solidity source code for plugin interfaces — IConditionResolver and IUnderwriterPolicy. 

get_platform_version 

Platform version, compiler settings, chain info, and dependency versions. 

What you can ask 

Once connected, ask your AI assistant questions like: 

"Show me the deployed escrow contract addresses" 

"How do I build a condition resolver plugin?" 

"Search the docs for CCTP cross-chain settlement" 

"Show me the IUnderwriterPolicy interface" 

"What Solidity version does ReineiraOS use?" 

"How do I create an insurance pool?" 

Source of truth 

The MCP server returns structured data directly from the protocol source — the same documentation, interfaces, and addresses used by the core team. 

Combining with ReineiraOS Code 

For the best development experience, use the MCP server alongside ReineiraOS Code: 

ReineiraOS Code gives Claude Code project-level context (scaffolds, test harness, deployment scripts) 

MCP Server gives Claude Code protocol-level context (docs, addresses, interfaces) 

Full-stack AI development 

Together, Claude Code can generate complete plugin implementations with correct imports, addresses, and patterns — from a single natural language description. 

 

 
 