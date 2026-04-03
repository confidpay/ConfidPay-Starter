import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import hre from 'hardhat'
import { expect } from 'chai'
import { Encryptable, FheTypes } from '@cofhe/sdk'

describe('ConfidPay', function () {
	let cofheClient: any
	let admin: any
	let employee: any

	const MONTHLY_SALARY = 100_000_000n // 100 USDC with 6 decimals
	const PAYMENT_INTERVAL = 30 * 24 * 60 * 60 // 30 days in seconds
	const VESTING_DURATION = 365 * 24 * 60 * 60 // 1 year in seconds
	const CLIFF_DURATION = 90 * 24 * 60 * 60 // 90 days in seconds

	before(async () => {
		;[admin, employee] = await hre.ethers.getSigners()
		cofheClient = await hre.cofhe.createClientWithBatteries(admin)
	})

	async function deployContractsFixture() {
		const MockFHERC20 = await hre.ethers.getContractFactory('MockFHERC20')
		const mockToken = await MockFHERC20.connect(admin).deploy()

		const ConfidPay = await hre.ethers.getContractFactory('ConfidPay')
		const confidPay = await ConfidPay.connect(admin).deploy(await mockToken.getAddress())

		// Mint some tokens to the payroll contract for future payments
		await mockToken.connect(admin).mint(confidPay.getAddress(), 1_000_000_000_000n) // 1M tokens

		return { confidPay, mockToken, admin, employee }
	}

	async function createPayroll(
		confidPay: any,
		employeeAddress: any,
		salary: bigint,
		vestingType: number = 0,
		vestingDuration: bigint = 0n,
		cliffDuration: bigint = 0n,
		sender: any = admin
	) {
		const [encryptedSalary] = await cofheClient
			.encryptInputs([Encryptable.uint128(salary)])
			.execute()
		const [encryptedInterval] = await cofheClient
			.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL))])
			.execute()
		const [encryptedVestingDuration] = await cofheClient
			.encryptInputs([Encryptable.uint64(vestingDuration)])
			.execute()
		const [encryptedCliffDuration] = await cofheClient
			.encryptInputs([Encryptable.uint64(cliffDuration)])
			.execute()

		await confidPay.connect(sender).createPayroll(
			employeeAddress,
			encryptedSalary,
			encryptedInterval,
			vestingType,
			encryptedVestingDuration,
			encryptedCliffDuration
		)
	}

	// ================================================================================
	// DEPLOYMENT TESTS
	// ================================================================================
	describe('Deployment', function () {
		it('Should set admin correctly', async function () {
			const { confidPay, admin } = await loadFixture(deployContractsFixture)
			expect(await confidPay.admin()).to.equal(admin.address)
		})

		it('Should set confidential token correctly', async function () {
			const { confidPay, mockToken } = await loadFixture(deployContractsFixture)
			expect(await confidPay.confidentialToken()).to.equal(await mockToken.getAddress())
		})
	})

	// ================================================================================
	// CREATE PAYROLL TESTS
	// ================================================================================
	describe('Create Payroll', function () {
		it('Should create payroll as admin (Immediate vesting)', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			expect(await confidPay.isEmployee(employee.address)).to.be.true
		})

		it('Should create payroll with Linear vesting', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 1, BigInt(VESTING_DURATION), 0n)

			expect(await confidPay.isEmployee(employee.address)).to.be.true
		})

		it('Should create payroll with Cliff vesting', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(
				confidPay,
				employee.address,
				MONTHLY_SALARY,
				2,
				BigInt(VESTING_DURATION),
				BigInt(CLIFF_DURATION)
			)

			expect(await confidPay.isEmployee(employee.address)).to.be.true
		})

		it('Should emit PayrollCreated event', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			// Manually call createPayroll to get tx for event checking
			const [encryptedSalary] = await cofheClient
				.encryptInputs([Encryptable.uint128(MONTHLY_SALARY)])
				.execute()
			const [encryptedInterval] = await cofheClient
				.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL))])
				.execute()
			const [encryptedVestingDuration] = await cofheClient
				.encryptInputs([Encryptable.uint64(0n)])
				.execute()
			const [encryptedCliffDuration] = await cofheClient
				.encryptInputs([Encryptable.uint64(0n)])
				.execute()

			await expect(
				confidPay.connect(admin).createPayroll(
					employee.address,
					encryptedSalary,
					encryptedInterval,
					0,
					encryptedVestingDuration,
					encryptedCliffDuration
				)
			).to.emit(confidPay, 'PayrollCreated')
		})

		it('Should reject duplicate employee payroll', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			await expect(
				createPayroll(confidPay, employee.address, MONTHLY_SALARY * 2n, 0, 0n, 0n)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__EmployeeExists')
		})

		it('Should reject payroll creation by non-admin', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			const [, notAdmin] = await hre.ethers.getSigners()

			await expect(
				createPayroll(confidPay, notAdmin.address, MONTHLY_SALARY, 0, 0n, 0n, notAdmin)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__Unauthorized')
		})

		it('Should reject zero address employee', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await expect(
				createPayroll(confidPay, hre.ethers.ZeroAddress, MONTHLY_SALARY, 0, 0n, 0n)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__ZeroAddress')
		})
	})

	// ================================================================================
	// GET PAYROLL INFO TESTS
	// ================================================================================
	describe('Get My Payroll Info', function () {
		it('Should return encrypted payroll info to employee', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			const employeeClient = await hre.cofhe.createClientWithBatteries(employee)

			const payrollInfo = await confidPay.connect(employee).getMyPayrollInfo()

			const decryptedSalary = await employeeClient
				.decryptForView(payrollInfo[0], FheTypes.Uint128)
				.execute()
			expect(decryptedSalary).to.equal(MONTHLY_SALARY)

			const decryptedVestingType = payrollInfo[4]
			expect(decryptedVestingType).to.equal(0)
		})

		it('Should reject non-employee from getting payroll info', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await expect(confidPay.connect(employee).getMyPayrollInfo()).to.be.revertedWithCustomError(
				confidPay,
				'ConfidPay__InvalidEmployee'
			)
		})
	})

	// ================================================================================
	// EMPLOYEE COUNT TESTS
	// ================================================================================
	describe('Employee Count', function () {
		it('Should return correct employee count', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			expect(await confidPay.getEmployeeCount()).to.equal(0n)

			const [, , emp1, emp2] = await hre.ethers.getSigners()

			await createPayroll(confidPay, emp1.address, MONTHLY_SALARY, 0, 0n, 0n)
			expect(await confidPay.getEmployeeCount()).to.equal(1n)

			await createPayroll(confidPay, emp2.address, MONTHLY_SALARY * 2n, 0, 0n, 0n)
			expect(await confidPay.getEmployeeCount()).to.equal(2n)
		})
	})

	// ================================================================================
	// CHANGE ADMIN TESTS
	// ================================================================================
	describe('Change Admin', function () {
		it('Should allow admin to change admin', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await confidPay.connect(admin).changeAdmin(employee.address)
			expect(await confidPay.admin()).to.equal(employee.address)
		})

		it('Should reject admin change by non-admin', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			const [, notAdmin] = await hre.ethers.getSigners()

			await expect(
				confidPay.connect(notAdmin).changeAdmin(employee.address)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__Unauthorized')
		})

		it('Should reject zero address as new admin', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await expect(
				confidPay.connect(admin).changeAdmin(hre.ethers.ZeroAddress)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__ZeroAddress')
		})
	})

	// ================================================================================
	// MILESTONE TESTS
	// ================================================================================
	describe('Milestones', function () {
		it('Should add milestone for employee', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			const milestoneId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('test_milestone'))
			const [encryptedAmount] = await cofheClient
				.encryptInputs([Encryptable.uint128(50_000_000n)])
				.execute()

			await confidPay.connect(admin).addMilestone(employee.address, milestoneId, encryptedAmount)

			const count = await confidPay.connect(employee).getMyMilestoneCount()
			expect(count).to.equal(1n)
		})

		it('Should emit MilestoneAdded event', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			const milestoneId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('test_milestone'))
			const [encryptedAmount] = await cofheClient
				.encryptInputs([Encryptable.uint128(50_000_000n)])
				.execute()

			await expect(
				confidPay.connect(admin).addMilestone(employee.address, milestoneId, encryptedAmount)
			).to.emit(confidPay, 'MilestoneAdded')
		})

		it('Should complete milestone', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			const milestoneId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('test_milestone'))
			const [encryptedAmount] = await cofheClient
				.encryptInputs([Encryptable.uint128(50_000_000n)])
				.execute()

			await confidPay.connect(admin).addMilestone(employee.address, milestoneId, encryptedAmount)
			await confidPay.connect(admin).completeMilestone(employee.address, 0)

			const [completed, claimed] = await confidPay.connect(employee).getMyMilestoneStatus(0)
			expect(completed).to.be.true
			expect(claimed).to.be.false
		})

		it('Should emit MilestoneCompleted event', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			const milestoneId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('test_milestone'))
			const [encryptedAmount] = await cofheClient
				.encryptInputs([Encryptable.uint128(50_000_000n)])
				.execute()

			await confidPay.connect(admin).addMilestone(employee.address, milestoneId, encryptedAmount)
			await expect(confidPay.connect(admin).completeMilestone(employee.address, 0)).to.emit(
				confidPay,
				'MilestoneCompleted'
			)
		})

		it('Should reject claim milestone before completion', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			const milestoneId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('test_milestone'))
			const [encryptedAmount] = await cofheClient
				.encryptInputs([Encryptable.uint128(50_000_000n)])
				.execute()

			await confidPay.connect(admin).addMilestone(employee.address, milestoneId, encryptedAmount)

			await expect(
				confidPay.connect(employee).claimMilestone(0)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__MilestoneNotCompleted')
		})

		it('Should reject invalid milestone index', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, employee.address, MONTHLY_SALARY, 0, 0n, 0n)

			await expect(
				confidPay.connect(admin).completeMilestone(employee.address, 999)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__MilestoneNotFound')
		})
	})

	// ================================================================================
	// CLAIM PAYMENT TESTS
	// ================================================================================
	describe('Claim Payment', function () {
		it('Should reject non-employee from claiming payment', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			await createPayroll(confidPay, admin.address, MONTHLY_SALARY, 0, 0n, 0n)

			await expect(confidPay.connect(employee).claimPayment()).to.be.revertedWithCustomError(
				confidPay,
				'ConfidPay__InvalidEmployee'
			)
		})
	})
})
