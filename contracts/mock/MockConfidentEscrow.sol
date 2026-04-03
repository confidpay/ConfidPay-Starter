// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title MockConfidentEscrow
 * @notice Mock implementation of ReineiraOS ConfidentialEscrow for local testing
 */
contract MockConfidentEscrow {
    uint256 private _escrowCounter;
    mapping(uint256 => bool) private _escrows;
    mapping(uint256 => bool) private _funded;
    mapping(uint256 => bool) private _redeemed;
    mapping(uint256 => address) private _owners;
    mapping(uint256 => uint64) private _amounts;
    
    address public paymentToken;
    
    event EscrowCreated(uint256 indexed escrowId, address indexed owner);
    event EscrowFunded(uint256 indexed escrowId, address indexed payer);
    event EscrowRedeemed(uint256 indexed escrowId);
    
    constructor(address _paymentToken) {
        _escrowCounter = 0;
        paymentToken = _paymentToken;
    }
    
    function create(
        address owner,
        uint256 amount,
        address resolver,
        bytes calldata resolverData
    ) external returns (uint256) {
        uint256 escrowId = _escrowCounter++;
        _escrows[escrowId] = true;
        _owners[escrowId] = owner;
        _amounts[escrowId] = uint64(amount);
        
        emit EscrowCreated(escrowId, _owners[escrowId]);
        return escrowId;
    }
    
    function fund(uint256 escrowId, uint256 amount) external {
        require(_escrows[escrowId], "Escrow does not exist");
        _funded[escrowId] = true;
        emit EscrowFunded(escrowId, msg.sender);
    }
    
    function redeem(uint256 escrowId) public {
        require(_escrows[escrowId], "Escrow does not exist");
        require(_funded[escrowId], "Escrow not funded");
        require(!_redeemed[escrowId], "Already redeemed");
        require(_owners[escrowId] == msg.sender, "Not owner");
        
        _redeemed[escrowId] = true;
        
        emit EscrowRedeemed(escrowId);
    }
    
    function redeemMultiple(uint256[] calldata escrowIds) external {
        for (uint256 i = 0; i < escrowIds.length; i++) {
            _redeemInternal(escrowIds[i]);
        }
    }
    
    function _redeemInternal(uint256 escrowId) internal {
        require(_escrows[escrowId], "Escrow does not exist");
        require(_funded[escrowId], "Escrow not funded");
        require(!_redeemed[escrowId], "Already redeemed");
        require(_owners[escrowId] == msg.sender, "Not owner");
        
        _redeemed[escrowId] = true;
        
        emit EscrowRedeemed(escrowId);
    }
    
    function exists(uint256 escrowId) external view returns (bool) {
        return _escrows[escrowId];
    }
    
    function isFunded(uint256 escrowId) external view returns (bool) {
        return _funded[escrowId];
    }
    
    function isRedeemable(uint256 escrowId) external view returns (bool) {
        return _escrows[escrowId] && _funded[escrowId];
    }
    
    function ownerOf(uint256 escrowId) external view returns (address) {
        return _owners[escrowId];
    }
    
    function amountOf(uint256 escrowId) external view returns (uint64) {
        return _amounts[escrowId];
    }
}