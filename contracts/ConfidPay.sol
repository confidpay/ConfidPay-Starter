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
 * @notice Privacy-native payroll system for DAOs
 * @dev Stores encrypted salaries and payment schedules. All monetary values
 *      stay encrypted on-chain while the contract can still compute on them.
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
        euint128 encryptedSalary;      // Per-period salary (e.g., monthly)
        euint64  encryptedStartTime;   // When payroll started
        euint64  encryptedInterval;   // Seconds between payments
    }

    // ================================================================================
    // STATE VARIABLES
    // ================================================================================
    
    address public admin;
    IFHERC20 public confidentialToken;
    
    mapping(address => EmployeePayroll) private employeePayrolls;
    address[] private employeeList;

    // ================================================================================
    // EVENTS
    // ================================================================================
    event PayrollCreated(address indexed employee);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    // ================================================================================
    // MODIFIERS
    // ================================================================================
    modifier onlyAdmin() {
        if (msg.sender != admin) revert ConfidPay__Unauthorized();
        _;
    }

    // ================================================================================
    // CONSTRUCTOR
    // ================================================================================
    constructor(address _confidentialToken) {
        if (_confidentialToken == address(0)) revert ConfidPay__ZeroAddress();
        
        admin = msg.sender;
        confidentialToken = IFHERC20(_confidentialToken);
    }

    // ================================================================================
    // ADMIN FUNCTIONS
    // ================================================================================

    /**
     * @notice Create a private payroll for an employee
     * @param employee Address of the employee
     * @param encryptedSalary Encrypted salary per payment period (e.g., monthly)
     * @param encryptedInterval Encrypted seconds between payments (e.g., 30 days)
     * 
     * @dev ACL: 
     * - FHE.allowThis() on all encrypted inputs for storage
     * - FHE.allow(value, employee) so employee can decrypt their own data
     */
    function createPayroll(
        address employee,
        InEuint128 calldata encryptedSalary,
        InEuint64 calldata encryptedInterval
    ) external onlyAdmin {
        if (employee == address(0)) revert ConfidPay__ZeroAddress();
        if (employeePayrolls[employee].exists) revert ConfidPay__EmployeeExists();

        // Convert encrypted inputs to encrypted types
        euint128 salary = FHE.asEuint128(encryptedSalary);
        euint64 interval = FHE.asEuint64(encryptedInterval);
        euint64 startTime = FHE.asEuint64(uint64(block.timestamp));

        // ========================================================================
        // ACL WARNING: Granting contract access to all encrypted values
        // ========================================================================
        FHE.allowThis(salary);
        FHE.allowThis(interval);
        FHE.allowThis(startTime);
        
        // Grant employee access to their own payroll data (so they can decrypt it)
        FHE.allow(salary, employee);
        FHE.allow(startTime, employee);
        FHE.allow(interval, employee);
        
        // Store payroll record
        EmployeePayroll storage payroll = employeePayrolls[employee];
        payroll.exists = true;
        payroll.employee = employee;
        payroll.encryptedSalary = salary;
        payroll.encryptedStartTime = startTime;
        payroll.encryptedInterval = interval;

        employeeList.push(employee);
        
        emit PayrollCreated(employee);
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

    // ================================================================================
    // EMPLOYEE FUNCTIONS
    // ================================================================================

    /**
     * @notice Get employee's own payroll information
     * @dev Only the employee can call this. All values are encrypted.
     * @return salary Encrypted salary handle
     * @return startTime Encrypted start time handle
     * @return interval Encrypted payment interval handle
     * 
     * @dev ACL: Employee has access via FHE.allow() in createPayroll
     */
    function getMyPayrollInfo()
        external
        view
        returns (
            euint128 salary,
            euint64 startTime,
            euint64 interval
        )
    {
        if (!employeePayrolls[msg.sender].exists) revert ConfidPay__InvalidEmployee();
        
        EmployeePayroll storage payroll = employeePayrolls[msg.sender];
        
        return (
            payroll.encryptedSalary,
            payroll.encryptedStartTime,
            payroll.encryptedInterval
        );
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
}
