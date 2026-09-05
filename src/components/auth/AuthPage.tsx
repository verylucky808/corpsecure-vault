import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Shield, Lock, Eye, EyeOff, Smartphone } from 'lucide-react'
import { calculatePasswordStrength } from '@/lib/supabase'

interface FormData {
  email: string
  password: string
  fullName?: string
}

export const AuthPage = () => {
  const [formData, setFormData] = useState<FormData>({ email: '', password: '', fullName: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showMfaInput, setShowMfaInput] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaChallengeId, setMfaChallengeId] = useState<string>('')
  const [mfaFactorId, setMfaFactorId] = useState<string>('')
  const [emailSent, setEmailSent] = useState(false)
  const [signUpEmail, setSignUpEmail] = useState('')
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateForm = (isSignUp: boolean) => {
    if (!formData.email || !formData.password) {
      setError('Все поля обязательны для заполнения')
      return false
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Пожалуйста, введите корректный email адрес')
      return false
    }

    if (formData.password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов')
      return false
    }

    if (isSignUp && !formData.fullName?.trim()) {
      setError('Полное имя обязательно для заполнения')
      return false
    }

    return true
  }

  const handleSignIn = async () => {
    if (!validateForm(false)) return

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        setError(error.message)
        return
      }

      // Проверяем, есть ли у пользователя активный MFA
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const activeFactor = factors?.all?.find(f => f.status === 'verified')

      if (activeFactor) {
        // Создаём challenge для MFA
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: activeFactor.id
        })

        if (challengeError) {
          setError('Ошибка инициализации 2FA')
          return
        }

        setMfaChallengeId(challengeData.id)
        setMfaFactorId(activeFactor.id)
        setShowMfaInput(true)
      } else {
        // Нет MFA, сразу перенаправляем
        toast({
          title: "С возвращением!",
          description: "Вы успешно вошли в систему.",
        })
        navigate('/dashboard')
      }
    } catch (err) {
      setError('Произошла непредвиденная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleMfaVerify = async () => {
    if (!mfaChallengeId || !mfaCode || !mfaFactorId) return

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      })

      if (error) {
        setError('Неверный код 2FA')
        return
      }

      toast({
        title: "С возвращением!",
        description: "Вы успешно вошли в систему.",
      })
      navigate('/dashboard')
    } catch (err) {
      setError('Произошла ошибка при проверке 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!validateForm(true)) return

    setLoading(true)
    setError('')

    try {
      // Возврат после подтверждения: работает и на localhost, и на 127.0.0.1:8080
      const redirectTo = `${window.location.origin}/dashboard`

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
          emailRedirectTo: redirectTo,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.session) {
        toast({
          title: "Аккаунт создан!",
          description: "Добро пожаловать в CorpPassSecure.",
        })
        navigate('/dashboard')
        return
      }

      setSignUpEmail(formData.email)
      setEmailSent(true)
      toast({
        title: "Проверьте почту",
        description: `Мы отправили письмо с подтверждением на ${formData.email}.`,
      })
    } catch (err) {
      setError('Произошла непредвиденная ошибка')
    } finally {
      setLoading(false)
    }
  }


  const passwordStrength = calculatePasswordStrength(formData.password)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">CorpPassSecure</h1>
          </div>
          <p className="text-muted-foreground">Корпоративное управление паролями</p>
        </div>

        {/* Auth Form */}
        <Card className="border-border/50 shadow-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Аутентификация</CardTitle>
            <CardDescription>
              Войдите в свой аккаунт или создайте новый
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Вход</TabsTrigger>
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
              </TabsList>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="signin" className="space-y-4">
                {!showMfaInput ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your.email@company.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Пароль</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Введите пароль"
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className="h-11 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-11 w-10"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSignIn} 
                      className="w-full h-11" 
                      variant="security"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Вход...</span>
                        </div>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          Войти
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Alert>
                      <Smartphone className="h-4 w-4" />
                      <AlertDescription>
                        Введите 6-значный код из приложения Google Authenticator
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label htmlFor="mfa-code">Код 2FA</Label>
                      <Input
                        id="mfa-code"
                        type="text"
                        placeholder="000000"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        maxLength={6}
                        className="h-11 text-center text-lg tracking-widest"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          setShowMfaInput(false)
                          setMfaCode('')
                          setMfaChallengeId('')
                          setMfaFactorId('')
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Назад
                      </Button>
                      <Button 
                        onClick={handleMfaVerify} 
                        className="flex-1" 
                        variant="security"
                        disabled={loading || mfaCode.length !== 6}
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Проверка...</span>
                          </div>
                        ) : (
                          'Подтвердить'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                {emailSent ? (
                  <div className="space-y-4 text-center">
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-left">
                        Проверьте почту — мы отправили письмо с подтверждением на{' '}
                        <span className="font-medium">{signUpEmail}</span>. Перейдите по ссылке
                        из письма, чтобы активировать аккаунт и войти.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={() => {
                        setEmailSent(false)
                        setFormData({ email: '', password: '', fullName: '' })
                      }}
                    >
                      Назад
                    </Button>
                  </div>
                ) : (
                <>

                <div className="space-y-2">
                  <Label htmlFor="signup-name">Полное имя</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Иван Иванов"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your.email@company.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Пароль</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Создайте надёжный пароль"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-11 w-10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formData.password && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Надёжность пароля</span>
                        <span className={
                          passwordStrength.score >= 80 ? 'text-accent' :
                          passwordStrength.score >= 60 ? 'text-yellow-500' :
                          'text-destructive'
                        }>
                          {passwordStrength.score >= 80 ? 'Сильный' :
                           passwordStrength.score >= 60 ? 'Хороший' :
                           passwordStrength.score >= 40 ? 'Средний' : 'Слабый'}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            passwordStrength.score >= 80 ? 'bg-accent' :
                            passwordStrength.score >= 60 ? 'bg-yellow-500' :
                            'bg-destructive'
                          }`}
                          style={{ width: `${passwordStrength.score}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleSignUp} 
                  className="w-full h-11" 
                  variant="security"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Создание аккаунта...</span>
                    </div>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Создать аккаунт
                    </>
                  )}
                </Button>
                </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Ваши данные защищены корпоративным шифрованием
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
            <span className="flex items-center space-x-1">
              <Shield className="h-3 w-3" />
              <span>AES-256</span>
            </span>
            <span className="flex items-center space-x-1">
              <Lock className="h-3 w-3" />
              <span>Нулевое разглашение</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}