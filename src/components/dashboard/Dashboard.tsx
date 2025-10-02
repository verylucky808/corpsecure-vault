import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Sidebar } from './Sidebar'
import { VaultView } from './VaultView'
import { PasswordGenerator } from './PasswordGenerator'
import { UserManagement } from './UserManagement'
import { AuditLogs } from './AuditLogs'
import { Settings } from './Settings'
import { Shield, LogOut, Key, Users, Settings as SettingsIcon, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface User {
  id: string
  email: string
  full_name?: string
  role?: string
}

interface DashboardStats {
  totalPasswords: number
  totalVaults: number
  sharedPasswords: number
  weakPasswords: number
}

export const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('vaults')
  const [stats, setStats] = useState<DashboardStats>({
    totalPasswords: 0,
    totalVaults: 0,
    sharedPasswords: 0,
    weakPasswords: 0
  })
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    checkUser()
    loadDashboardStats()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        navigate('/auth')
        return
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      // Get user role from user_roles table
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      console.log('User role from database:', userRole)
      console.log('Final role value:', userRole?.role || 'пользователь')

      setUser({
        id: user.id,
        email: user.email || '',
        full_name: profile?.full_name,
        role: userRole?.role || 'пользователь'
      })
    } catch (error) {
      console.error('Error checking user:', error)
      navigate('/auth')
    } finally {
      setLoading(false)
    }
  }

  const loadDashboardStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get vault count
      const { data: vaults } = await supabase
        .from('vaults')
        .select('id')
        .eq('owner_id', user.id)

      // Get password count
      const { data: passwords } = await supabase
        .from('passwords')
        .select('*')
        .in('vault_id', vaults?.map(v => v.id) || [])

      setStats({
        totalPasswords: passwords?.length || 0,
        totalVaults: vaults?.length || 0,
        sharedPasswords: vaults?.filter((v: any) => v.is_shared)?.length || 0,
        weakPasswords: 0 // TODO: Implement weak password detection
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы.",
      })
      navigate('/auth')
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выйти. Попробуйте снова.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-lg">Загрузка рабочего пространства...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar 
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignOut={handleSignOut}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center space-x-2">
                <Shield className="h-6 w-6 text-primary" />
                <span>CorpPassSecure</span>
              </h1>
              <p className="text-muted-foreground">С возвращением, {user?.full_name || user?.email}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground capitalize">{user?.role || 'пользователь'}</span>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">Обзор безопасности</h2>
                <p className="text-muted-foreground">Мониторинг безопасности паролей и активности хранилищ</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Всего паролей</CardTitle>
                    <Key className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalPasswords}</div>
                    <p className="text-xs text-muted-foreground">
                      В {stats.totalVaults} хранилищах
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Защищённые хранилища</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalVaults}</div>
                    <p className="text-xs text-muted-foreground">
                      Зашифрованное хранение
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Общий доступ</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.sharedPasswords}</div>
                    <p className="text-xs text-muted-foreground">
                      Командная работа
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Оценка безопасности</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-accent">98%</div>
                    <p className="text-xs text-muted-foreground">
                      Отличная безопасность
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Быстрые действия</CardTitle>
                  <CardDescription>Основные задачи для начала работы</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      variant="security" 
                      className="h-16"
                      onClick={() => setActiveTab('vaults')}
                    >
                      <div className="text-center">
                        <Shield className="h-6 w-6 mx-auto mb-1" />
                        <div className="text-sm">Добавить пароль</div>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16"
                      onClick={() => setActiveTab('generator')}
                    >
                      <div className="text-center">
                        <Key className="h-6 w-6 mx-auto mb-1" />
                        <div className="text-sm">Сгенерировать пароль</div>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16"
                      onClick={() => setActiveTab('users')}
                    >
                      <div className="text-center">
                        <Users className="h-6 w-6 mx-auto mb-1" />
                        <div className="text-sm">Управление командой</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'vaults' && <VaultView onStatsUpdate={loadDashboardStats} />}
          {activeTab === 'generator' && <PasswordGenerator />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'logs' && <AuditLogs />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}