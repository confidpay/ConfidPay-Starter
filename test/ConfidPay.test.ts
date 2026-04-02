import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import hre from 'hardhat'
import { expect } from 'chai'
import { Encryptable, FheTypes } from '@cofhe/sdk'

describe('ConfidPay - Create Payroll', function () {
	let cofheClient: any
	let admin: any
	let employee: any

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

	describe('Create Payroll', function () {
		const MONTHLY_SALARY = 100_000_000n // 100 USDC with 6 decimals
		const PAYMENT_INTERVAL = 30 * 24 * 60 * 60 // 30 days in seconds

		it('Should create payroll as admin', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			// Encrypt salary and interval
			const [encryptedSalary] = await cofheClient
				.encryptInputs([Encryptable.uint128(MONTHLY_SALARY)])
				.execute()
			const [encryptedInterval] = await cofheClient
				.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL))])
				.execute()

			// Create payroll
			await confidPay.connect(admin).createPayroll(
				employee.address,
				encryptedSalary,
				encryptedInterval
			)

			// Verify employee exists
			expect(await confidPay.isEmployee(employee.address)).to.be.true
		})

		it('Should emit PayrollCreated event', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			const [encryptedSalary] = await cofheClient
				.encryptInputs([Encryptable.uint128(MONTHLY_SALARY)])
				.execute()
			const [encryptedInterval] = await cofheClient
				.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL))])
				.execute()

			await expect(
				confidPay.connect(admin).createPayroll(
					employee.address,
					encryptedSalary,
					encryptedInterval
				)
			).to.emit(confidPay, 'PayrollCreated')
		})

		it('Should reject duplicate employee payroll', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			const [encryptedSalary] = await cofheClient
				.encryptInputs([Encryptable.uint128(MONTHLY_SALARY)])
				.execute()
			const [encryptedInterval] = await cofheClient
				.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL))])
				.execute()

			// First payroll should succeed
			await confidPay.connect(admin).createPayroll(
				employee.address,
				encryptedSalary,
				encryptedInterval
			)

			// Second payroll should fail
			const [encryptedSalary2] = await cofheClient
				.encryptInputs([Encryptable.uint128(MONTHLY_SALARY * 2n)])
				.execute()
			const [encryptedInterval2] = await cofheClient
				.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL * 2))])
				.execute()

			await expect(
				confidPay.connect(admin).createPayroll(
					employee.address,
					encryptedSalary2,
					encryptedInterval2
				)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__EmployeeExists')
		})

		it('Should reject payroll creation by non-admin', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			const [encryptedSalary] = await cofheClient
				.encryptInputs([Encryptable.uint128(MONTHLY_SALARY)])
				.execute()
			const [encryptedInterval] = await cofheClient
				.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL))])
				.execute()

			// Try to create payroll as employee (non-admin)
			await expect(
				confidPay.connect(employee).createPayroll(
					employee.address,
					encryptedSalary,
					encryptedInterval
				)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__Unauthorized')
		})

		it('Should reject zero address employee', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			const [encryptedSalary] = await cofheClient
				.encryptInputs([Encryptable.uint128(MONTHLY_SALARY)])
				.execute()
			const [encryptedInterval] = await cofheClient
				.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL))])
				.execute()

			await expect(
				confidPay.connect(admin).createPayroll(
					hre.ethers.ZeroAddress,
					encryptedSalary,
					encryptedInterval
				)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__ZeroAddress')
		})
	})

	describe('Get My Payroll Info', function () {
		const MONTHLY_SALARY = 200_000_000n // 200 USDC with 6 decimals
		const PAYMENT_INTERVAL = 30 * 24 * 60 * 60 // 30 days

		it('Should return encrypted payroll info to employee', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			// Create payroll first
			const [encryptedSalary] = await cofheClient
				.encryptInputs([Encryptable.uint128(MONTHLY_SALARY)])
				.execute()
			const [encryptedInterval] = await cofheClient
				.encryptInputs([Encryptable.uint64(BigInt(PAYMENT_INTERVAL))])
				.execute()

			await confidPay.connect(admin).createPayroll(
				employee.address,
				encryptedSalary,
				encryptedInterval
			)

			// Create client for employee
			const employeeClient = await hre.cofhe.createClientWithBatteries(employee)

			// Employee gets their payroll info
			const payrollInfo = await confidPay.connect(employee).getMyPayrollInfo()

			// Decrypt salary (should match what admin set)
			const decryptedSalary = await employeeClient
				.decryptForView(payrollInfo[0], FheTypes.Uint128)
				.execute()
			expect(decryptedSalary).to.equal(MONTHLY_SALARY)

			// Decrypt interval
			const decryptedInterval = await employeeClient
				.decryptForView(payrollInfo[2], FheTypes.Uint64)
				.execute()
			expect(decryptedInterval).to.equal(BigInt(PAYMENT_INTERVAL))
		})

		it('Should reject non-employee from getting payroll info', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			// Try to get payroll info for non-existent employee
			await expect(
				confidPay.connect(employee).getMyPayrollInfo()
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__InvalidEmployee')
		})
	})

	describe('Employee Count', function () {
		it('Should return correct employee count', async function () {
			const { confidPay } = await loadFixture(deployContractsFixture)

			// Initially 0
			expect(await confidPay.getEmployeeCount()).to.equal(0n)

			// Get fresh signers for this test
			const [, , emp1, emp2] = await hre.ethers.getSigners()

			// Create payroll for employee 1
			const [encryptedSalary] = await cofheClient
				.encryptInputs([Encryptable.uint128(100_000_000n)])
				.execute()
			const [encryptedInterval] = await cofheClient
				.encryptInputs([Encryptable.uint64(30n * 24n * 60n * 60n)])
				.execute()

			await confidPay.connect(admin).createPayroll(
				emp1.address,
				encryptedSalary,
				encryptedInterval
			)
			expect(await confidPay.getEmployeeCount()).to.equal(1n)

			// Create payroll for employee 2
			const [encryptedSalary2] = await cofheClient
				.encryptInputs([Encryptable.uint128(150_000_000n)])
				.execute()

			await confidPay.connect(admin).createPayroll(
				emp2.address,
				encryptedSalary2,
				encryptedInterval
			)
			expect(await confidPay.getEmployeeCount()).to.equal(2n)
		})
	})

	describe('Change Admin', function () {
		it('Should allow admin to change admin', async function () {
			const { confidPay, admin, employee } = await loadFixture(deployContractsFixture)

			await confidPay.connect(admin).changeAdmin(employee.address)
			expect(await confidPay.admin()).to.equal(employee.address)
		})

		it('Should reject admin change by non-admin', async function () {
			const { confidPay, employee } = await loadFixture(deployContractsFixture)

			const [, notAdmin] = await hre.ethers.getSigners()

			await expect(
				confidPay.connect(notAdmin).changeAdmin(employee.address)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__Unauthorized')
		})

		it('Should reject zero address as new admin', async function () {
			const { confidPay, admin } = await loadFixture(deployContractsFixture)

			await expect(
				confidPay.connect(admin).changeAdmin(hre.ethers.ZeroAddress)
			).to.be.revertedWithCustomError(confidPay, 'ConfidPay__ZeroAddress')
		})
	})
})
