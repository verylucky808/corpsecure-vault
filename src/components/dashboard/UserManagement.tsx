import { useState, useEffect } from 'react'
import { Users, Shield, Trash2, UserPlus, Settings2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useAuditLog } from '@/hooks/useAuditLog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { UserInvitationForm } from './UserInvitationForm'
import { AccessAssignmentModal } from './AccessAssignmentModal'
import { UserDeleteModal } from './UserDeleteModal'

interface UserProfile {
  user_id: string
  full_name: string | null
  role: string | null
  department: string | null
  created_at: string
  profiles?: {
    email?: string
  }
}

interface UserWithRoles extends UserProfile {
  email: string
  roles: string[]
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const { toast } = useToast()
  const { logEvent } = useAuditLog()

  useEffect(() => {
    checkAdminStatus()
    loadUsers()
  }, [])

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'администратор',
    })

    setIsAdmin(data === true)
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      // Create edge function to fetch users with emails
      const { data: usersData, error: usersError } = await supabase.functions.invoke('get-users-list')

      if (usersError) {
        // Fallback: Load profiles without emails
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, role, department, created_at')
          .neq('role', 'deleted')
          .order('created_at', { ascending: false })

        if (profilesError) throw profilesError

        // Load user roles
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')

        if (rolesError) throw rolesError

        // Combine data without emails
        const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => {
          const roles = (userRoles || [])
            .filter((ur) => ur.user_id === profile.user_id)
            .map((ur) => ur.role)

          return {
            ...profile,
            email: 'Email not available',
            roles: roles.length > 0 ? roles : ['пользователь'],
          }
        })

        setUsers(usersWithRoles)
      } else {
        setUsers(usersData?.users || [])
      }
    } catch (error: any) {
      console.error('Error loading users:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить пользователей',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      // Удаляем существующую роль
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      // Добавляем новую роль
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('user_roles')
        .insert([{
          user_id: userId,
          role: newRole as 'администратор' | 'пользователь',
          assigned_by: user?.id
        }])

      if (error) throw error

      await logEvent({
        action: 'change_user_role',
        resource_type: 'user_roles',
        resource_id: userId,
        details: { new_role: newRole }
      })

      toast({
        title: 'Успешно',
        description: 'Роль пользователя изменена',
      })

      loadUsers()
    } catch (error: any) {
      console.error('Error changing user role:', error)
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось изменить роль пользователя',
        variant: 'destructive',
      })
    }
  }

  const handleManageAccess = (user: UserWithRoles) => {
    setSelectedUser(user)
    setAccessModalOpen(true)
  }

  const handleDeleteUser = (user: UserWithRoles) => {
    setSelectedUser(user)
    setDeleteModalOpen(true)
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      admin: 'destructive',
      moderator: 'default',
      user: 'secondary',
    }
    return <Badge variant={variants[role] || 'outline'}>{role}</Badge>
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Управление пользователями</h2>
          <p className="text-muted-foreground">Управление участниками команды и контроль доступа</p>
        </div>
        <Card className="border-border/50">
          <CardContent className="text-center py-12">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">Требуются права администратора</h3>
            <p className="text-muted-foreground">
              Для доступа к функциям управления пользователями необходимы права администратора.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Управление пользователями</h2>
        <p className="text-muted-foreground">Управление участниками команды и контроль доступа</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Пользователи
          </TabsTrigger>
          <TabsTrigger value="invite">
            <UserPlus className="h-4 w-4 mr-2" />
            Пригласить
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Все пользователи</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Загрузка пользователей...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Пользователи не найдены
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Роли</TableHead>
                      <TableHead>Отдел</TableHead>
                      <TableHead>Присоединился</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">
                          {user.full_name || 'N/A'}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles.map((role) => (
                              <span key={role}>{getRoleBadge(role)}</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{user.department || 'N/A'}</TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Settings2 className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 bg-background">
                                <DropdownMenuLabel>Изменить роль</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => changeUserRole(user.user_id, 'пользователь')}
                                  disabled={user.roles.includes('пользователь')}
                                >
                                  Пользователь
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => changeUserRole(user.user_id, 'администратор')}
                                  disabled={user.roles.includes('администратор')}
                                >
                                  Администратор
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManageAccess(user)}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <UserInvitationForm />
        </TabsContent>
      </Tabs>

      {selectedUser && (
        <>
          <AccessAssignmentModal
            open={accessModalOpen}
            onOpenChange={setAccessModalOpen}
            userId={selectedUser.user_id}
            userName={selectedUser.full_name || 'Unknown'}
          />
          <UserDeleteModal
            open={deleteModalOpen}
            onOpenChange={setDeleteModalOpen}
            userId={selectedUser.user_id}
            userName={selectedUser.full_name || 'Unknown'}
            userEmail={selectedUser.email}
            onSuccess={loadUsers}
          />
        </>
      )}
    </div>
  )
}
