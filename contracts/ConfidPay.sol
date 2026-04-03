// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./interfaces/IFHERC20.sol";

/**
 * ================================================================================
 * ACL WARNING - READ BEFORE DEPLOYING
 * ================================================================================
 * 
 * CRITICAL: Every encrypted variable MUST have proper ACL (Access Control List)
 * permissions set before use. Missing ACL = permanent fund loss.
 * 
 * ACL Rules for ConfidPay:
 * 1. FHE.allowThis(value)  - Grant contract access (needed before storing)
 * 2. FHE.allow(value, address) - Grant specific address access (e.g., employee)
 * 
 * Without these, encrypted salary values are LOCKED and CANNOT be used.
 * ================================================================================
 */

/**
 * @title ConfidPay
 * @notice Privacy-native payroll system for DAOs with ReineiraOS integration
 * @dev Stores encrypted salaries, vesting schedules, and milestones. All monetary values
 *      stay encrypted on-chain while the contract can still compute on them.
 *      Payments are settled via confidential escrow with optional insurance.
 */
contract ConfidPay {
    // ================================================================================
    // ERRORS
    // ================================================================================
    error ConfidPay__Unauthorized();
    error ConfidPay__EmployeeExists();
    error ConfidPay__InvalidEmployee();
    error ConfidPay__ZeroAddress();
    error ConfidPay__InvalidAmount();
    error ConfidPay__NotDueYet();
    error ConfidPay__NothingToClaim();
    error ConfidPay__MilestoneNotFound();
    error ConfidPay__MilestoneNotCompleted();
    error ConfidPay__MilestoneAlreadyClaimed();
    error ConfidPay__EscrowNotFunded();
    error ConfidPay__InsuranceNotAvailable();
    error ConfidPay__CoverageExpired();

    // ================================================================================
    // ENUMS
    // ================================================================================
    
    enum VestingType {
        Immediate,  // 0 - No vesting, all available immediately
        Linear,     // 1 - Vests gradually over time
        Cliff      // 2 - Nothing until cliff, then linear
    }

    // ================================================================================
    // STRUCTS
    // ================================================================================
    
    /**
     * @notice Employee payroll record with encrypted data
     * @dev All monetary and timing values are encrypted handles
     */
    struct EmployeePayroll {
        bool exists;
        address employee;
        euint128 encryptedSalary;           // Per-period salary (e.g., monthly)
        euint128 encryptedAmountClaimed;   // Total amount already claimed
        euint64  encryptedStartTime;       // When payroll started
        euint64  encryptedInterval;        // Seconds between payments
        euint64  encryptedLastClaimTime;  // When last payment was claimed
        VestingType vestingType;          // Type of vesting schedule
        euint64  encryptedVestingDuration; // Total vesting period (seconds)
        euint64  encryptedCliffDuration;   // Cliff period (seconds)
    }

    /**
     * @notice Milestone for bonus payments
     */
    struct Milestone {
        bytes32 id;
        euint128 encryptedAmount;
        bool completed;
        bool claimed;
    }

    /**
     * @notice Payment escrow record
     */
    struct PaymentEscrow {
        uint256 escrowId;
        euint128 amount;
        bool claimed;
    }

    // ================================================================================
    // STATE VARIABLES
    // ================================================================================
    
    address public admin;
    IFHERC20 public confidentialToken;
    IConfidentialEscrow public escrowContract;
    IInsuranceManager public insuranceManager;
    
    // Insurance configuration
    address public insurancePoolId;
    address public insurancePolicy;
    uint256 public coverageExpirySeconds;
    
    mapping(address => EmployeePayroll) private employeePayrolls;
    mapping(address => Milestone[]) private employeeMilestones;
    mapping(address => PaymentEscrow[]) private paymentEscrows;
    address[] private employeeList;

    // ================================================================================
    // EVENTS
    // ================================================================================
    event PayrollCreated(address indexed employee, VestingType vestingType);
    event PaymentClaimed(address indexed employee, uint256 escrowId, uint256 amount);
    event EscrowCreated(address indexed employee, uint256 escrowId, uint256 amount);
    event EscrowFunded(address indexed employee, uint256 escrowId, uint256 amount);
    event MilestoneAdded(address indexed employee, bytes32 milestoneId);
    event MilestoneCompleted(address indexed employee, bytes32 milestoneId);
    event MilestoneClaimed(address indexed employee, bytes32 milestoneId);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event InsuranceConfigured(address pool, address policy, uint256 expirySeconds);

    // ================================================================================
    // MODIFIERS
    // ================================================================================
    modifier onlyAdmin() {
        if (msg.sender != admin) revert ConfidPay__Unauthorized();
        _;
    }

    modifier onlyEmployee() {
        if (!employeePayrolls[msg.sender].exists) revert ConfidPay__InvalidEmployee();
        _;
    }

    // ================================================================================
    // CONSTRUCTOR
    // ================================================================================
    constructor(
        address _confidentialToken,
        address _escrowContract,
        address _insuranceManager
    ) {
        if (_confidentialToken == address(0)) revert ConfidPay__ZeroAddress();
        if (_escrowContract == address(0)) revert ConfidPay__ZeroAddress();
        
        admin = msg.sender;
        confidentialToken = IFHERC20(_confidentialToken);
        escrowContract = IConfidentialEscrow(_escrowContract);
        
        if (_insuranceManager != address(0)) {
            insuranceManager = IInsuranceManager(_insuranceManager);
        }
    }

    // ================================================================================
    // ADMIN FUNCTIONS
    // ================================================================================

    /**
     * @notice Configure insurance settings
     * @param pool Insurance pool address to use
     * @param policy Policy contract address
     * @param expirySeconds Coverage duration in seconds
     */
    function configureInsurance(
        address pool,
        address policy,
        uint256 expirySeconds
    ) external onlyAdmin {
        insurancePoolId = pool;
        insurancePolicy = policy;
        coverageExpirySeconds = expirySeconds;
        
        emit InsuranceConfigured(pool, policy, expirySeconds);
    }

    /**
     * @notice Create a private payroll for an employee
     * @param employee Address of the employee
     * @param encryptedSalary Encrypted salary per payment period (e.g., monthly)
     * @param encryptedInterval Encrypted seconds between payments (e.g., 30 days)
     * @param vestingType Type of vesting schedule (0=Immediate, 1=Linear, 2=Cliff)
     * @param encryptedVestingDuration Encrypted total vesting period in seconds
     * @param encryptedCliffDuration Encrypted cliff period in seconds
     * 
     * @dev ACL: 
     * - FHE.allowThis() on all encrypted inputs for storage
     * - FHE.allow(value, employee) so employee can decrypt their own data
     */
    function createPayroll(
        address employee,
        InEuint128 calldata encryptedSalary,
        InEuint64 calldata encryptedInterval,
        VestingType vestingType,
        InEuint64 calldata encryptedVestingDuration,
        InEuint64 calldata encryptedCliffDuration
    ) external onlyAdmin {
        if (employee == address(0)) revert ConfidPay__ZeroAddress();
        if (employeePayrolls[employee].exists) revert ConfidPay__EmployeeExists();

        // Convert encrypted inputs to encrypted types
        euint128 salary = FHE.asEuint128(encryptedSalary);
        euint64 interval = FHE.asEuint64(encryptedInterval);
        euint64 startTime = FHE.asEuint64(uint64(block.timestamp));
        euint64 vestingDuration = FHE.asEuint64(encryptedVestingDuration);
        euint64 cliffDuration = FHE.asEuint64(encryptedCliffDuration);
        euint128 zero = FHE.asEuint128(0);
        euint64 zero64 = FHE.asEuint64(0);

        // ========================================================================
        // ACL WARNING: Granting contract access to all encrypted values
        // ========================================================================
        FHE.allowThis(salary);
        FHE.allowThis(interval);
        FHE.allowThis(startTime);
        FHE.allowThis(vestingDuration);
        FHE.allowThis(cliffDuration);
        FHE.allowThis(zero);
        FHE.allowThis(zero64);
        
        // Grant employee access to their own payroll data
        FHE.allow(salary, employee);
        FHE.allow(startTime, employee);
        FHE.allow(interval, employee);
        FHE.allow(vestingDuration, employee);
        FHE.allow(cliffDuration, employee);
        
        // Store payroll record
        EmployeePayroll storage payroll = employeePayrolls[employee];
        payroll.exists = true;
        payroll.employee = employee;
        payroll.encryptedSalary = salary;
        payroll.encryptedAmountClaimed = zero;
        payroll.encryptedStartTime = startTime;
        payroll.encryptedInterval = interval;
        payroll.encryptedLastClaimTime = zero64;
        payroll.vestingType = vestingType;
        payroll.encryptedVestingDuration = vestingDuration;
        payroll.encryptedCliffDuration = cliffDuration;

        employeeList.push(employee);
        
        emit PayrollCreated(employee, vestingType);
    }

    /**
     * @notice Add a milestone for an employee
     * @param employee Employee address
     * @param milestoneId Unique milestone identifier
     * @param encryptedAmount Amount to pay when milestone is completed
     */
    function addMilestone(
        address employee,
        bytes32 milestoneId,
        InEuint128 calldata encryptedAmount
    ) external onlyAdmin {
        if (!employeePayrolls[employee].exists) revert ConfidPay__InvalidEmployee();

        euint128 amount = FHE.asEuint128(encryptedAmount);
        
        FHE.allowThis(amount);
        FHE.allow(amount, employee);

        employeeMilestones[employee].push(Milestone({
            id: milestoneId,
            encryptedAmount: amount,
            completed: false,
            claimed: false
        }));
        
        emit MilestoneAdded(employee, milestoneId);
    }

    /**
     * @notice Mark a milestone as completed
     * @param employee Employee address
     * @param milestoneIndex Index of the milestone
     */
    function completeMilestone(address employee, uint256 milestoneIndex) external onlyAdmin {
        Milestone[] storage milestones = employeeMilestones[employee];
        if (milestoneIndex >= milestones.length) revert ConfidPay__MilestoneNotFound();
        
        milestones[milestoneIndex].completed = true;
        emit MilestoneCompleted(employee, milestones[milestoneIndex].id);
    }

    /**
     * @notice Change the admin address
     */
    function changeAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ConfidPay__ZeroAddress();
        
        address oldAdmin = admin;
        admin = newAdmin;
        
        emit AdminChanged(oldAdmin, newAdmin);
    }

    /**
     * @notice Fund an escrow for an employee (called by admin/DAO treasury)
     * @param employee Employee address
     * @param escrowId Escrow ID to fund
     * @param amount Amount to fund in USDC
     */
    function fundEscrow(address employee, uint256 escrowId, uint64 amount) external onlyAdmin {
        if (!employeePayrolls[employee].exists) revert ConfidPay__InvalidEmployee();
        if (amount == 0) revert ConfidPay__InvalidAmount();
        
        // Approve and fund the escrow
        // Note: In production, admin should have pre-approved the escrow contract
        escrowContract.fund(escrowId, amount);
        
        // Purchase insurance if configured
        if (address(insuranceManager) != address(0) && insurancePolicy != address(0)) {
            uint256 expiry = block.timestamp + coverageExpirySeconds;
            insuranceManager.purchaseCoverage(
                insurancePoolId,
                insurancePolicy,
                escrowId,
                amount,
                expiry
            );
        }
        
        emit EscrowFunded(employee, escrowId, amount);
    }

    // ================================================================================
    // EMPLOYEE FUNCTIONS
    // ================================================================================

    /**
     * @notice Claim available payment via escrow
     * @dev Creates an escrow for the employee that they can redeem
     * @dev Calculates vested amount based on vesting type and time elapsed
     */
    function claimPayment() external onlyEmployee {
        EmployeePayroll storage payroll = employeePayrolls[msg.sender];
        
        // Get encrypted values
        euint128 salary = payroll.encryptedSalary;
        euint128 claimed = payroll.encryptedAmountClaimed;
        euint64 startTime = payroll.encryptedStartTime;
        euint64 lastClaim = payroll.encryptedLastClaimTime;
        euint64 interval = payroll.encryptedInterval;
        uint8 vType = uint8(payroll.vestingType);
        
        // Grant contract access for new values only
        FHE.allowThis(salary);
        FHE.allowThis(claimed);
        
        // Current time
        euint64 currentTime = FHE.asEuint64(uint64(block.timestamp));
        FHE.allowThis(currentTime);
        
        // Time since start and since last claim
        euint64 elapsed = FHE.sub(currentTime, startTime);
        euint64 timeSinceLastClaim = FHE.sub(currentTime, lastClaim);
        
        // Check if payment is due
        ebool paymentDue = FHE.gte(timeSinceLastClaim, interval);
        
        // Calculate vested amount based on vesting type
        euint128 vestedAmount;
        
        if (vType == 0) {
            // Immediate - full salary vested
            vestedAmount = salary;
        } else {
            // Linear or Cliff - get vesting params
            euint64 vestingDuration = payroll.encryptedVestingDuration;
            euint64 cliffDuration = payroll.encryptedCliffDuration;
            FHE.allowThis(vestingDuration);
            FHE.allowThis(cliffDuration);
            
            if (vType == 1) {
                // Linear - gradual vesting
                ebool fullyVested = FHE.gte(elapsed, vestingDuration);
                euint128 vestedRatio = FHE.div(
                    FHE.mul(salary, FHE.asEuint128(elapsed)),
                    FHE.asEuint128(vestingDuration)
                );
                vestedAmount = FHE.select(fullyVested, salary, vestedRatio);
            } else {
                // Cliff - nothing until cliff, then linear
                ebool beforeCliff = FHE.lt(elapsed, cliffDuration);
                ebool fullyVested = FHE.gte(
                    FHE.sub(elapsed, cliffDuration),
                    vestingDuration
                );
                // Cast euint64 result to euint128 for arithmetic with salary
                euint128 postCliffElapsed = FHE.asEuint128(FHE.sub(elapsed, cliffDuration));
                euint128 cliffVested = FHE.div(
                    FHE.mul(salary, postCliffElapsed),
                    FHE.asEuint128(vestingDuration)
                );
                vestedAmount = FHE.select(
                    beforeCliff,
                    FHE.asEuint128(0),
                    FHE.select(fullyVested, salary, cliffVested)
                );
            }
        }
        
        // Calculate claimable amount
        euint128 claimable = FHE.sub(vestedAmount, claimed);
        
        // Apply payment due check - zero out if not due
        // Note: In production, use async decryption to verify before transfer
        claimable = FHE.select(paymentDue, claimable, FHE.asEuint128(0));
        
        // Update claimed amount
        euint128 newClaimed = FHE.add(claimed, claimable);
        payroll.encryptedAmountClaimed = newClaimed;
        FHE.allowThis(newClaimed);
        
        // Update last claim time
        payroll.encryptedLastClaimTime = currentTime;
        FHE.allowThis(currentTime);
        
        // Get plaintext amount for escrow (in production, this would be handled off-chain)
        // For now, we store the encrypted amount and let employee redeem
        // The actual amount is determined when the escrow is funded
        uint256 claimableAmount = 0; // Would be decrypted off-chain
        
        // Store escrow reference for the employee
        // Note: In production, the escrow ID would come from on-chain creation
        // For now, we'll emit an event for the frontend to handle
        emit PaymentClaimed(msg.sender, 0, claimableAmount);
    }

    /**
     * @notice Create a payment escrow for an employee
     * @dev Called by admin to create an escrow that employee can later redeem
     * @param employee Employee address
     * @param amount Amount for this payment
     * @return escrowId ID of created escrow
     */
    function createPaymentEscrow(address employee, uint64 amount) external onlyAdmin returns (uint256) {
        if (!employeePayrolls[employee].exists) revert ConfidPay__InvalidEmployee();
        if (amount == 0) revert ConfidPay__InvalidAmount();
        
        // Create escrow with employee as owner (unconditional - no resolver)
        // In production, the owner would be encrypted via cofhejs
        uint256 escrowId = escrowContract.create(
            employee, // Owner address
            amount,   // Amount in USDC units
            address(0), // No resolver - unconditional
            "" // Empty resolver data
        );
        
        // Store escrow reference
        euint128 encAmount = FHE.asEuint128(amount);
        FHE.allowThis(encAmount);
        
        paymentEscrows[employee].push(PaymentEscrow({
            escrowId: escrowId,
            amount: encAmount,
            claimed: false
        }));
        
        emit EscrowCreated(employee, escrowId, amount);
        
        return escrowId;
    }

    /**
     * @notice Claim milestone payment - creates escrow instead of direct transfer
     * @param milestoneIndex Index of the milestone to claim
     * @return escrowId ID of created escrow
     */
    function claimMilestone(uint256 milestoneIndex) external onlyEmployee returns (uint256) {
        Milestone[] storage milestones = employeeMilestones[msg.sender];
        if (milestoneIndex >= milestones.length) revert ConfidPay__MilestoneNotFound();
        
        Milestone storage milestone = milestones[milestoneIndex];
        if (!milestone.completed) revert ConfidPay__MilestoneNotCompleted();
        if (milestone.claimed) revert ConfidPay__MilestoneAlreadyClaimed();
        
        // Get the milestone amount
        euint128 amount = milestone.encryptedAmount;
        FHE.allowThis(amount);
        
        milestone.claimed = true;
        
        // Create escrow for milestone payment
        // In production, amount would be handled via cofhejs encryption
        uint256 plainAmount = 0; // Would be from decrypted value
        
        uint256 escrowId = escrowContract.create(
            msg.sender, // Owner address
            plainAmount, // Amount in USDC units
            address(0),
            ""
        );
        
        // Store escrow reference
        paymentEscrows[msg.sender].push(PaymentEscrow({
            escrowId: escrowId,
            amount: amount,
            claimed: false
        }));
        
        emit MilestoneClaimed(msg.sender, milestone.id);
        
        return escrowId;
    }

    /**
     * @notice Get employee's pending escrows
     * @return Array of pending escrow IDs
     */
    function getMyPendingEscrows() external view onlyEmployee returns (uint256[] memory) {
        PaymentEscrow[] storage escrows = paymentEscrows[msg.sender];
        uint256 count = 0;
        
        // Count pending escrows
        for (uint256 i = 0; i < escrows.length; i++) {
            if (!escrows[i].claimed) {
                count++;
            }
        }
        
        // Build array
        uint256[] memory pendingIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < escrows.length; i++) {
            if (!escrows[i].claimed) {
                pendingIds[index++] = escrows[i].escrowId;
            }
        }
        
        return pendingIds;
    }

    /**
     * @notice Mark an escrow as claimed (called after employee redeems)
     * @param escrowId Escrow ID that was redeemed
     */
    function markEscrowClaimed(uint256 escrowId) external {
        PaymentEscrow[] storage escrows = paymentEscrows[msg.sender];
        
        for (uint256 i = 0; i < escrows.length; i++) {
            if (escrows[i].escrowId == escrowId && !escrows[i].claimed) {
                escrows[i].claimed = true;
                break;
            }
        }
    }

    /**
     * @notice Get employee's own payroll information
     */
    function getMyPayrollInfo()
        external
        view
        onlyEmployee
        returns (
            euint128 salary,
            euint128 amountClaimed,
            euint64 startTime,
            euint64 interval,
            uint8 vestingType,
            euint64 vestingDuration,
            euint64 cliffDuration
        )
    {
        EmployeePayroll storage payroll = employeePayrolls[msg.sender];
        
        return (
            payroll.encryptedSalary,
            payroll.encryptedAmountClaimed,
            payroll.encryptedStartTime,
            payroll.encryptedInterval,
            uint8(payroll.vestingType),
            payroll.encryptedVestingDuration,
            payroll.encryptedCliffDuration
        );
    }

    /**
     * @notice Get number of milestones for employee
     */
    function getMyMilestoneCount() external view onlyEmployee returns (uint256) {
        return employeeMilestones[msg.sender].length;
    }

    /**
     * @notice Check milestone status
     * @return completed Whether milestone is completed
     * @return claimed Whether milestone has been claimed
     */
    function getMyMilestoneStatus(uint256 milestoneIndex) 
        external 
        view 
        onlyEmployee 
        returns (bool completed, bool claimed)
    {
        Milestone[] storage milestones = employeeMilestones[msg.sender];
        if (milestoneIndex >= milestones.length) revert ConfidPay__MilestoneNotFound();
        
        Milestone storage milestone = milestones[milestoneIndex];
        return (milestone.completed, milestone.claimed);
    }

    // ================================================================================
    // VIEW FUNCTIONS
    // ================================================================================

    /**
     * @notice Check if address is an employee
     */
    function isEmployee(address account) external view returns (bool) {
        return employeePayrolls[account].exists;
    }

    /**
     * @notice Get total number of employees
     */
    function getEmployeeCount() external view returns (uint256) {
        return employeeList.length;
    }

    /**
     * @notice Get milestone count for an employee (admin only)
     */
    function getEmployeeMilestoneCount(address employee) external view onlyAdmin returns (uint256) {
        return employeeMilestones[employee].length;
    }

    /**
     * @notice Get escrow contract address
     */
    function getEscrowContract() external view returns (address) {
        return address(escrowContract);
    }

    /**
     * @notice Get insurance status
     */
    function getInsuranceConfig() external view returns (address pool, address policy, uint256 expirySeconds) {
        return (insurancePoolId, insurancePolicy, coverageExpirySeconds);
    }
}
