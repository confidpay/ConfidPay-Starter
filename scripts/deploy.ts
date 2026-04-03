import { ethers } from 'hardhat'

async function main() {
  console.log('Deploying ConfidPay...')

  const [deployer] = await ethers.getSigners()
  console.log('Deploying with:', deployer.address)

  // Deploy MockFHERC20 (USDC)
  const Token = await ethers.getContractFactory('MockFHERC20')
  const token = await Token.deploy()
  await token.waitForDeployment()
  const tokenAddress = await token.getAddress()
  console.log('MockFHERC20 deployed to:', tokenAddress)

  // Deploy MockConfidentEscrow
  const Escrow = await ethers.getContractFactory('MockConfidentEscrow')
  const escrow = await Escrow.deploy(await token.getAddress())
  await escrow.waitForDeployment()
  const escrowAddress = await escrow.getAddress()
  console.log('MockConfidentEscrow deployed to:', escrowAddress)

  // Deploy ConfidPay
  const ConfidPay = await ethers.getContractFactory('ConfidPay')
  const confipay = await ConfidPay.deploy(
    tokenAddress,
    escrowAddress,
    ethers.ZeroAddress // No insurance manager for now
  )
  await confipay.waitForDeployment()
  const confipayAddress = await confipay.getAddress()
  console.log('ConfidPay deployed to:', confipayAddress)

  // Mint tokens to escrow for testing
  const mintAmount = 1_000_000n // 1M USDC (6 decimals)
  await token.mint(escrowAddress, mintAmount)
  console.log('Minted tokens to escrow')

  console.log('\n=== Deployment Summary ===')
  console.log('CONFIDPAY_ADDRESS=' + confipayAddress)
  console.log('ESCROW_ADDRESS=' + escrowAddress)
  console.log('USDC_ADDRESS=' + tokenAddress)

  // Save addresses to file
  const fs = require('fs')
  const envContent = `
# Deployed Contract Addresses
NEXT_PUBLIC_CONFIDPAY_ADDRESS=${confipayAddress}
NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}
NEXT_PUBLIC_USDC_ADDRESS=${tokenAddress}
`
  fs.writeFileSync('../frontend/.env.local', envContent)
  console.log('\nUpdated frontend/.env.local')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
