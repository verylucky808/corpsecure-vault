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
import { Shield, Lock, Eye, EyeOff } from 'lucide-react'
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
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        setError(error.message)
      } else {
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

  const handleSignUp = async () => {
    if (!validateForm(true)) return

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) {
        setError(error.message)
      } else {
        toast({
          title: "Аккаунт создан!",
          description: "Добро пожаловать в CorpPassSecure. Теперь вы можете безопасно управлять паролями.",
        })
        navigate('/dashboard')
      }
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
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
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