// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title MockInsuranceManager
 * @notice Mock implementation of ReineiraOS Insurance for local testing
 */
contract MockInsuranceManager {
    uint256 private _coverageCounter;
    address public owner;
    
    struct Coverage {
        uint256 id;
        uint256 poolId;
        address policy;
        uint256 escrowId;
        uint256 coverageAmount;
        uint256 expiry;
        uint8 status; // 0=Active, 1=Disputed, 2=Claimed, 3=Expired
        bool exists;
    }
    
    mapping(uint256 => Coverage) private _coverages;
    mapping(address => uint256[]) private _userCoverages;
    
    event CoveragePurchased(
        uint256 indexed coverageId,
        address indexed pool,
        address indexed policy,
        uint256 escrowId,
        uint256 coverageAmount
    );
    event DisputeFiled(uint256 indexed coverageId, address indexed filer);
    event ClaimResolved(uint256 indexed coverageId, bool valid);
    
    error InsuranceManager__Unauthorized();
    error InsuranceManager__CoverageNotFound();
    error InsuranceManager__CoverageNotActive();
    error InsuranceManager__CoverageNotDisputed();
    
    constructor() {
        _coverageCounter = 0;
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert InsuranceManager__Unauthorized();
        _;
    }
    
    function purchaseCoverage(
        address pool,
        address policy,
        uint256 escrowId,
        uint256 coverageAmount,
        uint256 expiry
    ) external returns (uint256) {
        uint256 coverageId = _coverageCounter++;
        
        _coverages[coverageId] = Coverage({
            id: coverageId,
            poolId: uint256(uint160(pool)),
            policy: policy,
            escrowId: escrowId,
            coverageAmount: coverageAmount,
            expiry: expiry,
            status: 0, // Active
            exists: true
        });
        
        _userCoverages[msg.sender].push(coverageId);
        
        emit CoveragePurchased(coverageId, pool, policy, escrowId, coverageAmount);
        
        return coverageId;
    }
    
    function getCoverageStatus(uint256 coverageId) external view returns (uint8) {
        if (!_coverages[coverageId].exists) revert InsuranceManager__CoverageNotFound();
        
        Coverage memory coverage = _coverages[coverageId];
        
        // Check if expired
        if (coverage.expiry > 0 && block.timestamp > coverage.expiry) {
            return 3; // Expired
        }
        
        return coverage.status;
    }
    
    function getCoverage(uint256 coverageId) external view returns (
        uint256 id,
        uint256 poolId,
        address policy,
        uint256 escrowId,
        uint256 coverageAmount,
        uint256 expiry,
        uint8 status
    ) {
        if (!_coverages[coverageId].exists) revert InsuranceManager__CoverageNotFound();
        
        Coverage memory coverage = _coverages[coverageId];
        
        // Return status synced with expiry check
        uint8 effectiveStatus = coverage.status;
        if (coverage.expiry > 0 && block.timestamp > coverage.expiry) {
            effectiveStatus = 3; // Expired
        }
        
        return (
            coverage.id,
            coverage.poolId,
            coverage.policy,
            coverage.escrowId,
            coverage.coverageAmount,
            coverage.expiry,
            effectiveStatus
        );
    }
    
    function fileDispute(uint256 coverageId, bytes calldata proof) external {
        if (!_coverages[coverageId].exists) revert InsuranceManager__CoverageNotFound();
        if (_coverages[coverageId].status != 0) revert InsuranceManager__CoverageNotActive();
        
        _coverages[coverageId].status = 1; // Disputed
        
        emit DisputeFiled(coverageId, msg.sender);
    }
    
    function resolveClaim(uint256 coverageId, bool valid) external onlyOwner {
        if (!_coverages[coverageId].exists) revert InsuranceManager__CoverageNotFound();
        if (_coverages[coverageId].status != 1) revert InsuranceManager__CoverageNotDisputed();
        
        _coverages[coverageId].status = valid ? 2 : 0; // Claimed or back to Active
        
        emit ClaimResolved(coverageId, valid);
    }
    
    function getUserCoverageCount(address user) external view returns (uint256) {
        return _userCoverages[user].length;
    }
    
    function getUserCoverageIds(address user) external view returns (uint256[] memory) {
        return _userCoverages[user];
    }
}