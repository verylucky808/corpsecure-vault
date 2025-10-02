import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Loader2, CheckCircle, XCircle } from 'lucide-react'

export const AcceptInvite = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [email, setEmail] = useState('')
  const [invitationData, setInvitationData] = useState<any>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)

  const token = searchParams.get('token')

  useEffect(() => {
    validateToken()
  }, [token])

  const validateToken = async () => {
    if (!token) {
      setIsValid(false)
      setValidating(false)
      toast({
        title: 'Error',
        description: 'Invalid invitation link',
        variant: 'destructive',
      })
      return
    }

    try {
      const { data, error } = await supabase
        .from('invitation_tokens')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

      if (error || !data) {
        // Check if invitation was revoked
        const { data: revokedData } = await supabase
          .from('invitation_tokens')
          .select('status')
          .eq('token', token)
          .single()

        if (revokedData?.status === 'revoked') {
          setIsValid(false)
          toast({
            title: 'Error',
            description: 'This invitation has been revoked',
            variant: 'destructive',
          })
          return
        }

        setIsValid(false)
        toast({
          title: 'Error',
          description: 'Invalid or expired invitation',
          variant: 'destructive',
        })
        return
      }

      // Check if expired
      const expiresAt = new Date(data.expires_at)
      if (expiresAt < new Date()) {
        setIsValid(false)
        toast({
          title: 'Error',
          description: 'This invitation has expired',
          variant: 'destructive',
        })
        return
      }

      setInvitationData(data)
      setEmail(data.email)
      setIsValid(true)
    } catch (error) {
      console.error('Error validating token:', error)
      setIsValid(false)
      toast({
        title: 'Error',
        description: 'Failed to validate invitation',
        variant: 'destructive',
      })
    } finally {
      setValidating(false)
      setLoading(false)
    }
  }

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      })
      return
    }

    setCreatingAccount(true)

    try {
      // Validate all inputs
      const { registrationSchema } = await import('@/lib/validation')
      const validatedData = registrationSchema.parse({
        email: email,
        password: password,
        fullName: fullName
      })

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: validatedData.fullName,
          }
        },
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Failed to create account')
      }

      // Profile and role will be created automatically by the handle_new_user trigger

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('invitation_tokens')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('token', token)

      if (updateError) {
        console.error('Error updating invitation:', updateError)
      }

      toast({
        title: 'Success!',
        description: 'Your account has been created successfully',
      })

      // Sign in the user
      await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      })

      navigate('/dashboard')
    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      const message = error.issues?.[0]?.message || error.message || 'Failed to create account'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setCreatingAccount(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate('/auth')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-16 w-16 text-primary" />
          </div>
          <CardTitle>Принять приглашение</CardTitle>
          <CardDescription>
            Создайте учётную запись для присоединения к CorpPassSecure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAcceptInvitation} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={creatingAccount}
            >
              {creatingAccount ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
