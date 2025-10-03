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
  const [isAdmin, setIsAdmin] = useState(false)
  const [companyName, setCompanyName] = useState('CorpPassSecure')
  const [savingCompanyName, setSavingCompanyName] = useState(false)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const { toast } = useToast()
  const { logEvent } = useAuditLog()

  useEffect(() => {
    loadUserProfile()
    loadMfaFactors()
    checkAdminRole()
  }, [])

  const checkAdminRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'администратор'
      })

      if (!error && data) {
        setIsAdmin(true)
      }
    } catch (error) {
      console.error('Error checking admin role:', error)
    }
  }

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
      }

      // Load global MFA requirement setting
      const { data: mfaSettings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'require_mfa_for_passwords')
        .single()

      if (mfaSettings) {
        setRequireMfaForPasswords(mfaSettings.value as boolean)
      }

      // Load company name setting
      const { data: companySettings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'company_name')
        .maybeSingle()

      if (companySettings) {
        setCompanyName(companySettings.value as string)
      }

      // Load company logo setting
      const { data: logoSettings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'company_logo')
        .maybeSingle()

      if (logoSettings) {
        setCompanyLogo(logoSettings.value as string)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const updateMfaRequirement = async (enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Проверяем, существует ли настройка
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'require_mfa_for_passwords')
        .maybeSingle()

      if (existing) {
        // Обновляем существующую
        const { error } = await supabase
          .from('system_settings')
          .update({ 
            value: enabled,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('key', 'require_mfa_for_passwords')

        if (error) throw error
      } else {
        // Создаём новую
        const { error } = await supabase
          .from('system_settings')
          .insert({
            key: 'require_mfa_for_passwords',
            value: enabled,
            updated_by: user.id
          })

        if (error) throw error
      }

      setRequireMfaForPasswords(enabled)

      await logEvent({
        action: enabled ? 'enable_mfa_requirement_for_passwords' : 'disable_mfa_requirement_for_passwords',
        resource_type: 'system_settings',
        resource_id: 'require_mfa_for_passwords',
        details: { require_mfa_for_passwords: enabled }
      })

      toast({
        title: 'Настройки обновлены',
        description: enabled 
          ? '2FA теперь требуется для просмотра паролей всем пользователям' 
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

      // Validate input
      const { profileSchema } = await import('@/lib/validation')
      const validatedData = profileSchema.parse({ full_name: fullName })

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: validatedData.full_name })
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
      const message = error.issues?.[0]?.message || error.message || 'Не удалось обновить имя'
      toast({
        title: 'Ошибка',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const enrollMFA = async () => {
    try {
      // Сначала проверяем и удаляем все незавершённые факторы
      const existingFactors = mfaFactors.filter(
        f => f.friendly_name === 'Google Authenticator' && f.status !== 'verified'
      )
      
      for (const factor of existingFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }

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

      // Для первичной верификации TOTP используем challengeAndVerify
      const challenge = await supabase.auth.mfa.challenge({ factorId: currentFactorId })
      
      if (challenge.error) {
        throw challenge.error
      }

      const { data, error } = await supabase.auth.mfa.verify({
        factorId: currentFactorId,
        challengeId: challenge.data.id,
        code: verificationCode,
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
      // Require password confirmation before disabling MFA
      const password = prompt("Введите ваш пароль для отключения 2FA:");
      if (!password) {
        toast({
          variant: "destructive",
          title: "Отменено",
          description: "Отключение 2FA отменено",
        })
        return
      }

      // Verify password by attempting to reauthenticate
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error("Email пользователя не найден")

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      })

      if (authError) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Неверный пароль. 2FA не был отключен.",
        })
        return
      }

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
        description: 'Не удалось отключить 2FA. Пожалуйста, попробуйте снова.',
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

  const updateCompanyName = async () => {
    setSavingCompanyName(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Validate input
      const { companyNameSchema } = await import('@/lib/validation')
      const validatedData = companyNameSchema.parse({ company_name: companyName })

      // Проверяем, существует ли настройка
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'company_name')
        .maybeSingle()

      if (existing) {
        // Обновляем существующую
        const { error } = await supabase
          .from('system_settings')
          .update({ 
            value: validatedData.company_name,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('key', 'company_name')

        if (error) throw error
      } else {
        // Создаём новую
        const { error } = await supabase
          .from('system_settings')
          .insert({
            key: 'company_name',
            value: validatedData.company_name,
            updated_by: user.id
          })

        if (error) throw error
      }

      await logEvent({
        action: 'update_company_name',
        resource_type: 'system_settings',
        resource_id: 'company_name',
        details: { company_name: validatedData.company_name }
      })

      toast({
        title: 'Успешно',
        description: 'Название компании обновлено',
      })
    } catch (error: any) {
      const message = error.issues?.[0]?.message || error.message || 'Не удалось обновить название компании'
      toast({
        title: 'Ошибка',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSavingCompanyName(false)
    }
  }

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, загрузите файл изображения',
        variant: 'destructive',
      })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Ошибка',
        description: 'Размер файла не должен превышать 2MB',
        variant: 'destructive',
      })
      return
    }

    setUploadingLogo(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Delete old logo if exists
      if (companyLogo) {
        const oldFileName = companyLogo.split('/').pop()
        if (oldFileName) {
          await supabase.storage
            .from('company-logos')
            .remove([oldFileName])
        }
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName)

      // Save to system settings
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'company_logo')
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({ 
            value: publicUrl,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('key', 'company_logo')

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert({
            key: 'company_logo',
            value: publicUrl,
            updated_by: user.id
          })

        if (error) throw error
      }

      setCompanyLogo(publicUrl)

      await logEvent({
        action: 'update_company_logo',
        resource_type: 'system_settings',
        resource_id: 'company_logo',
        details: { logo_url: publicUrl }
      })

      toast({
        title: 'Успешно',
        description: 'Логотип компании обновлен',
      })
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить логотип',
        variant: 'destructive',
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  const removeLogo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Delete logo from storage
      if (companyLogo) {
        const fileName = companyLogo.split('/').pop()
        if (fileName) {
          await supabase.storage
            .from('company-logos')
            .remove([fileName])
        }
      }

      // Remove from system settings
      const { error } = await supabase
        .from('system_settings')
        .delete()
        .eq('key', 'company_logo')

      if (error) throw error

      setCompanyLogo(null)

      await logEvent({
        action: 'remove_company_logo',
        resource_type: 'system_settings',
        resource_id: 'company_logo'
      })

      toast({
        title: 'Успешно',
        description: 'Логотип компании удален',
      })
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить логотип',
        variant: 'destructive',
      })
    }
  }

  const activeMfaFactor = mfaFactors.find(f => f.status === 'verified' && f.friendly_name)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Настройки</h2>
        <p className="text-muted-foreground">Управление профилем и безопасностью</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Безопасность
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="organization">
              <LockIcon className="h-4 w-4 mr-2" />
              Организация
            </TabsTrigger>
          )}
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
    </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Настройки организации</CardTitle>
              <CardDescription>
                Управление общими настройками компании
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Название компании</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Введите название вашей компании"
                />
                <p className="text-sm text-muted-foreground">
                  Это название будет отображаться во всех интерфейсах системы
                </p>
              </div>
              <Button onClick={updateCompanyName} disabled={savingCompanyName}>
                {savingCompanyName ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="companyLogo">Логотип компании</Label>
                {companyLogo && (
                  <div className="flex items-center gap-4">
                    <img 
                      src={companyLogo} 
                      alt="Логотип компании" 
                      className="h-16 w-16 object-contain border rounded-md p-2"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={removeLogo}
                    >
                      Удалить логотип
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    id="companyLogo"
                    type="file"
                    accept="image/*"
                    onChange={uploadLogo}
                    disabled={uploadingLogo}
                    className="cursor-pointer"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Загрузите логотип вашей компании (макс. 2MB, форматы: JPG, PNG, SVG)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockIcon className="h-5 w-5" />
                Требовать 2FA для просмотра паролей
              </CardTitle>
              <CardDescription>
                Когда эта опция включена, для просмотра и копирования паролей всем пользователям системы потребуется активная двухфакторная аутентификация
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">
                    Защита паролей через 2FA (глобальная настройка)
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
                    ⚠️ У вас включена защита паролей через 2FA, но сама двухфакторная аутентификация не настроена. Настройте 2FA в разделе Безопасность, чтобы получить доступ к паролям.
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
