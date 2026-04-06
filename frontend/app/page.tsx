'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { Providers } from './providers'
import { CONFIDPAY_ADDRESS } from '@/lib/config'

const confipayAbi = [
  { "type": "constructor", "inputs": [{ "name": "_confidentialToken", "type": "address" }, { "name": "_escrowContract", "type": "address" }, { "name": "_insuranceManager", "type": "address" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "admin", "inputs": [], "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "createPayroll", "inputs": [{ "name": "employee", "type": "address" }, { "name": "encryptedSalary", "type": "tuple", "components": [{ "name": "publicAmount", "type": "uint256" }] }, { "name": "encryptedInterval", "type": "tuple", "components": [{ "name": "publicAmount", "type": "uint256" }] }, { "name": "vestingType", "type": "uint8" }, { "name": "encryptedVestingDuration", "type": "tuple", "components": [{ "name": "publicAmount", "type": "uint256" }] }, { "name": "encryptedCliffDuration", "type": "tuple", "components": [{ "name": "publicAmount", "type": "uint256" }] }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "isEmployee", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view" },
  { "type": "function", "name": "createPaymentEscrow", "inputs": [{ "name": "employee", "type": "address" }, { "name": "amount", "type": "uint64" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "nonpayable" }
] as const

const VESTING_TYPES = [
  { value: 0, label: 'Immediate', description: 'No vesting - instant access' },
  { value: 1, label: 'Linear (12 months)', description: 'Tokens unlock gradually over 1 year' },
  { value: 2, label: 'Cliff (1yr cliff)', description: '1 year cliff, then linear vesting' }
]

export default function Home() {
  return (
    <Providers>
      <main className="min-h-screen gradient-bg">
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('admin')

  const { data: adminAddress } = useReadContract({
    address: CONFIDPAY_ADDRESS as `0x${string}`,
    abi: confipayAbi,
    functionName: 'admin',
  })

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('confidpay-theme') as 'dark' | 'light' | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
    // Apply saved theme on mount
    const currentTheme = savedTheme || 'dark'
    if (currentTheme === 'light') {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    }
  }, [])

  useEffect(() => {
    if (adminAddress && address) {
      if (address.toLowerCase() === adminAddress.toString().toLowerCase()) {
        setActiveTab('admin')
      } else {
        setActiveTab('employee')
      }
    }
  }, [adminAddress, address])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('confidpay-theme', newTheme)
    if (newTheme === 'light') {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    }
  }

  if (!mounted) {
    return <LoadingScreen />
  }

  if (isDisconnected) {
    return <ConnectScreen connectors={connectors as any[]} onConnect={({ connector }: { connector: any }) => connect({ connector })} theme={theme} onToggleTheme={toggleTheme} />
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Header address={address} onDisconnect={disconnect} theme={theme} onToggleTheme={toggleTheme} />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="mt-6">
        {activeTab === 'admin' ? (
          <AdminPanel address={address} />
        ) : (
          <EmployeePanel address={address} />
        )}
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h1 className="text-2xl font-bold text-blue-400">ConfidPay</h1>
      <p className="text-secondary mt-2">Loading dashboard...</p>
    </div>
  )
}

function ConnectScreen({ connectors, onConnect, theme, onToggleTheme }: { connectors: any[]; onConnect: any; theme: string; onToggleTheme: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="absolute top-6 right-6">
        <button onClick={onToggleTheme} className="p-3 rounded-full card-bg hover:opacity-80 transition-opacity border border-custom">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
            ConfidPay
          </h1>
          <p className="text-secondary text-lg">Privacy-native payroll for DAOs</p>
          <div className="flex justify-center gap-2 mt-4">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">🔒 Private</span>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">⚡ Fast</span>
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">🔗 On-chain</span>
          </div>
        </div>
        
        <div className="card-bg backdrop-blur rounded-2xl p-6 border">
          <h2 className="text-xl font-semibold mb-4 text-center">Connect Your Wallet</h2>
          <p className="text-secondary text-sm mb-6 text-center">
            Connect your wallet to access the payroll dashboard
          </p>
          
          <div className="space-y-3">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => onConnect({ connector })}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl font-medium transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 text-white"
              >
                <WalletIcon />
                Connect {connector.name}
              </button>
            ))}
          </div>
        </div>
        
        <p className="text-center text-secondary text-sm mt-6">
          Powered by Fhenix & ReineiraOS
        </p>
      </div>
    </div>
  )
}

function WalletIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function Header({ address, onDisconnect, theme, onToggleTheme }: { address?: string; onDisconnect: () => void; theme: string; onToggleTheme: () => void }) {
  return (
    <header className="flex justify-between items-center py-4 border-b border-custom">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ConfidPay
        </h1>
        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Testnet</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="px-4 py-2 card-bg rounded-lg flex items-center gap-2 border border-custom">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
        </div>
        <button onClick={onToggleTheme} className="p-2 rounded-lg card-bg hover:opacity-80 transition-opacity border border-custom">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          onClick={onDisconnect}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
        >
          Disconnect
        </button>
      </div>
    </header>
  )
}

function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: 'admin' | 'employee') => void }) {
  return (
    <div className="flex gap-1 card-bg p-1 rounded-xl w-fit">
      <button
        onClick={() => onTabChange('admin')}
        className={`px-6 py-3 rounded-lg font-medium transition-all ${
          activeTab === 'admin'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
            : 'text-secondary hover:text-primary hover:bg-gray-700'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Admin
        </span>
      </button>
      <button
        onClick={() => onTabChange('employee')}
        className={`px-6 py-3 rounded-lg font-medium transition-all ${
          activeTab === 'employee'
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
            : 'text-secondary hover:text-primary hover:bg-gray-700'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Employee
        </span>
      </button>
    </div>
  )
}

function AdminPanel({ address }: { address?: string }) {
  const [employee, setEmployee] = useState('')
  const [salary, setSalary] = useState('')
  const [vestingType, setVestingType] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'idle' | 'pending' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [payrollHistory, setPayrollHistory] = useState<any[]>([])

  const { writeContract } = useWriteContract()

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr)

  const handleCreatePayroll = async () => {
    if (!employee || !salary || !isValidAddress(employee)) {
      setStatus({ type: 'error', message: 'Please enter a valid address and salary' })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'pending', message: 'Preparing transaction...' })

    try {
      const salaryAmount = BigInt(parseFloat(salary) * 1_000_000)
      const interval = BigInt(30 * 24 * 60 * 60)
      const vestingDuration = BigInt(365 * 24 * 60 * 60)
      const cliffDuration = BigInt(365 * 24 * 60 * 60)

      setStatus({ type: 'pending', message: 'Confirming transaction...' })

      const hash = await writeContract({
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

      setTxHash(hash)
      setStatus({ type: 'success', message: 'Payroll created successfully!' })
      setPayrollHistory(prev => [...prev, { employee, salary, vestingType: VESTING_TYPES[vestingType].label, txHash: hash, timestamp: Date.now() }])
      
      setEmployee('')
      setSalary('')
    } catch (error: any) {
      console.error(error)
      setStatus({ type: 'error', message: error.shortMessage || error.message || 'Transaction failed' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card-bg backdrop-blur rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Create Payroll</h2>
            <p className="text-secondary text-sm">Set up employee compensation</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-secondary mb-2">Employee Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border ${
                employee && !isValidAddress(employee) ? 'border-red-500' : 'border-custom'
              } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all`}
            />
            {employee && !isValidAddress(employee) && (
              <p className="text-red-400 text-xs mt-1">Invalid Ethereum address format</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-secondary mb-2">Monthly Salary (USDC)</label>
            <div className="relative">
              <input
                type="number"
                placeholder="5000"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-custom focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary">USDC</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-secondary mb-2">Vesting Type</label>
            <div className="space-y-2">
              {VESTING_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setVestingType(type.value)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    vestingType === type.value
                      ? 'bg-blue-500/20 border-2 border-blue-500'
                      : 'bg-gray-900/50 border-2 border-custom hover:border-gray-500'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{type.label}</span>
                    {vestingType === type.value && <span className="text-blue-400">✓</span>}
                  </div>
                  <p className="text-sm text-secondary mt-1">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreatePayroll}
            disabled={isLoading || !isValidAddress(employee) || !salary}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-medium transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 text-white"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Payroll
              </>
            )}
          </button>

          <StatusMessage status={status} txHash={txHash} />
        </div>
      </div>

      <div className="card-bg backdrop-blur rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Recent Payrolls</h2>
            <p className="text-secondary text-sm">{payrollHistory.length} created</p>
          </div>
        </div>

        {payrollHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-secondary">No payrolls created yet</p>
            <p className="text-secondary opacity-60 text-sm">Create your first payroll to see it here</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {payrollHistory.map((payroll, index) => (
              <div key={index} className="p-4 bg-gray-900/50 rounded-xl border border-custom">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm">{payroll.employee.slice(0, 8)}...{payroll.employee.slice(-6)}</p>
                    <p className="text-green-400 font-medium">{payroll.salary} USDC/mo</p>
                  </div>
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                    {payroll.vestingType}
                  </span>
                </div>
                <a
                  href={`https://sepolia.arbiscan.io/tx/${payroll.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                >
                  View on Arbiscan →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmployeePanel({ address }: { address?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'idle' | 'pending' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [txHash, setTxHash] = useState<string | null>(null)
  const [claimedHistory, setClaimedHistory] = useState<any[]>([])

  const { writeContract } = useWriteContract()

  const handleClaimPayment = async () => {
    setIsLoading(true)
    setStatus({ type: 'pending', message: 'Claiming payment...' })

    try {
      const hash = await writeContract({
        address: CONFIDPAY_ADDRESS as `0x${string}`,
        abi: confipayAbi,
        functionName: 'createPaymentEscrow',
        args: [address as `0x${string}`, BigInt(1000000)]
      })

      setTxHash(hash)
      setStatus({ type: 'success', message: 'Payment claimed successfully!' })
      setClaimedHistory(prev => [...prev, { amount: '1', txHash: hash, timestamp: Date.now() }])
    } catch (error: any) {
      console.error(error)
      setStatus({ type: 'error', message: error.shortMessage || 'Transaction failed' })
    } finally {
      setIsLoading(false)
    }
  }

  const totalClaimed = claimedHistory.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur rounded-2xl p-6 border border-purple-500/30">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Your Payments</h2>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-900/50 rounded-xl p-4">
              <p className="text-secondary text-sm">Pending</p>
              <p className="text-3xl font-bold">0</p>
              <p className="text-secondary opacity-60 text-xs">USDC</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4">
              <p className="text-secondary text-sm">Total Claimed</p>
              <p className="text-3xl font-bold text-green-400">{totalClaimed}</p>
              <p className="text-secondary opacity-60 text-xs">USDC</p>
            </div>
          </div>

          <button
            onClick={handleClaimPayment}
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 text-white"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Claim Payment
              </>
            )}
          </button>

          <StatusMessage status={status} txHash={txHash} />
        </div>

        <div className="card-bg backdrop-blur rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Payment Schedule</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <span className="text-green-400">✓</span>
                </div>
                <div>
                  <p className="font-medium">April 1, 2024</p>
                  <p className="text-secondary text-sm">Monthly salary</p>
                </div>
              </div>
              <span className="text-green-400 font-medium">+1,000 USDC</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-500/20 rounded-full flex items-center justify-center">
                  <span className="text-secondary">○</span>
                </div>
                <div>
                  <p className="font-medium">May 1, 2024</p>
                  <p className="text-secondary text-sm">Monthly salary</p>
                </div>
              </div>
              <span className="text-secondary font-medium">+1,000 USDC</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-500/20 rounded-full flex items-center justify-center">
                  <span className="text-secondary">○</span>
                </div>
                <div>
                  <p className="font-medium">June 1, 2024</p>
                  <p className="text-secondary text-sm">Monthly salary</p>
                </div>
              </div>
              <span className="text-secondary font-medium">+1,000 USDC</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card-bg backdrop-blur rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Claim History</h2>
            <p className="text-secondary text-sm">{claimedHistory.length} claims</p>
          </div>
        </div>

        {claimedHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-secondary">No claims yet</p>
            <p className="text-secondary opacity-60 text-sm">Your payment history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {claimedHistory.map((claim, index) => (
              <div key={index} className="p-4 bg-gray-900/50 rounded-xl border border-custom">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-green-400 font-medium">+{claim.amount} USDC</p>
                    <p className="text-secondary text-sm">
                      {new Date(claim.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <a
                  href={`https://sepolia.arbiscan.io/tx/${claim.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                >
                  View on Arbiscan →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusMessage({ status, txHash }: { status: { type: string; message: string }; txHash: string | null }) {
  if (status.type === 'idle') return null

  const bgColor = {
    pending: 'bg-blue-500/20 border-blue-500',
    success: 'bg-green-500/20 border-green-500',
    error: 'bg-red-500/20 border-red-500'
  }[status.type]

  const textColor = {
    pending: 'text-blue-400',
    success: 'text-green-400',
    error: 'text-red-400'
  }[status.type]

  return (
    <div className={`p-4 rounded-xl border ${bgColor} ${textColor} animate-fade-in`}>
      <p className="font-medium">{status.message}</p>
      {txHash && (
        <a
          href={`https://sepolia.arbiscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline hover:no-underline mt-2 inline-block"
        >
          View transaction →
        </a>
      )}
    </div>
  )
}
