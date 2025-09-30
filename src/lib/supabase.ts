import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Simple encryption/decryption utilities (for demo purposes)
// In production, use more robust encryption
export const encryptPassword = (password: string): string => {
  return btoa(password) // Base64 encoding for demo
}

export const decryptPassword = (encryptedPassword: string): string => {
  return atob(encryptedPassword) // Base64 decoding for demo
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