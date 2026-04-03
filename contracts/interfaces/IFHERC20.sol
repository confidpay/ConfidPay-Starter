// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title IFHERC20
 * @notice Interface for confidential ERC20 tokens (FHERC20)
 * @dev Used by ConfidPay to interact with confidential payment tokens
 * @dev Follows standard FHERC20 using euint64 for balances/transfers
 */
interface IFHERC20 {
    /**
     * @notice Transfer confidential tokens to a recipient (encrypted input)
     * @param to The recipient address
     * @param encryptedAmount Encrypted amount from user input
     */
    function confidentialTransfer(address to, InEuint64 memory encryptedAmount) external returns (euint64);

    /**
     * @notice Transfer confidential tokens to a recipient (already encrypted)
     * @param to The recipient address
     * @param amount Already-encrypted amount from contract computation
     */
    function confidentialTransfer(address to, euint64 amount) external returns (euint64);

    /**
     * @notice Transfer confidential tokens from one address to another
     * @param from Source address
     * @param to Destination address
     * @param encryptedAmount The encrypted amount
     */
    function confidentialTransferFrom(
        address from,
        address to,
        InEuint64 memory encryptedAmount
    ) external returns (euint64);

    /**
     * @notice Get the confidential balance of an account
     * @param account The account to check
     * @return The encrypted balance handle
     */
    function confidentialBalanceOf(address account) external view returns (euint64);

    /**
     * @notice Mint new tokens (for testing/admin purposes)
     * @param to Recipient address
     * @param amount Plaintext amount to mint
     */
    function mint(address to, uint64 amount) external;

    /**
     * @notice Burn tokens (for testing/admin purposes)
     * @param from Address to burn from
     * @param amount Plaintext amount to burn
     */
    function burn(address from, uint64 amount) external;
}

/**
 * @title IConfidentialEscrow
 * @notice Interface for ReineiraOS Confidential Escrow
 * @dev Matches real deployed contract on Arbitrum Sepolia
 * @dev Contract: 0xC4333F84F5034D8691CB95f068def2e3B6DC60Fa
 */
interface IConfidentialEscrow {
    /**
     * @notice Create a confidential escrow
     * @param owner Address of the escrow recipient
     * @param amount Escrow amount in USDC units
     * @param resolver Address of IConditionResolver contract (address(0) for unconditional)
     * @param resolverData ABI-encoded data for resolver's onConditionSet hook
     * @return escrowId ID of created escrow
     */
    function create(
        address owner,
        uint256 amount,
        address resolver,
        bytes calldata resolverData
    ) external returns (uint256);

    /**
     * @notice Fund an escrow with USDC
     * @param escrowId ID of escrow to fund
     * @param amount Amount to fund (in USDC units)
     */
    function fund(uint256 escrowId, uint256 amount) external;

    /**
     * @notice Redeem funds from an escrow
     * @param escrowId ID of escrow to redeem
     */
    function redeem(uint256 escrowId) external;

    /**
     * @notice Batch redeem multiple escrows
     * @param escrowIds Array of escrow IDs to redeem
     */
    function redeemMultiple(uint256[] calldata escrowIds) external;

    /**
     * @notice Check if escrow exists
     * @param escrowId ID to check
     * @return exists Whether escrow exists
     */
    function exists(uint256 escrowId) external view returns (bool);

    /**
     * @notice Check if escrow is funded
     * @param escrowId ID to check
     * @return funded Whether escrow is funded
     */
    function isFunded(uint256 escrowId) external view returns (bool);

    /**
     * @notice Check if escrow is redeemable (funded + condition met)
     * @param escrowId ID to check
     * @return redeemable Whether escrow can be redeemed
     */
    function isRedeemable(uint256 escrowId) external view returns (bool);

    /**
     * @notice Get the payment token address
     * @return token The USDC token address
     */
    function paymentToken() external view returns (address);
}

/**
 * @title IInsuranceManager
 * @notice Interface for insurance coverage on escrows
 * @dev Matches real Insurance contract on Arbitrum Sepolia
 */
interface IInsuranceManager {
    /**
     * @notice Purchase coverage for an escrow
     * @param pool Insurance pool address
     * @param policy Policy contract address
     * @param escrowId Escrow ID to cover
     * @param coverageAmount Amount of coverage
     * @param expiry Unix timestamp when coverage expires
     * @return coverageId ID of purchased coverage
     */
    function purchaseCoverage(
        address pool,
        address policy,
        uint256 escrowId,
        uint256 coverageAmount,
        uint256 expiry
    ) external returns (uint256);

    /**
     * @notice Get coverage status
     * @param coverageId Coverage ID to check
     * @return status 0=Active, 1=Disputed, 2=Claimed, 3=Expired
     */
    function getCoverageStatus(uint256 coverageId) external view returns (uint8);
}
