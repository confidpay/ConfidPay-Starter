[Docs](https://docs.reineira.xyz/docs)›[Build](https://docs.reineira.xyz/docs/build)›Escrow Lifecycle

# **Escrow Lifecycle**

The full state machine for Escrows - from creation through funding, Gate verification, and redemption.

7 min read

## **Overview**

A Escrow is a state machine with three states. Transitions are triggered by on-chain calls. The ConfidentialEscrow contract uses FHE-encrypted flags and a silent failure pattern - failed redemptions transfer zero instead of reverting, preventing information leakage.

**ESCROW STATE MACHINE**

**Create**

Encrypted owner + amount

**Fund**

Deposit USDC

**Redeem**

Gate check → funds released

## **Escrow states**

| **State** | **Status** | **Description**                                                                        |
| --------- | ---------- | -------------------------------------------------------------------------------------- |
| Created   | Active     | Escrow exists on-chain with encrypted owner and amount. Not yet funded.                |
| Funded    | Active     | USDC deposited and wrapped into ConfidentialUSDC. The encrypted paidAmount is updated. |
| Redeemed  | Final      | Funds released to the owner. The encrypted isRedeemed flag is set. Terminal state.     |

**Encrypted state flags**

The isRedeemed flag is stored as ebool - an FHE-encrypted boolean. On-chain observers cannot tell whether an Escrow has been redeemed by inspecting storage.

## **Creating an Escrow**

Call ConfidentialEscrow.create() with FHE-encrypted owner and amount, plus an optional Gate address. If a Gate is provided, onConditionSet() is called atomically during creation.

create-vault.tsCopy

| import { cofhejs, Encryptable } from 'cofhejs/node';                              |
| --------------------------------------------------------------------------------- |
|                                                                                   |
| _// 1. Encrypt owner and amount client-side_                                      |
| const \[encOwner\] = await cofhejs.encrypt(\[Encryptable.address(beneficiary)\]); |
| const \[encAmount\] = await cofhejs.encrypt(\[Encryptable.uint64(amount)\]);      |
|                                                                                   |
| _// 2. Create the Escrow on-chain_                                                |
| const tx = await escrow.create(                                                   |
| encOwner, _// InEaddress - encrypted beneficiary_                                 |
| encAmount, _// InEuint64 - encrypted amount_                                      |
| resolverAddr, _// Gate address (or address(0) for unconditional)_                 |
| resolverData, _// bytes passed to onConditionSet()_                               |
| );                                                                                |

The contract stores the encrypted values and grants FHE.allow() access to the owner and the insurance manager (if set).

## **Funding an Escrow**

Deposit USDC into the Escrow via fund(escrowId, amount) or fundFrom(escrowId, amount, payer). The contract wraps the USDC into ConfidentialUSDC and updates the encrypted paidAmount. Cross-chain funding via CCTP is handled by the SDK's bridge module.

## **Redeeming an Escrow**

Call redeem(escrowId) to settle the Escrow. The contract checks:

- The caller matches the encrypted owner (via FHE comparison)
- The Escrow has not already been redeemed (via encrypted isRedeemed flag)
- If a Gate is attached, IConditionResolver.isConditionMet(escrowId) returns true

All three checks are combined into a single encrypted boolean via FHE AND operations. If all conditions pass, the encrypted paidAmount is transferred. If any fail, zero is transferred - no revert.

For batch redemption, use redeemMultiple(escrowIds) to settle multiple Escrows in a single transaction.

## **Silent failure pattern**

The escrow contract uses FHE.select() to choose between the actual payout or zero based on encrypted conditions:

ConfidentialEscrow.solCopy

| _// Combine all checks into a single encrypted boolean_                 |
| ----------------------------------------------------------------------- |
| ebool canRedeem = FHE.and(isOwner, FHE.and(notRedeemed, conditionMet)); |
|                                                                         |
| _// Select payout or zero - no revert on failure_                       |
| euint64 payout = FHE.select(canRedeem, escrow.paidAmount, zeroAmount);  |

**Why no revert?**

A revert would leak information about _why_ the redemption failed - wrong caller, already redeemed, or condition not met. By always transferring (potentially zero), the contract hides the failure reason from on-chain observers.

## **Events reference**

| **Event**                      | **Emitted when**                                                     |
| ------------------------------ | -------------------------------------------------------------------- |
| EscrowCreated(escrowId)        | A new Escrow is successfully created via create().                   |
| EscrowFunded(escrowId, payer)  | USDC is deposited into the Escrow via fund() or fundFrom().          |
| EscrowRedeemed(escrowId)       | The Escrow is redeemed via redeem(). Funds transferred to owner.     |
| EscrowBatchRedeemed(escrowIds) | Multiple Escrows redeemed in a single call via redeemMultiple().     |
| FeeSet(escrowId)               | An insurance fee is attached to the Escrow by the insurance manager. |

<br/>**Gate Plugins**

Build custom verification contracts that control when an Escrow releases funds - from zkTLS proofs and oracle feeds to prediction markets and time locks.

12 min read

A Gate is a Solidity contract that answers one question: **"Should this Escrow release its funds?"**

You implement one interface (IConditionResolver). The protocol calls it on every redeem attempt. The Gate's logic is yours - the protocol doesn't care how you verify, only that you do.

## **The interface**

IConditionResolver.solCopy

| interface IConditionResolver {                                           |
| ------------------------------------------------------------------------ |
| function isConditionMet(uint256 escrowId) external view returns (bool);  |
| function onConditionSet(uint256 escrowId, bytes calldata data) external; |
| }                                                                        |

| **Function**   | **Called by**               | **When**           | **Purpose**                                    |
| -------------- | --------------------------- | ------------------ | ---------------------------------------------- |
| onConditionSet | ConfidentialEscrow.create() | Escrow creation    | Parse and store your Gate configuration        |
| isConditionMet | ConfidentialEscrow.redeem() | Settlement attempt | Return true if the Gate condition is satisfied |

## **Pattern 1: zkTLS - verify a PayPal payment**

The most powerful pattern. Use Reclaim Protocol to prove that a real-world payment happened - without revealing any payment details on-chain.

### **How it works**

**ZKTLS PAYPAL FLOW**

**Seller creates escrow**

Sets resolver to PayPalConditionResolver with merchant ID

**Buyer pays via PayPal**

Standard PayPal payment - no crypto on buyer side

**Buyer generates zkTLS proof**

Reclaim SDK proves status=CAPTURED without revealing details

**Proof submitted on-chain**

Resolver verifies proof; escrow becomes redeemable

**Seller redeems**

Funds transfer from confidential escrow to wallet

**Solidity contract:**

PayPalConditionResolver.solCopy

| _// SPDX-License-Identifier: MIT_                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pragma solidity ^0.8.24;                                                                                                                                                                        |
|                                                                                                                                                                                                 |
| import { IConditionResolver } from "[@reineira-os/shared/contracts/interfaces/plugins/IConditionResolver.sol](mailto:@reineira-os/shared/contracts/interfaces/plugins/IConditionResolver.sol)"; |
| import { ERC165 } from "[@openzeppelin/contracts/utils/introspection/ERC165.sol](mailto:@openzeppelin/contracts/utils/introspection/ERC165.sol)";                                               |
|                                                                                                                                                                                                 |
| contract PayPalConditionResolver is IConditionResolver, ERC165 {                                                                                                                                |
| struct EscrowConfig {                                                                                                                                                                           |
| string merchantId;                                                                                                                                                                              |
| bool fulfilled;                                                                                                                                                                                 |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| mapping(uint256 => EscrowConfig) public configs;                                                                                                                                                |
| mapping(bytes32 => bool) public usedProofs; _// replay protection_                                                                                                                              |
|                                                                                                                                                                                                 |
| _// Called once at escrow creation - store the merchant ID_                                                                                                                                     |
| function onConditionSet(uint256 escrowId, bytes calldata data) external {                                                                                                                       |
| string memory merchantId = abi.decode(data, (string));                                                                                                                                          |
| require(bytes(merchantId).length > 0, "Empty merchant ID");                                                                                                                                     |
| configs\[escrowId\] = EscrowConfig(merchantId, false);                                                                                                                                          |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| _// Called on every redeem attempt_                                                                                                                                                             |
| function isConditionMet(uint256 escrowId) external view returns (bool) {                                                                                                                        |
| return configs\[escrowId\].fulfilled;                                                                                                                                                           |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| _// Buyer calls this with their zkTLS proof_                                                                                                                                                    |
| function submitProof(                                                                                                                                                                           |
| uint256 escrowId,                                                                                                                                                                               |
| bytes calldata proof,                                                                                                                                                                           |
| string calldata extractedStatus,                                                                                                                                                                |
| string calldata extractedMerchantId                                                                                                                                                             |
| ) external {                                                                                                                                                                                    |
| EscrowConfig storage config = configs\[escrowId\];                                                                                                                                              |
| require(!config.fulfilled, "Already fulfilled");                                                                                                                                                |
|                                                                                                                                                                                                 |
| _// 1. Verify zkTLS proof signature (Reclaim Protocol on-chain verifier)_                                                                                                                       |
| bytes32 proofHash = keccak256(proof);                                                                                                                                                           |
| require(!usedProofs\[proofHash\], "Proof already used");                                                                                                                                        |
|                                                                                                                                                                                                 |
| _// 2. Verify the proof is valid via Reclaim's on-chain verifier_                                                                                                                               |
| \_verifyReclaimProof(proof);                                                                                                                                                                    |
|                                                                                                                                                                                                 |
| _// 3. Check extracted fields match escrow config_                                                                                                                                              |
| require(                                                                                                                                                                                        |
| keccak256(bytes(extractedStatus)) == keccak256("CAPTURED"),                                                                                                                                     |
| "Payment not captured"                                                                                                                                                                          |
| );                                                                                                                                                                                              |
| require(                                                                                                                                                                                        |
| keccak256(bytes(extractedMerchantId)) == keccak256(bytes(config.merchantId)),                                                                                                                   |
| "Merchant ID mismatch"                                                                                                                                                                          |
| );                                                                                                                                                                                              |
|                                                                                                                                                                                                 |
| _// 4. Mark as fulfilled + prevent replay_                                                                                                                                                      |
| config.fulfilled = true;                                                                                                                                                                        |
| usedProofs\[proofHash\] = true;                                                                                                                                                                 |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function \_verifyReclaimProof(bytes calldata proof) internal view {                                                                                                                             |
| address RECLAIM = 0x...; _// Reclaim verifier address on your chain_                                                                                                                            |
| (bool success, ) = RECLAIM.staticcall(                                                                                                                                                          |
| abi.encodeWithSignature("verifyProof(bytes)", proof)                                                                                                                                            |
| );                                                                                                                                                                                              |
| require(success, "Invalid zkTLS proof");                                                                                                                                                        |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function supportsInterface(bytes4 interfaceId) public view override returns (bool) {                                                                                                            |
| return interfaceId == type(IConditionResolver).interfaceId                                                                                                                                      |
| \| super.supportsInterface(interfaceId);                                                                                                                                                        |
| }                                                                                                                                                                                               |
| }                                                                                                                                                                                               |

**SDK usage:**

paypal-resolver.tsCopy

| import { ethers } from 'ethers'                                                                    |
| -------------------------------------------------------------------------------------------------- |
|                                                                                                    |
| _// Seller creates escrow with PayPal condition_                                                   |
| const resolverData = ethers.AbiCoder.defaultAbiCoder().encode(\['string'\], \['MERCHANT_ABC123'\]) |
|                                                                                                    |
| const escrow = await sdk.escrow                                                                    |
| .build()                                                                                           |
| .amount(sdk.usdc(500))                                                                             |
| .owner('0xSeller...')                                                                              |
| .condition('0xPayPalResolver...', resolverData)                                                    |
| .create()                                                                                          |
|                                                                                                    |
| _// Buyer generates proof via Reclaim SDK (off-chain),_                                            |
| _// then submits it on-chain to the resolver contract_                                             |
| const resolverAbi = \['function submitProof(uint256,bytes,string,string) external'\]               |
| const resolver = new ethers.Contract('0xPayPalResolver...', resolverAbi, buyerSigner)              |
| await resolver.submitProof(escrow.id, proof, 'CAPTURED', 'MERCHANT_ABC123')                        |
|                                                                                                    |
| _// Seller redeems_                                                                                |
| await escrow.redeem()                                                                              |

**Works for any attestation source**

This pattern works for any service that can produce a zkTLS attestation via Reclaim Protocol - Stripe, Wise, bank APIs, delivery tracking, any service with a web interface. The attestation is verified on-chain by your Gate contract.

## **Pattern 2: Oracle - Chainlink price feed**

Release an escrow when an asset price crosses a threshold. Uses Chainlink's price feeds deployed natively on Arbitrum.

PriceFeedResolver.solCopy

| _// SPDX-License-Identifier: MIT_                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pragma solidity ^0.8.24;                                                                                                                                                                        |
|                                                                                                                                                                                                 |
| import { IConditionResolver } from "[@reineira-os/shared/contracts/interfaces/plugins/IConditionResolver.sol](mailto:@reineira-os/shared/contracts/interfaces/plugins/IConditionResolver.sol)"; |
| import { ERC165 } from "[@openzeppelin/contracts/utils/introspection/ERC165.sol](mailto:@openzeppelin/contracts/utils/introspection/ERC165.sol)";                                               |
|                                                                                                                                                                                                 |
| interface IChainlinkFeed {                                                                                                                                                                      |
| function latestRoundData() external view returns (                                                                                                                                              |
| uint80 roundId, int256 answer, uint256 startedAt,                                                                                                                                               |
| uint256 updatedAt, uint80 answeredInRound                                                                                                                                                       |
| );                                                                                                                                                                                              |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| contract PriceFeedResolver is IConditionResolver, ERC165 {                                                                                                                                      |
| struct PriceCondition {                                                                                                                                                                         |
| address feed; _// Chainlink feed address on Arbitrum_                                                                                                                                           |
| int256 threshold; _// target price (8 decimals for USD feeds)_                                                                                                                                  |
| bool above; _// true = release when price >= threshold_                                                                                                                                         |
| uint256 maxStaleness; _// max age of price data in seconds_                                                                                                                                     |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| mapping(uint256 => PriceCondition) public conditions;                                                                                                                                           |
|                                                                                                                                                                                                 |
| function onConditionSet(uint256 escrowId, bytes calldata data) external {                                                                                                                       |
| (address feed, int256 threshold, bool above, uint256 maxStaleness) =                                                                                                                            |
| abi.decode(data, (address, int256, bool, uint256));                                                                                                                                             |
|                                                                                                                                                                                                 |
| require(feed != address(0), "Invalid feed");                                                                                                                                                    |
| require(maxStaleness > 0 && maxStaleness <= 86400, "Staleness out of range");                                                                                                                   |
|                                                                                                                                                                                                 |
| conditions\[escrowId\] = PriceCondition(feed, threshold, above, maxStaleness);                                                                                                                  |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function isConditionMet(uint256 escrowId) external view returns (bool) {                                                                                                                        |
| PriceCondition memory cond = conditions\[escrowId\];                                                                                                                                            |
| if (cond.feed == address(0)) return false;                                                                                                                                                      |
|                                                                                                                                                                                                 |
| (, int256 price,, uint256 updatedAt,) =                                                                                                                                                         |
| IChainlinkFeed(cond.feed).latestRoundData();                                                                                                                                                    |
|                                                                                                                                                                                                 |
| _// Check staleness - don't release on stale data_                                                                                                                                              |
| if (block.timestamp - updatedAt > cond.maxStaleness) return false;                                                                                                                              |
|                                                                                                                                                                                                 |
| return cond.above ? price >= cond.threshold : price <= cond.threshold;                                                                                                                          |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function supportsInterface(bytes4 interfaceId) public view override returns (bool) {                                                                                                            |
| return interfaceId == type(IConditionResolver).interfaceId                                                                                                                                      |
| \| super.supportsInterface(interfaceId);                                                                                                                                                        |
| }                                                                                                                                                                                               |
| }                                                                                                                                                                                               |

**SDK usage:**

price-feed-resolver.tsCopy

| _// Chainlink ETH/USD feed on Arbitrum_                                             |
| ----------------------------------------------------------------------------------- |
| const ETH_USD_FEED = '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612'                   |
|                                                                                     |
| _// Release when ETH crosses \$4,000 (8 decimals)_                                  |
| const resolverData = ethers.AbiCoder.defaultAbiCoder().encode(                      |
| \['address', 'int256', 'bool', 'uint256'\],                                         |
| \[ETH*USD_FEED, 400000000000n, true, 3600\] *// feed, \$4000, above, 1h staleness\_ |
| )                                                                                   |
|                                                                                     |
| const escrow = await sdk.escrow                                                     |
| .build()                                                                            |
| .amount(sdk.usdc(10000))                                                            |
| .owner('0xCounterparty...')                                                         |
| .condition('0xPriceFeedResolver...', resolverData)                                  |
| .create()                                                                           |
|                                                                                     |
| _// Escrow releases automatically when ETH >= \$4,000_                              |
| _// No manual intervention needed - anyone can call redeem()_                       |
| await escrow.waitForRedeemable({ pollIntervalMs: 30000, timeoutMs: 86400000 })      |
| await escrow.redeem()                                                               |

**Chainlink feeds on Arbitrum**

Key feeds: ETH/USD, BTC/USD, ARB/USD, USDC/USD, LINK/USD. Full list at [data.chain.link](https://data.chain.link/).

## **Pattern 3: Prediction market - Polymarket / UMA outcome**

Release an escrow based on a prediction market resolution. Uses UMA's Optimistic Oracle on Arbitrum to verify real-world event outcomes.

PredictionResolver.solCopy

| _// SPDX-License-Identifier: MIT_                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pragma solidity ^0.8.24;                                                                                                                                                                        |
|                                                                                                                                                                                                 |
| import { IConditionResolver } from "[@reineira-os/shared/contracts/interfaces/plugins/IConditionResolver.sol](mailto:@reineira-os/shared/contracts/interfaces/plugins/IConditionResolver.sol)"; |
| import { ERC165 } from "[@openzeppelin/contracts/utils/introspection/ERC165.sol](mailto:@openzeppelin/contracts/utils/introspection/ERC165.sol)";                                               |
|                                                                                                                                                                                                 |
| interface IOptimisticOracle {                                                                                                                                                                   |
| function settleAndGetPrice(                                                                                                                                                                     |
| bytes32 identifier, uint256 timestamp, bytes memory ancillaryData                                                                                                                               |
| ) external returns (int256);                                                                                                                                                                    |
|                                                                                                                                                                                                 |
| function hasPrice(                                                                                                                                                                              |
| bytes32 identifier, uint256 timestamp, bytes memory ancillaryData                                                                                                                               |
| ) external view returns (bool);                                                                                                                                                                 |
|                                                                                                                                                                                                 |
| function getPrice(                                                                                                                                                                              |
| bytes32 identifier, uint256 timestamp, bytes memory ancillaryData                                                                                                                               |
| ) external view returns (int256);                                                                                                                                                               |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| contract PredictionResolver is IConditionResolver, ERC165 {                                                                                                                                     |
| struct MarketCondition {                                                                                                                                                                        |
| address oracle; _// UMA Optimistic Oracle on Arbitrum_                                                                                                                                          |
| bytes32 identifier; _// price identifier (e.g., YES_OR_NO_QUERY)_                                                                                                                               |
| uint256 requestTimestamp; _// when the question was asked_                                                                                                                                      |
| bytes ancillaryData; _// the question itself (encoded)_                                                                                                                                         |
| int256 requiredOutcome; _// 1e18 = YES, 0 = NO_                                                                                                                                                 |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| mapping(uint256 => MarketCondition) public conditions;                                                                                                                                          |
|                                                                                                                                                                                                 |
| function onConditionSet(uint256 escrowId, bytes calldata data) external {                                                                                                                       |
| (                                                                                                                                                                                               |
| address oracle,                                                                                                                                                                                 |
| bytes32 identifier,                                                                                                                                                                             |
| uint256 requestTimestamp,                                                                                                                                                                       |
| bytes memory ancillaryData,                                                                                                                                                                     |
| int256 requiredOutcome                                                                                                                                                                          |
| ) = abi.decode(data, (address, bytes32, uint256, bytes, int256));                                                                                                                               |
|                                                                                                                                                                                                 |
| require(oracle != address(0), "Invalid oracle");                                                                                                                                                |
|                                                                                                                                                                                                 |
| conditions\[escrowId\] = MarketCondition(                                                                                                                                                       |
| oracle, identifier, requestTimestamp, ancillaryData, requiredOutcome                                                                                                                            |
| );                                                                                                                                                                                              |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function isConditionMet(uint256 escrowId) external view returns (bool) {                                                                                                                        |
| MarketCondition memory cond = conditions\[escrowId\];                                                                                                                                           |
| if (cond.oracle == address(0)) return false;                                                                                                                                                    |
|                                                                                                                                                                                                 |
| IOptimisticOracle oracle = IOptimisticOracle(cond.oracle);                                                                                                                                      |
|                                                                                                                                                                                                 |
| _// Check if the question has been resolved_                                                                                                                                                    |
| if (!oracle.hasPrice(cond.identifier, cond.requestTimestamp, cond.ancillaryData)) {                                                                                                             |
| return false;                                                                                                                                                                                   |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| _// Check if the outcome matches_                                                                                                                                                               |
| int256 resolvedPrice = oracle.getPrice(                                                                                                                                                         |
| cond.identifier, cond.requestTimestamp, cond.ancillaryData                                                                                                                                      |
| );                                                                                                                                                                                              |
|                                                                                                                                                                                                 |
| return resolvedPrice == cond.requiredOutcome;                                                                                                                                                   |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function supportsInterface(bytes4 interfaceId) public view override returns (bool) {                                                                                                            |
| return interfaceId == type(IConditionResolver).interfaceId                                                                                                                                      |
| \| super.supportsInterface(interfaceId);                                                                                                                                                        |
| }                                                                                                                                                                                               |
| }                                                                                                                                                                                               |

**SDK usage:**

prediction-resolver.tsCopy

| _// UMA Optimistic Oracle V3 on Arbitrum_                                  |
| -------------------------------------------------------------------------- |
| const UMA_ORACLE = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2'            |
|                                                                            |
| _// Question: "Did Team X win the championship by Dec 31, 2025?"_          |
| const ancillaryData = ethers.toUtf8Bytes(                                  |
| 'q: Did Team X win the 2025 championship? res_data: p1: 0, p2: 1, p3: 0.5' |
| )                                                                          |
|                                                                            |
| const resolverData = ethers.AbiCoder.defaultAbiCoder().encode(             |
| \['address', 'bytes32', 'uint256', 'bytes', 'int256'\],                    |
| \[                                                                         |
| UMA_ORACLE,                                                                |
| ethers.id('YES*OR_NO_QUERY'), *// identifier\_                             |
| Math.floor(Date.now() / 1000), _// request timestamp_                      |
| ancillaryData,                                                             |
| ethers.parseEther('1'), _// requiredOutcome = YES (1e18)_                  |
| \]                                                                         |
| )                                                                          |
|                                                                            |
| const escrow = await sdk.escrow                                            |
| .build()                                                                   |
| .amount(sdk.usdc(25000))                                                   |
| .owner('0xWinner...')                                                      |
| .condition('0xPredictionResolver...', resolverData)                        |
| .create()                                                                  |

This pattern works for any binary or numeric outcome - sports results, election outcomes, protocol milestones, token price targets, or any question UMA's oracle can resolve.

## **Pattern 4: Time lock (simple)**

The simplest resolver - release after a deadline passes:

TimeLockResolver.solCopy

| _// SPDX-License-Identifier: MIT_                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pragma solidity ^0.8.24;                                                                                                                                                                        |
|                                                                                                                                                                                                 |
| import { IConditionResolver } from "[@reineira-os/shared/contracts/interfaces/plugins/IConditionResolver.sol](mailto:@reineira-os/shared/contracts/interfaces/plugins/IConditionResolver.sol)"; |
| import { ERC165 } from "[@openzeppelin/contracts/utils/introspection/ERC165.sol](mailto:@openzeppelin/contracts/utils/introspection/ERC165.sol)";                                               |
|                                                                                                                                                                                                 |
| contract TimeLockResolver is IConditionResolver, ERC165 {                                                                                                                                       |
| mapping(uint256 => uint256) public deadlines;                                                                                                                                                   |
|                                                                                                                                                                                                 |
| function onConditionSet(uint256 escrowId, bytes calldata data) external {                                                                                                                       |
| uint256 deadline = abi.decode(data, (uint256));                                                                                                                                                 |
| require(deadline > block.timestamp, "Deadline must be in the future");                                                                                                                          |
| deadlines\[escrowId\] = deadline;                                                                                                                                                               |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function isConditionMet(uint256 escrowId) external view returns (bool) {                                                                                                                        |
| return block.timestamp >= deadlines\[escrowId\];                                                                                                                                                |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function supportsInterface(bytes4 interfaceId) public view override returns (bool) {                                                                                                            |
| return interfaceId == type(IConditionResolver).interfaceId                                                                                                                                      |
| \| super.supportsInterface(interfaceId);                                                                                                                                                        |
| }                                                                                                                                                                                               |
| }                                                                                                                                                                                               |

## **Unconditional escrows**

Omit the .condition() call to create an escrow with no release condition - redeemable immediately after funding:

unconditional.tsCopy

| const escrow = await sdk.escrow.create({ |
| ---------------------------------------- |
| amount: sdk.usdc(1000),                  |
| owner: '0xRecipient...',                 |
| })                                       |

## **Security checklist**

- isConditionMet must be a **view** function - no state changes, no gas surprises
- onConditionSet should validate inputs strictly - it runs once at escrow creation
- Support **ERC-165** so the protocol can verify your contract implements the interface
- Protect against **replay** - one escrow ID should map to one condition state; for proof-based resolvers, track used proof hashes
- Keep isConditionMet gas low - it is called on every redeem attempt. Read from storage, do not compute
- Validate **data freshness** - for oracle-based resolvers, check updatedAt timestamps to prevent stale data attacks
- Never trust **external calls** in view functions without validating the source - use known contract addresses, not user-supplied ones

## **Use ReineiraOS Code**

The fastest way to build a resolver is with [ReineiraOS Code](https://docs.reineira.xyz/docs/developers/reineira-code). Clone the repo, describe your verification logic in natural language, and Claude Code generates a production-ready resolver with tests and deployment scripts.

[**ReineiraOS Code**](https://docs.reineira.xyz/docs/developers/reineira-code)

[Generate production-ready resolvers with AI-assisted development](https://docs.reineira.xyz/docs/developers/reineira-code)

[Docs](https://docs.reineira.xyz/docs)›[Build](https://docs.reineira.xyz/docs/build)›Underwriter Policies

# **Underwriter Policies**

Build underwriter policy contracts that price risk and resolve disputes using FHE-encrypted computations - then earn premiums from every coverage purchase.

10 min read

An insurance policy is a Solidity contract that answers two questions: **"How risky is this Escrow?"** and **"Is this dispute legitimate?"**

Build a great policy, attach it to a pool, and earn premiums from every coverage purchase.

## **The interface**

IUnderwriterPolicy.solCopy

| interface IUnderwriterPolicy {                                          |
| ----------------------------------------------------------------------- |
| function onPolicySet(uint256 coverageId, bytes calldata data) external; |
|                                                                         |
| function evaluateRisk(uint256 escrowId, bytes calldata riskProof)       |
| external returns (euint64 riskScore);                                   |
|                                                                         |
| function judge(uint256 coverageId, bytes calldata disputeProof)         |
| external returns (ebool valid);                                         |
| }                                                                       |

| **Function** | **When called**   | **Returns**                        | **Purpose**                                             |
| ------------ | ----------------- | ---------------------------------- | ------------------------------------------------------- |
| onPolicySet  | Coverage purchase | -                                  | Initialize policy-specific data for this coverage       |
| evaluateRisk | Coverage purchase | Encrypted risk score (0-10000 bps) | Determines the premium the buyer pays                   |
| judge        | Dispute filed     | Encrypted boolean                  | Determines if the claim is valid and should be paid out |

**FHE-encrypted return values**

Both evaluateRisk and judge return FHE-encrypted values. The protocol performs arithmetic on encrypted data - nobody sees the raw risk score or dispute verdict. FHE.allowThis() and FHE.allow(value, msg.sender) grant the protocol permission to operate on your encrypted return values.

## **Example: P2P marketplace dispute policy**

A real policy for a P2P marketplace where buyers pay sellers via PayPal (using the zkTLS resolver from the [Gate Plugins](https://docs.reineira.xyz/docs/build/condition-plugins) page). Insurance covers the case where a buyer disputes a PayPal transaction after the seller already redeemed crypto.

### **Risk evaluation**

Risk scoring based on escrow parameters - higher coverage relative to typical transaction sizes = higher risk:

P2PMarketplacePolicy.solCopy

| _// SPDX-License-Identifier: MIT_                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pragma solidity ^0.8.24;                                                                                                                                                                        |
|                                                                                                                                                                                                 |
| import { IUnderwriterPolicy } from "[@reineira-os/shared/contracts/interfaces/plugins/IUnderwriterPolicy.sol](mailto:@reineira-os/shared/contracts/interfaces/plugins/IUnderwriterPolicy.sol)"; |
| import { ERC165 } from "[@openzeppelin/contracts/utils/introspection/ERC165.sol](mailto:@openzeppelin/contracts/utils/introspection/ERC165.sol)";                                               |
| import { FHE, euint64, ebool } from "[@fhenixprotocol/cofhe-contracts/FHE.sol](mailto:@fhenixprotocol/cofhe-contracts/FHE.sol)";                                                                |
|                                                                                                                                                                                                 |
| contract P2PMarketplacePolicy is IUnderwriterPolicy, ERC165 {                                                                                                                                   |
| _// Risk tiers in basis points (100 bps = 1%)_                                                                                                                                                  |
| uint64 constant LOW*RISK = 200; *// 2% premium - small transactions\_                                                                                                                           |
| uint64 constant MED*RISK = 500; *// 5% premium - medium transactions\_                                                                                                                          |
| uint64 constant HIGH*RISK = 1000; *// 10% premium - large transactions\_                                                                                                                        |
|                                                                                                                                                                                                 |
| _// Coverage amount thresholds (6 decimals, USDC)_                                                                                                                                              |
| uint256 constant MED*THRESHOLD = 5000e6; *// \$5,000\_                                                                                                                                          |
| uint256 constant HIGH*THRESHOLD = 25000e6; *// \$25,000\_                                                                                                                                       |
|                                                                                                                                                                                                 |
| struct CoverageConfig {                                                                                                                                                                         |
| uint256 coverageAmount; _// stored from onPolicySet_                                                                                                                                            |
| uint256 createdAt;                                                                                                                                                                              |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| mapping(uint256 => CoverageConfig) public coverages;                                                                                                                                            |
|                                                                                                                                                                                                 |
| function onPolicySet(uint256 coverageId, bytes calldata data) external {                                                                                                                        |
| uint256 coverageAmount = abi.decode(data, (uint256));                                                                                                                                           |
| coverages\[coverageId\] = CoverageConfig(coverageAmount, block.timestamp);                                                                                                                      |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function evaluateRisk(uint256, bytes calldata riskProof)                                                                                                                                        |
| external returns (euint64)                                                                                                                                                                      |
| {                                                                                                                                                                                               |
| uint256 amount = abi.decode(riskProof, (uint256));                                                                                                                                              |
|                                                                                                                                                                                                 |
| _// Tiered risk based on transaction size_                                                                                                                                                      |
| uint64 score;                                                                                                                                                                                   |
| if (amount >= HIGH_THRESHOLD) {                                                                                                                                                                 |
| score = HIGH_RISK;                                                                                                                                                                              |
| } else if (amount >= MED_THRESHOLD) {                                                                                                                                                           |
| score = MED_RISK;                                                                                                                                                                               |
| } else {                                                                                                                                                                                        |
| score = LOW_RISK;                                                                                                                                                                               |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| _// Encrypt the score - protocol uses it to calculate premium_                                                                                                                                  |
| euint64 encryptedScore = FHE.asEuint64(score);                                                                                                                                                  |
| FHE.allowThis(encryptedScore);                                                                                                                                                                  |
| FHE.allow(encryptedScore, msg.sender);                                                                                                                                                          |
| return encryptedScore;                                                                                                                                                                          |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function judge(uint256 coverageId, bytes calldata disputeProof)                                                                                                                                 |
| external returns (ebool)                                                                                                                                                                        |
| {                                                                                                                                                                                               |
| CoverageConfig memory config = coverages\[coverageId\];                                                                                                                                         |
| bool isValid = \_evaluateDispute(coverageId, config, disputeProof);                                                                                                                             |
|                                                                                                                                                                                                 |
| ebool result = FHE.asEbool(isValid);                                                                                                                                                            |
| FHE.allowThis(result);                                                                                                                                                                          |
| FHE.allow(result, msg.sender);                                                                                                                                                                  |
| return result;                                                                                                                                                                                  |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function \_evaluateDispute(                                                                                                                                                                     |
| uint256 coverageId,                                                                                                                                                                             |
| CoverageConfig memory config,                                                                                                                                                                   |
| bytes calldata disputeProof                                                                                                                                                                     |
| ) internal view returns (bool) {                                                                                                                                                                |
| _// Decode dispute evidence_                                                                                                                                                                    |
| (                                                                                                                                                                                               |
| bool hasPayPalDispute, _// PayPal opened a dispute case_                                                                                                                                        |
| uint256 disputeTimestamp, _// when PayPal dispute was filed_                                                                                                                                    |
| bytes memory zkProof _// zkTLS proof of PayPal dispute status_                                                                                                                                  |
| ) = abi.decode(disputeProof, (bool, uint256, bytes));                                                                                                                                           |
|                                                                                                                                                                                                 |
| _// Rule 1: Must have an active PayPal dispute_                                                                                                                                                 |
| if (!hasPayPalDispute) return false;                                                                                                                                                            |
|                                                                                                                                                                                                 |
| _// Rule 2: Dispute must have been filed within 30 days of coverage_                                                                                                                            |
| if (disputeTimestamp > config.createdAt + 30 days) return false;                                                                                                                                |
| if (disputeTimestamp < config.createdAt) return false;                                                                                                                                          |
|                                                                                                                                                                                                 |
| _// Rule 3: zkTLS proof must be present_                                                                                                                                                        |
| if (zkProof.length == 0) return false;                                                                                                                                                          |
|                                                                                                                                                                                                 |
| _// All checks passed - claim is legitimate_                                                                                                                                                    |
| return true;                                                                                                                                                                                    |
| }                                                                                                                                                                                               |
|                                                                                                                                                                                                 |
| function supportsInterface(bytes4 interfaceId) public view override returns (bool) {                                                                                                            |
| return interfaceId == type(IUnderwriterPolicy).interfaceId                                                                                                                                      |
| \| super.supportsInterface(interfaceId);                                                                                                                                                        |
| }                                                                                                                                                                                               |
| }                                                                                                                                                                                               |

### **How the economics work**

**1**

### **Buyer purchases coverage**

Buyer wants to insure a \$1,000 P2P trade. Policy evaluates risk at 200 bps (2%).

**Premium = \$1,000 x 2% = \$20**

**2**

### **Premium flows to pool**

The \$20 premium is transferred (encrypted) to the insurance pool. Pool stakers earn yield from this premium.

**3**

### **Trade completes normally**

Most trades complete without issues. The coverage expires after 30 days. The pool keeps the \$20 premium - pure profit for stakers.

**4**

### **Or: dispute filed**

Buyer proves PayPal reversed the payment (zkTLS proof). Policy judge() validates the evidence and approves the claim.

**\$1,000 claim paid from pool liquidity**

### **Register and deploy**

register-policy.tsCopy

| _// Deploy your policy contract to Arbitrum_      |
| ------------------------------------------------- |
| _// Then register it with the protocol_           |
| _// Get your pool and add the policy_             |
| const pool = await sdk.insurance.getPool(0n)      |
| await pool.addPolicy('0xP2PMarketplacePolicy...') |

## **Policy design patterns**

| **Domain**             | **Risk evaluation**                       | **Dispute evidence**                                          |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| P2P marketplace        | Tiered by transaction size                | zkTLS proof of payment reversal (PayPal, Stripe)              |
| Cargo / logistics      | Route risk × cargo value × carrier rating | IoT sensor data or inspection report via oracle               |
| Freelance / milestones | Contractor reputation score               | On-chain proof of milestone non-completion                    |
| Cross-border payroll   | Fixed low risk for verified employers     | Government API proof of employment termination (zkTLS)        |
| DeFi settlement        | Volatility-adjusted by asset pair         | Chainlink price deviation beyond threshold at settlement time |

## **The revenue opportunity**

Policy builders who write accurate risk models attract more pools, more stakers, and more coverage purchases. The math is simple:

- A pool with \$100K liquidity backing your policy
- Average 3% premium across all coverages
- \$500K in monthly coverage volume
- \= **\$15K/month in premiums** flowing to the pool
- Pool stakers earn their share; you can stake into your own pool

**Accuracy is the moat**

The best policy builders - those whose claim rates match their risk predictions - build the most trusted pools in the ecosystem. Like Morpho vault curators, accuracy is the moat.

**Insurance Pools**

Create permissionless Insurance pools, curate policies, provide liquidity, and earn premiums from every coverage purchase.

8 min read

Anyone can create an Insurance pool, attach policies, provide liquidity, and earn premiums. This is the open economy layer of ReineiraOS - the best underwriters build the best pools and earn the most.

## **The model**

Think of insurance pools like Morpho vaults:

- **You** create a pool and curate which policies it supports
- **Stakers** deposit liquidity into your pool
- **Buyers / developers** purchase coverage from your pool
- **Premiums** flow to the pool on every coverage purchase
- **You and stakers** earn yield from premiums

**Quality drives growth**

The better your policies (accurate risk scoring, fair disputes), the more builders trust your pool, the more coverage is purchased, the more everyone earns.

## **Create a pool**

create-pool.tsCopy

| const pool = await sdk.insurance.createPool({ |
| --------------------------------------------- |
| paymentToken: sdk.addresses.confidentialUSDC, |
| })                                            |
|                                               |
| console.log('Pool ID:', pool.id)              |
| console.log('Pool address:', pool.address)    |

You are now an underwriter. The pool is yours to manage.

## **Manage policies**

Add or remove IUnderwriterPolicy contracts that your pool supports:

manage-policies.tsCopy

| _// Allow a policy to be used with your pool_         |
| ----------------------------------------------------- |
| await pool.addPolicy('0xMarketplaceDisputePolicy...') |
| await pool.addPolicy('0xCargoInsurancePolicy...')     |
|                                                       |
| _// Remove a policy_                                  |
| await pool.removePolicy('0xOldPolicy...')             |

Buyers / developers can only purchase coverage using policies your pool has approved.

## **Provide liquidity**

Stake into your own pool or invite others:

stake.tsCopy

| _// Approve and stake_                                      |
| ----------------------------------------------------------- |
| const { stakeId, tx } = await pool.stake(sdk.usdc(10000), { |
| autoApprove: true,                                          |
| })                                                          |
|                                                             |
| console.log('Stake ID:', stakeId)                           |

Staked liquidity backs the coverage your pool sells. When claims are paid, they come from this liquidity. Premiums accumulate in the pool as coverage is purchased.

## **Coverage lifecycle**

When a developer purchases coverage from your pool:

| **Step**                | **What happens**                                                     | **Who acts**         |
| ----------------------- | -------------------------------------------------------------------- | -------------------- |
| 1\. Purchase            | Builder calls SDK with pool, policy, escrow, coverage amount, expiry | Buyer / developer    |
| 2\. Risk evaluation     | Policy's evaluateRisk() returns encrypted risk score                 | Your policy contract |
| 3\. Premium payment     | Buyer pays premium based on risk score (encrypted)                   | Protocol (automatic) |
| 4\. Active coverage     | Coverage is now active until expiry                                  | -                    |
| 5\. Dispute (if needed) | Buyer files dispute with proof                                       | Buyer / developer    |
| 6\. Judgment            | Policy's judge() returns encrypted verdict                           | Your policy contract |
| 7\. Claim payout        | If valid, claim is paid from pool liquidity                          | Protocol (automatic) |

## **Coverage states**

| **State** | **Meaning**                                            |
| --------- | ------------------------------------------------------ |
| Active    | Coverage is live - disputes can be filed               |
| Disputed  | A dispute has been filed and is being judged           |
| Claimed   | Dispute was valid - claim paid from pool               |
| Expired   | Coverage period ended with no dispute - premium earned |

## **Purchase coverage (developer side)**

**Purchase coverage**Atomic escrow + coverage

Copy

| const coverage = await sdk.insurance.purchaseCoverage({                              |
| ------------------------------------------------------------------------------------ |
| pool: '0xPool...',                                                                   |
| policy: '0xPolicy...',                                                               |
| escrowId: escrow.id,                                                                 |
| coverageAmount: sdk.usdc(50000),                                                     |
| expiry: Math.floor(Date.now() / 1000) + 86400 \* 30,                                 |
| })                                                                                   |
|                                                                                      |
| console.log('Coverage ID:', coverage.id)                                             |
|                                                                                      |
| _// Check status_                                                                    |
| const status = await coverage.status() _// Active \| Disputed \| Claimed \| Expired_ |
|                                                                                      |
| _// File a dispute_                                                                  |
| await coverage.dispute('0xProofBytes...')                                            |

## **Withdraw and unstake**

unstake.tsCopy

| _// Unstake_                                                   |
| -------------------------------------------------------------- |
| await pool.unstake(stakeId)                                    |
|                                                                |
| _// Premium distribution to individual stakers is in progress_ |
| _// Premiums accumulate in the pool for now_                   |

## **Privacy**

All financial values in the insurance system are FHE-encrypted:

- Stake amounts
- Coverage amounts
- Risk scores
- Premium payments
- Claim payouts

**On-chain privacy**

On-chain events emit only indexed IDs. No amounts, no addresses, no policy details are visible to chain observers.