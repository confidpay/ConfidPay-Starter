// For now, using public values for testing
// In production, use @cofhe/sdk for encryption

export async function encryptValue(value: bigint | number): Promise<bigint> {
  return BigInt(value)
}

export async function decryptValue(encrypted: bigint): Promise<bigint> {
  return encrypted
}
