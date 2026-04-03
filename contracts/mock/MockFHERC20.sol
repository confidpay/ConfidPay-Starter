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

    mapping(address => euint128) private _confidentialBalances;
    uint128 private _totalSupply;

    // Plaintext storage for mock testing (not confidential)
    mapping(address => uint128) private _plaintextBalances;

    // ================================================================================
    // MINT & BURN (for testing)
    // ================================================================================

    function mint(address to, uint128 amount) external {
        if (to == address(0)) revert MockFHERC20__ZeroAddress();
        
        euint128 encryptedAmount = FHE.asEuint128(amount);
        
        // Update encrypted balance
        _confidentialBalances[to] = FHE.add(_confidentialBalances[to], encryptedAmount);
        
        // Grant ACL permissions to correct address
        FHE.allowThis(_confidentialBalances[to]);
        FHE.allow(_confidentialBalances[to], to);
        
        // Update plaintext for easy testing
        _plaintextBalances[to] += amount;
        _totalSupply += amount;
    }

    function burn(address from, uint128 amount) external {
        if (from == address(0)) revert MockFHERC20__ZeroAddress();
        
        euint128 encryptedAmount = FHE.asEuint128(amount);
        
        // Update encrypted balance
        _confidentialBalances[from] = FHE.sub(_confidentialBalances[from], encryptedAmount);
        
        // Grant ACL permissions to correct address
        FHE.allowThis(_confidentialBalances[from]);
        FHE.allow(_confidentialBalances[from], from);
        
        // Update plaintext
        _plaintextBalances[from] -= amount;
        _totalSupply -= amount;
    }

    // ================================================================================
    // CONFIDENTIAL TRANSFER
    // ================================================================================

    function confidentialTransfer(address to, InEuint128 memory encryptedAmount) 
        external 
        returns (euint128) 
    {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        return _transfer(msg.sender, to, amount);
    }

    function confidentialTransfer(address to, euint128 amount) 
        external 
        returns (euint128) 
    {
        return _transfer(msg.sender, to, amount);
    }

    function confidentialTransferFrom(
        address from,
        address to,
        InEuint128 memory encryptedAmount
    ) external returns (euint128) {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        return _transfer(from, to, amount);
    }

    function _transfer(
        address from,
        address to,
        euint128 amount
    ) internal returns (euint128) {
        if (from == address(0) || to == address(0)) revert MockFHERC20__ZeroAddress();

        // Get encrypted balances
        euint128 fromBalance = _confidentialBalances[from];
        euint128 toBalance = _confidentialBalances[to];

        // Privacy-preserving: transfer amount if sufficient balance, else zero
        euint128 transferred = FHE.select(
            amount.lte(fromBalance),
            amount,
            FHE.asEuint128(0)
        );

        // Update encrypted balances
        _confidentialBalances[from] = FHE.sub(fromBalance, transferred);
        _confidentialBalances[to] = FHE.add(toBalance, transferred);

        // Update plaintext for testing verification
        uint128 plaintextFromBefore = _plaintextBalances[from];
        _plaintextBalances[from] -= plaintextFromBefore;
        _plaintextBalances[to] += plaintextFromBefore;

        // Grant ACL permissions to correct addresses
        FHE.allowThis(_confidentialBalances[from]);
        FHE.allowThis(_confidentialBalances[to]);
        FHE.allow(_confidentialBalances[from], from);
        FHE.allow(_confidentialBalances[to], to);

        return transferred;
    }

    // ================================================================================
    // BALANCE QUERIES
    // ================================================================================

    function confidentialBalanceOf(address account) external view returns (euint128) {
        return _confidentialBalances[account];
    }

    // Plaintext balance for testing (not confidential)
    function plaintextBalanceOf(address account) external view returns (uint128) {
        return _plaintextBalances[account];
    }

    function totalSupply() external view returns (uint128) {
        return _totalSupply;
    }
}
