import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useAuditLog } from '@/hooks/useAuditLog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Shield, CheckCircle, XCircle, Copy, Smartphone, Lock as LockIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import QRCode from 'qrcode'
import type { Factor } from '@supabase/supabase-js'

export const Settings = () => {
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [mfaFactors, setMfaFactors] = useState<Factor[]>([])
  const [qrCode, setQrCode] = useState('')
  const [totpSecret, setTotpSecret] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showMfaSetup, setShowMfaSetup] = useState(false)
  const [currentFactorId, setCurrentFactorId] = useState('')
  const [requireMfaForPasswords, setRequireMfaForPasswords] = useState(false)
  const { toast } = useToast()
  const { logEvent } = useAuditLog()

  useEffect(() => {
    loadUserProfile()
    loadMfaFactors()
  }, [])

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, require_mfa_for_passwords')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
        setRequireMfaForPasswords(profile.require_mfa_for_passwords || false)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const updateMfaRequirement = async (enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({ require_mfa_for_passwords: enabled })
        .eq('user_id', user.id)

      if (error) throw error

      setRequireMfaForPasswords(enabled)

      await logEvent({
        action: enabled ? 'enable_mfa_requirement_for_passwords' : 'disable_mfa_requirement_for_passwords',
        resource_type: 'profile',
        resource_id: user.id,
        details: { require_mfa_for_passwords: enabled }
      })

      toast({
        title: 'Настройки обновлены',
        description: enabled 
          ? '2FA теперь требуется для просмотра паролей' 
          : '2FA больше не требуется для просмотра паролей',
      })
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const loadMfaFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      
      if (error) throw error
      
      setMfaFactors(data?.all || [])
    } catch (error) {
      console.error('Error loading MFA factors:', error)
    }
  }

  const updateFullName = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user.id)

      if (error) throw error

      await logEvent({
        action: 'update_profile',
        resource_type: 'user',
        resource_id: user.id,
        details: { field: 'full_name' }
      })

      toast({
        title: 'Успешно',
        description: 'Имя обновлено',
      })
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось обновить имя',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const enrollMFA = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Google Authenticator'
      })

      if (error) throw error

      // Сохраняем ID фактора для последующей верификации
      setCurrentFactorId(data.id)

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(data.totp.uri)
      setQrCode(qrCodeUrl)
      setTotpSecret(data.totp.secret)
      setShowMfaSetup(true)
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось начать настройку 2FA',
        variant: 'destructive',
      })
    }
  }

  const verifyAndEnableMFA = async () => {
    try {
      if (!currentFactorId) {
        toast({
          title: 'Ошибка',
          description: 'Необходимо сначала настроить 2FA',
          variant: 'destructive',
        })
        return
      }

      // Используем verify вместо challengeAndVerify для первичной настройки
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: currentFactorId,
        code: verificationCode,
        challengeId: '' // Пустой challengeId для первичной верификации
      })

      if (error) throw error

      await logEvent({
        action: 'enable_mfa',
        resource_type: 'user',
        details: { factor_type: 'totp' }
      })

      toast({
        title: 'Успешно',
        description: 'Двухфакторная аутентификация включена',
      })

      setShowMfaSetup(false)
      setVerificationCode('')
      setCurrentFactorId('')
      loadMfaFactors()
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Неверный код',
        variant: 'destructive',
      })
    }
  }

  const unenrollMFA = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })

      if (error) throw error

      await logEvent({
        action: 'disable_mfa',
        resource_type: 'user',
        details: { factor_id: factorId }
      })

      toast({
        title: 'Успешно',
        description: 'Двухфакторная аутентификация отключена',
      })

      loadMfaFactors()
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отключить 2FA',
        variant: 'destructive',
      })
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(totpSecret)
    toast({
      title: 'Скопировано',
      description: 'Секретный ключ скопирован в буфер обмена',
    })
  }

  const activeMfaFactor = mfaFactors.find(f => f.status === 'verified' && f.friendly_name)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Настройки</h2>
        <p className="text-muted-foreground">Управление профилем и безопасностью</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Безопасность
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Личная информация</CardTitle>
              <CardDescription>
                Обновите свою личную информацию
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Полное имя</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Введите ваше имя"
                />
              </div>
              <Button onClick={updateFullName} disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Двухфакторная аутентификация
              </CardTitle>
              <CardDescription>
                Добавьте дополнительный уровень безопасности к вашему аккаунту
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeMfaFactor ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Двухфакторная аутентификация активна
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{activeMfaFactor.friendly_name || 'Authenticator'}</p>
                        <p className="text-sm text-muted-foreground">
                          Тип: TOTP (Time-based One-Time Password)
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => unenrollMFA(activeMfaFactor.id)}
                    >
                      Отключить
                    </Button>
                  </div>
                </div>
              ) : showMfaSetup ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Отсканируйте QR-код в приложении Google Authenticator или введите секретный ключ вручную
                    </AlertDescription>
                  </Alert>

                  {qrCode && (
                    <div className="flex flex-col items-center space-y-4">
                      <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                      
                      <div className="w-full space-y-2">
                        <Label>Секретный ключ (для ручного ввода)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={totpSecret}
                            readOnly
                            className="font-mono"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={copySecret}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="w-full space-y-2">
                        <Label htmlFor="verificationCode">Код подтверждения</Label>
                        <Input
                          id="verificationCode"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="Введите 6-значный код"
                          maxLength={6}
                        />
                      </div>

                      <div className="flex gap-2 w-full">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowMfaSetup(false)
                            setVerificationCode('')
                            setCurrentFactorId('')
                          }}
                          className="flex-1"
                        >
                          Отмена
                        </Button>
                        <Button
                          onClick={verifyAndEnableMFA}
                          disabled={verificationCode.length !== 6}
                          className="flex-1"
                        >
                          Подтвердить и включить
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      Двухфакторная аутентификация не настроена
                    </AlertDescription>
                  </Alert>
                  <Button onClick={enrollMFA}>
                    Настроить 2FA
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockIcon className="h-5 w-5" />
                Требовать 2FA для просмотра паролей
              </CardTitle>
              <CardDescription>
                Когда эта опция включена, для просмотра и копирования паролей потребуется активная двухфакторная аутентификация
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">
                    Защита паролей через 2FA
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {requireMfaForPasswords ? 'Включено' : 'Выключено'}
                  </div>
                </div>
                <Button
                  variant={requireMfaForPasswords ? "destructive" : "default"}
                  onClick={() => updateMfaRequirement(!requireMfaForPasswords)}
                >
                  {requireMfaForPasswords ? 'Отключить' : 'Включить'}
                </Button>
              </div>
              {requireMfaForPasswords && !activeMfaFactor && (
                <Alert>
                  <AlertDescription>
                    ⚠️ У вас включена защита паролей через 2FA, но сама двухфакторная аутентификация не настроена. Настройте 2FA выше, чтобы получить доступ к паролям.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
