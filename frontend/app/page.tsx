'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract } from 'wagmi'
import { Providers } from './providers'
import { CONFIDPAY_ADDRESS } from '@/lib/config'

const confipayAbi = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "_confidentialToken", "type": "address" },
      { "name": "_escrowContract", "type": "address" },
      { "name": "_insuranceManager", "type": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "admin",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createPayroll",
    "inputs": [
      { "name": "employee", "type": "address" },
      { "name": "encryptedSalary", "type": "tuple", "components": [{ "name": "publicAmount", "type": "uint256" }] },
      { "name": "encryptedInterval", "type": "tuple", "components": [{ "name": "publicAmount", "type": "uint256" }] },
      { "name": "vestingType", "type": "uint8" },
      { "name": "encryptedVestingDuration", "type": "tuple", "components": [{ "name": "publicAmount", "type": "uint256" }] },
      { "name": "encryptedCliffDuration", "type": "tuple", "components": [{ "name": "publicAmount", "type": "uint256" }] }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isEmployee",
    "inputs": [{ "name": "account", "type": "address" }],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createPaymentEscrow",
    "inputs": [
      { "name": "employee", "type": "address" },
      { "name": "amount", "type": "uint64" }
    ],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable"
  }
] as const

export default function Home() {
  return (
    <Providers>
      <main className="min-h-screen p-8 bg-gray-900 text-white">
        <Dashboard />
      </main>
    </Providers>
  )
}

function Dashboard() {
  const { address, isConnected, isDisconnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('admin')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-4xl font-bold mb-4">ConfidPay</h1>
        <p className="text-gray-400 mb-8">Loading...</p>
      </div>
    )
  }

  if (isDisconnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-4xl font-bold mb-4">ConfidPay</h1>
        <p className="text-gray-400 mb-8">Privacy-native payroll for DAOs</p>
        <div className="flex flex-col gap-4">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => connect({ connector })}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">ConfidPay Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          <button
            onClick={() => disconnect()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
          >
            Disconnect
          </button>
        </div>
      </header>

      <div className="mb-6">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'admin'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Admin Panel
          </button>
          <button
            onClick={() => setActiveTab('employee')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'employee'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Employee Panel
          </button>
        </div>
      </div>

      {activeTab === 'admin' ? (
        <AdminPanel isConnected={isConnected} address={address} />
      ) : (
        <EmployeePanel isConnected={isConnected} address={address} />
      )}
    </div>
  )
}

function AdminPanel({ isConnected, address }: { isConnected: boolean; address?: string }) {
  const [employee, setEmployee] = useState('')
  const [salary, setSalary] = useState('')
  const [vestingType, setVestingType] = useState<0 | 1 | 2>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')

  const { writeContract } = useWriteContract()

  const handleCreatePayroll = async () => {
    if (!employee || !salary) return

    setIsLoading(true)
    setStatus('Creating payroll...')

    try {
      // Values (using plaintext for testing - in production, use FhenixClient.encrypt)
      const salaryAmount = BigInt(parseFloat(salary) * 1_000_000) // USDC 6 decimals
      const interval = BigInt(30 * 24 * 60 * 60) // 30 days
      const vestingDuration = BigInt(365 * 24 * 60 * 60) // 1 year
      const cliffDuration = BigInt(365 * 24 * 60 * 60) // 1 year

      setStatus('Sending transaction...')

      writeContract({
        address: CONFIDPAY_ADDRESS as `0x${string}`,
        abi: confipayAbi,
        functionName: 'createPayroll',
        args: [
          employee as `0x${string}`,
          { publicAmount: salaryAmount },
          { publicAmount: interval },
          vestingType,
          { publicAmount: vestingDuration },
          { publicAmount: cliffDuration }
        ]
      })

      setStatus('Transaction submitted!')
      setEmployee('')
      setSalary('')
    } catch (error: any) {
      console.error(error)
      setStatus('Error: ' + (error.message || 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Admin Panel</h2>
      <p className="text-gray-400 mb-4">Create payroll and manage employees</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Employee Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Monthly Salary (USDC)</label>
          <input
            type="number"
            placeholder="5000"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Vesting Type</label>
          <select 
            value={vestingType} 
            onChange={(e) => setVestingType(Number(e.target.value) as 0 | 1 | 2)}
            className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500"
          >
            <option value={0}>Immediate</option>
            <option value={1}>Linear (12 months)</option>
            <option value={2}>Cliff (1yr cliff, then linear)</option>
          </select>
        </div>

        <button
          onClick={handleCreatePayroll}
          disabled={!isConnected || !employee || !salary || isLoading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
        >
          {isLoading ? status : 'Create Payroll'}
        </button>

        {status && (
          <p className="text-sm text-gray-400 text-center">{status}</p>
        )}
      </div>
    </div>
  )
}

function EmployeePanel({ isConnected, address }: { isConnected: boolean; address?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')

  const { writeContract } = useWriteContract()

  const handleClaimPayment = async () => {
    setIsLoading(true)
    setStatus('Claiming payment...')

    try {
      writeContract({
        address: CONFIDPAY_ADDRESS as `0x${string}`,
        abi: confipayAbi,
        functionName: 'createPaymentEscrow',
        args: [address as `0x${string}`, BigInt(1000000)] // 1 USDC for testing
      })
      setStatus('Payment claimed!')
    } catch (error: any) {
      console.error(error)
      setStatus('Error: ' + (error.message || 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Employee Panel</h2>
      <p className="text-gray-400 mb-4">View and claim your payments</p>
      
      <div className="space-y-4">
        <div className="bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg font-medium">
            {address ? 'Connected' : 'Connect wallet'}
          </p>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Pending Payments</p>
          <p className="text-2xl font-bold">0</p>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Total Claimed</p>
          <p className="text-2xl font-bold">0 USDC</p>
        </div>

        <button
          onClick={handleClaimPayment}
          disabled={!isConnected || isLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
        >
          {isLoading ? status : 'Claim Payment'}
        </button>

        {status && (
          <p className="text-sm text-gray-400 text-center">{status}</p>
        )}
      </div>
    </div>
  )
}
