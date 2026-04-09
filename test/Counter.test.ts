import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import hre from 'hardhat'
import { expect } from 'chai'
import { Encryptable, FheTypes } from '@cofhe/sdk'
describe('Counter', function () {
	let cofheClient: any
	let signer: any
	before(async () => {
		;[signer] = await hre.ethers.getSigners()
		cofheClient = await hre.cofhe.createClientWithBatteries(signer)
	})
	async function deployCounterFixture() {
		const Counter = await hre.ethers.getContractFactory('Counter')
		const counter = await Counter.connect(signer).deploy()
		return { counter }
	}
	describe('Functionality', function () {
		it('Should increment the counter', async function () {
			const { counter } = await loadFixture(deployCounterFixture)
			const initialCount = await counter.count()
			await hre.cofhe.mocks.expectPlaintext(initialCount, 0n)
			await counter.increment()
			const newCount = await counter.count()
			await hre.cofhe.mocks.expectPlaintext(newCount, 1n)
		})
		it('Should decrement the counter', async function () {
			const { counter } = await loadFixture(deployCounterFixture)
			await counter.increment()
			await counter.increment()
			await counter.increment()
			const countBefore = await counter.count()
			await hre.cofhe.mocks.expectPlaintext(countBefore, 3n)
			await counter.decrement()
			const countAfter = await counter.count()
			await hre.cofhe.mocks.expectPlaintext(countAfter, 2n)
		})
		it('Should reset the counter with encrypted input', async function () {
			const { counter } = await loadFixture(deployCounterFixture)
			const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(42n)]).execute()
			await counter.reset(encrypted[0])
			const count = await counter.count()
			await hre.cofhe.mocks.expectPlaintext(count, 42n)
		})
		it('Should use SDK to decrypt counter', async function () {
			const { counter } = await loadFixture(deployCounterFixture)
			const encryptedCount = await counter.count()
			const decrypted = await cofheClient.decryptForView(encryptedCount, FheTypes.Uint32).execute()
			expect(decrypted).to.equal(0n)
			await counter.increment()
			const encryptedCount2 = await counter.count()
			const decrypted2 = await cofheClient.decryptForView(encryptedCount2, FheTypes.Uint32).execute()
			expect(decrypted2).to.equal(1n)
		})
	})
})