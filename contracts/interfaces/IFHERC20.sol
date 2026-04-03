// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title IFHERC20
 * @notice Interface for confidential ERC20 tokens (FHERC20)
 * @dev Used by ConfidPay to interact with confidential payment tokens
 */
interface IFHERC20 {
    /**
     * @notice Transfer confidential tokens to a recipient (encrypted input)
     * @param to The recipient address
     * @param encryptedAmount Encrypted amount from user input
     */
    function confidentialTransfer(address to, InEuint128 memory encryptedAmount) external returns (euint128);

    /**
     * @notice Transfer confidential tokens to a recipient (already encrypted)
     * @param to The recipient address
     * @param amount Already-encrypted amount from contract computation
     */
    function confidentialTransfer(address to, euint128 amount) external returns (euint128);

    /**
     * @notice Transfer confidential tokens from one address to another
     * @param from Source address
     * @param to Destination address
     * @param encryptedAmount The encrypted amount
     */
    function confidentialTransferFrom(
        address from,
        address to,
        InEuint128 memory encryptedAmount
    ) external returns (euint128);

    /**
     * @notice Get the confidential balance of an account
     * @param account The account to check
     * @return The encrypted balance handle
     */
    function confidentialBalanceOf(address account) external view returns (euint128);

    /**
     * @notice Mint new tokens (for testing/admin purposes)
     * @param to Recipient address
     * @param amount Plaintext amount to mint
     */
    function mint(address to, uint128 amount) external;

    /**
     * @notice Burn tokens (for testing/admin purposes)
     * @param from Address to burn from
     * @param amount Plaintext amount to burn
     */
    function burn(address from, uint128 amount) external;
}
