// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "../interfaces/IFHERC20.sol";

/**
 * @title MockFHERC20
 * @notice Mock implementation of FHERC20 for testing
 * @dev Simulates confidential token transfers using FHE mock operations
 */
contract MockFHERC20 is IFHERC20 {
    string public name = "Mock Confidential USDC";
    string public symbol = "eUSDC";
    uint8 public decimals = 6;

    // ================================================================================
    // ERRORS
    // ================================================================================
    error MockFHERC20__ZeroAddress();
    error MockFHERC20__InsufficientBalance();

    mapping(address => euint64) private _confidentialBalances;
    uint64 private _totalSupply;

    // Plaintext storage for mock testing (not confidential)
    mapping(address => uint64) private _plaintextBalances;

    // ================================================================================
    // MINT & BURN (for testing)
    // ================================================================================

    function mint(address to, uint64 amount) external {
        if (to == address(0)) revert MockFHERC20__ZeroAddress();
        
        euint64 encryptedAmount = FHE.asEuint64(amount);
        
        // Update encrypted balance
        _confidentialBalances[to] = FHE.add(_confidentialBalances[to], encryptedAmount);
        
        // Grant ACL permissions to correct address
        FHE.allowThis(_confidentialBalances[to]);
        FHE.allow(_confidentialBalances[to], to); // Grant TO address access
        
        // Update plaintext for easy testing
        _plaintextBalances[to] += amount;
        _totalSupply += amount;
    }

    function burn(address from, uint64 amount) external {
        if (from == address(0)) revert MockFHERC20__ZeroAddress();
        
        euint64 encryptedAmount = FHE.asEuint64(amount);
        
        // Update encrypted balance
        _confidentialBalances[from] = FHE.sub(_confidentialBalances[from], encryptedAmount);
        
        // Grant ACL permissions to correct address
        FHE.allowThis(_confidentialBalances[from]);
        FHE.allow(_confidentialBalances[from], from); // Grant FROM address access
        
        // Update plaintext
        _plaintextBalances[from] -= amount;
        _totalSupply -= amount;
    }

    // ================================================================================
    // CONFIDENTIAL TRANSFER
    // ================================================================================

    function confidentialTransfer(address to, InEuint64 memory encryptedAmount) 
        external 
        returns (euint64) 
    {
        euint64 amount = FHE.asEuint64(encryptedAmount);
        return _transfer(msg.sender, to, amount);
    }

    function confidentialTransferFrom(
        address from,
        address to,
        InEuint64 memory encryptedAmount
    ) external returns (euint64) {
        euint64 amount = FHE.asEuint64(encryptedAmount);
        return _transfer(from, to, amount);
    }

    function _transfer(
        address from,
        address to,
        euint64 amount
    ) internal returns (euint64) {
        if (from == address(0) || to == address(0)) revert MockFHERC20__ZeroAddress();

        // Get encrypted balances
        euint64 fromBalance = _confidentialBalances[from];
        euint64 toBalance = _confidentialBalances[to];

        // Privacy-preserving: transfer amount if sufficient balance, else zero
        // This uses FHE comparison - the real balance check happens on encrypted data
        euint64 transferred = FHE.select(
            amount.lte(fromBalance),
            amount,
            FHE.asEuint64(0)
        );

        // Update encrypted balances
        _confidentialBalances[from] = FHE.sub(fromBalance, transferred);
        _confidentialBalances[to] = FHE.add(toBalance, transferred);

        // Update plaintext for testing verification
        // Note: In real FHERC20, we can't track plaintext. 
        // For mock testing, we use plaintext for verification only.
        uint64 plaintextFromBefore = _plaintextBalances[from];
        _plaintextBalances[from] -= plaintextFromBefore;
        _plaintextBalances[to] += plaintextFromBefore;

        // Grant ACL permissions to correct addresses
        FHE.allowThis(_confidentialBalances[from]);
        FHE.allowThis(_confidentialBalances[to]);
        FHE.allow(_confidentialBalances[from], from); // Grant FROM address access
        FHE.allow(_confidentialBalances[to], to);     // Grant TO address access

        return transferred;
    }

    // ================================================================================
    // BALANCE QUERIES
    // ================================================================================

    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _confidentialBalances[account];
    }

    // Plaintext balance for testing (not confidential)
    function plaintextBalanceOf(address account) external view returns (uint64) {
        return _plaintextBalances[account];
    }

    function totalSupply() external view returns (uint64) {
        return _totalSupply;
    }
}
