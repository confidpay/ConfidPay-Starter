import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Counter } from '../typechain-types'
import { Encryptable } from '@cofhe/sdk'
import { createCofheClient } from '@cofhe/sdk/node'
import { Ethers6Adapter } from '@cofhe/sdk/adapters'
import { getDeployment } from './utils'

task('reset-counter', 'Reset the counter with an encrypted value').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
	const { ethers, network } = hre

	const counterAddress = getDeployment(network.name, 'Counter')
	if (!counterAddress) {
		console.error(`No Counter deployment found for network ${network.name}`)
		return
	}

	console.log(`Using Counter at ${counterAddress} on ${network.name}`)

	const [signer] = await ethers.getSigners()
	console.log(`Using account: ${signer.address}`)

	const cofheClient = createCofheClient({
		supportedChains: [network.config.chainId],
		adapters: {
			ethers: new Ethers6Adapter(signer),
		},
	})

	const Counter = await ethers.getContractFactory('Counter')
	const counter = Counter.attach(counterAddress) as unknown as Counter

	const encryptedValue = await cofheClient
		.encryptInputs([Encryptable.uint32(2000n)])
		.execute()

	console.log('Resetting counter...')
	const tx = await counter.reset(encryptedValue[0])
	await tx.wait()
	console.log(`Transaction hash: ${tx.hash}`)

	const newCount = await counter.count()
	console.log(`New count: ${newCount}`)
})
