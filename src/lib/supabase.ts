// Re-export the auto-generated Supabase client
export { supabase } from '@/integrations/supabase/client'

// Encryption/decryption utilities using Web Crypto API
export const encryptPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  
  // Generate a random key for encryption
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  
  // Generate a random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  
  // Encrypt the data
  const encryptedData = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  
  // Export the key
  const exportedKey = await window.crypto.subtle.exportKey('raw', key)
  
  // Combine key, IV, and encrypted data
  const combined = new Uint8Array(exportedKey.byteLength + iv.length + encryptedData.byteLength)
  combined.set(new Uint8Array(exportedKey), 0)
  combined.set(iv, exportedKey.byteLength)
  combined.set(new Uint8Array(encryptedData), exportedKey.byteLength + iv.length)
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined))
}

export const decryptPassword = async (encryptedPassword: string): Promise<string> => {
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedPassword), c => c.charCodeAt(0))
    
    // Extract key, IV, and encrypted data
    const keyData = combined.slice(0, 32)
    const iv = combined.slice(32, 44)
    const encryptedData = combined.slice(44)
    
    // Import the key
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )
    
    // Decrypt the data
    const decryptedData = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    )
    
    const decoder = new TextDecoder()
    return decoder.decode(decryptedData)
  } catch (error) {
    console.error('Decryption failed')
    throw new Error('Failed to decrypt password')
  }
}

// Password strength checker
export const calculatePasswordStrength = (password: string): {
  score: number
  feedback: string[]
} => {
  let score = 0
  const feedback: string[] = []

  if (password.length >= 8) score += 20
  else feedback.push('Password should be at least 8 characters')

  if (password.length >= 12) score += 10

  if (/[a-z]/.test(password)) score += 10
  else feedback.push('Add lowercase letters')

  if (/[A-Z]/.test(password)) score += 10
  else feedback.push('Add uppercase letters')

  if (/\d/.test(password)) score += 15
  else feedback.push('Add numbers')

  if (/[^a-zA-Z\d]/.test(password)) score += 20
  else feedback.push('Add special characters')

  if (password.length >= 16) score += 15

  return { score: Math.min(score, 100), feedback }
}

// Password generator
export const generatePassword = (
  length: number = 16,
  includeNumbers: boolean = true,
  includeSymbols: boolean = true,
  includeUppercase: boolean = true,
  includeLowercase: boolean = true
): string => {
  let chars = ''
  if (includeLowercase) chars += 'abcdefghijklmnopqrstuvwxyz'
  if (includeUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (includeNumbers) chars += '0123456789'
  if (includeSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'

  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}