import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { encryptPassword, decryptPassword } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuditLog } from '@/hooks/useAuditLog'
import { 
  Plus, 
  Eye, 
  EyeOff, 
  Copy, 
  Edit, 
  Trash2, 
  ExternalLink,
  Shield,
  Globe,
  User,
  Lock,
  ChevronDown,
  GripVertical
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Vault {
  id: string
  name: string
  description: string
  is_shared: boolean
  created_at: string
  display_order: number
  owner_id?: string
}

interface Password {
  id: string
  vault_id: string
  title: string
  username: string
  encrypted_password: string
  website_url: string
  notes: string
  created_at: string
  display_order: number
}

interface VaultViewProps {
  onStatsUpdate: () => void
}

export const VaultView = ({ onStatsUpdate }: VaultViewProps) => {
  const [vaults, setVaults] = useState<Vault[]>([])
  const [passwords, setPasswords] = useState<Password[]>([])
  const [selectedVault, setSelectedVault] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [isAddingVault, setIsAddingVault] = useState(false)
  const [isAddingPassword, setIsAddingPassword] = useState(false)
  const [editingPassword, setEditingPassword] = useState<Password | null>(null)
  const [editingVault, setEditingVault] = useState<Vault | null>(null)
  const [expandedVaults, setExpandedVaults] = useState<Record<string, boolean>>({})
  const [requireMfaForPasswords, setRequireMfaForPasswords] = useState(false)
  const [hasMfaEnabled, setHasMfaEnabled] = useState(false)
  const [vaultPermissions, setVaultPermissions] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const { toast } = useToast()
  const { logEvent } = useAuditLog()

  const [newVault, setNewVault] = useState({
    name: '',
    description: '',
    is_shared: false
  })

  const [newPassword, setNewPassword] = useState({
    title: '',
    username: '',
    password: '',
    website_url: '',
    notes: ''
  })

  useEffect(() => {
    loadVaults()
    checkMfaSettings()
  }, [])

  const checkMfaSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check global MFA requirement setting
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'require_mfa_for_passwords')
        .single()

      if (settings) {
        setRequireMfaForPasswords(settings.value as boolean)
      }

      // Check if user has MFA enabled
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasActiveMfa = factors?.totp?.some(f => f.status === 'verified') || false
      setHasMfaEnabled(hasActiveMfa)
    } catch (error) {
      console.error('Error checking MFA settings:', error)
    }
  }

  useEffect(() => {
    if (selectedVault) {
      loadPasswords(selectedVault)
    }
  }, [selectedVault])

  const toggleVaultExpanded = (vaultId: string) => {
    setExpandedVaults(prev => ({
      ...prev,
      [vaultId]: !prev[vaultId]
    }))
    if (!expandedVaults[vaultId]) {
      setSelectedVault(vaultId)
    }
  }

  const loadVaults = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      // Load all vaults (RLS policies will filter based on ownership and access permissions)
      const { data, error } = await supabase
        .from('vaults')
        .select('*')
        .order('display_order', { ascending: true })

        if (error) {
          toast({
            title: "Ошибка",
            description: "Не удалось загрузить хранилища",
            variant: "destructive",
          })
          return
        }

      setVaults(data || [])
      
      // Load permissions for vaults that user doesn't own
      const { data: permissions } = await supabase
        .from('vault_access_permissions')
        .select('vault_id, access_level')
        .eq('user_id', user.id)

      const permissionsMap: Record<string, string> = {}
      permissions?.forEach(p => {
        permissionsMap[p.vault_id] = p.access_level
      })
      setVaultPermissions(permissionsMap)

      if (data && data.length > 0 && !selectedVault) {
        setSelectedVault(data[0].id)
      }
    } catch (error) {
      console.error('Error loading vaults:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPasswords = async (vaultId: string) => {
    try {
      const { data, error } = await supabase
        .from('passwords')
        .select('*')
        .eq('vault_id', vaultId)
        .order('display_order', { ascending: true })

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить пароли",
          variant: "destructive",
        })
        return
      }

      setPasswords(data || [])
    } catch (error) {
      console.error('Error loading passwords:', error)
    }
  }

  const createVault = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (editingVault) {
        // Update existing vault
        const { error } = await supabase
          .from('vaults')
          .update({
            name: newVault.name,
            description: newVault.description,
            is_shared: newVault.is_shared,
          })
          .eq('id', editingVault.id)

        if (error) {
          toast({
            title: "Ошибка",
            description: "Не удалось обновить хранилище",
            variant: "destructive",
          })
          return
        }

        await logEvent({
          action: 'update_vault',
          resource_type: 'vault',
          resource_id: editingVault.id,
          details: { name: newVault.name, is_shared: newVault.is_shared }
        })

        toast({
          title: "Успешно",
          description: "Хранилище обновлено успешно",
        })
      } else {
        // Create new vault
        // Get max display_order
        const { data: maxOrderData } = await supabase
          .from('vaults')
          .select('display_order')
          .eq('owner_id', user.id)
          .order('display_order', { ascending: false })
          .limit(1)
        
        const nextOrder = maxOrderData && maxOrderData[0] ? maxOrderData[0].display_order + 1 : 0

        const { data, error } = await supabase
          .from('vaults')
          .insert([{
            name: newVault.name,
            description: newVault.description,
            is_shared: newVault.is_shared,
            owner_id: user.id,
            display_order: nextOrder
          }])
          .select()
          .single()

        if (error) {
          toast({
            title: "Ошибка",
            description: "Не удалось создать хранилище",
            variant: "destructive",
          })
          return
        }

        await logEvent({
          action: 'create_vault',
          resource_type: 'vault',
          resource_id: data.id,
          details: { name: newVault.name, is_shared: newVault.is_shared }
        })

        toast({
          title: "Успешно",
          description: "Хранилище создано успешно",
        })
      }

      setNewVault({ name: '', description: '', is_shared: false })
      setEditingVault(null)
      setIsAddingVault(false)
      loadVaults()
      onStatsUpdate()
    } catch (error) {
      console.error('Error creating vault:', error)
    }
  }

  const startEditVault = (vault: Vault) => {
    setEditingVault(vault)
    setNewVault({
      name: vault.name,
      description: vault.description || '',
      is_shared: vault.is_shared
    })
    setIsAddingVault(true)
  }

  const deleteVault = async (vaultId: string) => {
    try {
      const { error } = await supabase
        .from('vaults')
        .delete()
        .eq('id', vaultId)

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось удалить хранилище",
          variant: "destructive",
        })
        return
      }

      await logEvent({
        action: 'delete_vault',
        resource_type: 'vault',
        resource_id: vaultId,
        details: {}
      })

      toast({
        title: "Успешно",
        description: "Хранилище удалено успешно",
      })

      loadVaults()
      onStatsUpdate()
    } catch (error) {
      console.error('Error deleting vault:', error)
    }
  }

  const addPassword = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !selectedVault) return

      const encryptedPassword = encryptPassword(newPassword.password)

      // Get max display_order for this vault
      const { data: maxOrderData } = await supabase
        .from('passwords')
        .select('display_order')
        .eq('vault_id', selectedVault)
        .order('display_order', { ascending: false })
        .limit(1)
      
      const nextOrder = maxOrderData && maxOrderData[0] ? maxOrderData[0].display_order + 1 : 0

      const { data, error } = await supabase
        .from('passwords')
        .insert([{
          vault_id: selectedVault,
          title: newPassword.title,
          username: newPassword.username,
          encrypted_password: encryptedPassword,
          website_url: newPassword.website_url,
          notes: newPassword.notes,
          created_by: user.id,
          display_order: nextOrder
        }])
        .select()
        .single()

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось добавить пароль",
          variant: "destructive",
        })
        return
      }

      await logEvent({
        action: 'create_password',
        resource_type: 'password',
        resource_id: data.id,
        details: { title: newPassword.title, vault_id: selectedVault }
      })

      toast({
        title: "Успешно",
        description: "Пароль добавлен успешно",
      })

      setNewPassword({
        title: '',
        username: '',
        password: '',
        website_url: '',
        notes: ''
      })
      setIsAddingPassword(false)
      loadPasswords(selectedVault)
      onStatsUpdate()
    } catch (error) {
      console.error('Error adding password:', error)
    }
  }

  const togglePasswordVisibility = async (passwordId: string) => {
    // Check if MFA is enabled when it's required
    if (requireMfaForPasswords) {
      if (!hasMfaEnabled) {
        toast({
          title: "Требуется 2FA",
          description: "Для просмотра паролей необходимо включить двухфакторную аутентификацию в настройках",
          variant: "destructive",
        })
        return
      }
    }

    const isShowing = !showPasswords[passwordId]
    
    setShowPasswords(prev => ({
      ...prev,
      [passwordId]: isShowing
    }))

    // Log when user views a password
    if (isShowing) {
      const password = passwords.find(p => p.id === passwordId)
      if (password) {
        await logEvent({
          action: 'view_password',
          resource_type: 'password',
          resource_id: passwordId,
          details: { title: password.title, vault_id: password.vault_id }
        })
      }
    }
  }

  const copyToClipboard = async (text: string, type: string, isPassword: boolean = false) => {
    // Check if MFA is enabled when it's required for passwords
    if (isPassword && requireMfaForPasswords) {
      if (!hasMfaEnabled) {
        toast({
          title: "Требуется 2FA",
          description: "Для копирования паролей необходимо включить двухфакторную аутентификацию в настройках",
          variant: "destructive",
        })
        return
      }
    }

    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Скопировано",
        description: `${type} скопировано в буфер обмена`,
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать в буфер обмена",
        variant: "destructive",
      })
    }
  }

  const updatePassword = async () => {
    try {
      if (!editingPassword) return

      const encryptedPassword = newPassword.password 
        ? encryptPassword(newPassword.password)
        : editingPassword.encrypted_password

      const { error } = await supabase
        .from('passwords')
        .update({
          title: newPassword.title,
          username: newPassword.username,
          encrypted_password: encryptedPassword,
          website_url: newPassword.website_url,
          notes: newPassword.notes,
        })
        .eq('id', editingPassword.id)

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось обновить пароль",
          variant: "destructive",
        })
        return
      }

      await logEvent({
        action: 'update_password',
        resource_type: 'password',
        resource_id: editingPassword.id,
        details: { title: newPassword.title, vault_id: selectedVault }
      })

      toast({
        title: "Успешно",
        description: "Пароль обновлён успешно",
      })

      setEditingPassword(null)
      setNewPassword({
        title: '',
        username: '',
        password: '',
        website_url: '',
        notes: ''
      })
      loadPasswords(selectedVault)
    } catch (error) {
      console.error('Error updating password:', error)
    }
  }

  const deletePassword = async (passwordId: string) => {
    try {
      const { error } = await supabase
        .from('passwords')
        .delete()
        .eq('id', passwordId)

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось удалить пароль",
          variant: "destructive",
        })
        return
      }

      await logEvent({
        action: 'delete_password',
        resource_type: 'password',
        resource_id: passwordId,
        details: { vault_id: selectedVault }
      })

      toast({
        title: "Успешно",
        description: "Пароль удалён успешно",
      })

      loadPasswords(selectedVault)
      onStatsUpdate()
    } catch (error) {
      console.error('Error deleting password:', error)
    }
  }

  const startEditPassword = (password: Password) => {
    setEditingPassword(password)
    setNewPassword({
      title: password.title,
      username: password.username,
      password: '',
      website_url: password.website_url,
      notes: password.notes
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleVaultDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) return

    const oldIndex = vaults.findIndex((v) => v.id === active.id)
    const newIndex = vaults.findIndex((v) => v.id === over.id)

    const newVaults = arrayMove(vaults, oldIndex, newIndex)
    setVaults(newVaults)

    // Update display_order in database
    try {
      const updates = newVaults.map((vault, index) => 
        supabase
          .from('vaults')
          .update({ display_order: index })
          .eq('id', vault.id)
      )
      await Promise.all(updates)
    } catch (error) {
      console.error('Error updating vault order:', error)
      loadVaults() // Reload if error
    }
  }

  const handlePasswordDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) return

    const oldIndex = passwords.findIndex((p) => p.id === active.id)
    const newIndex = passwords.findIndex((p) => p.id === over.id)

    const newPasswords = arrayMove(passwords, oldIndex, newIndex)
    setPasswords(newPasswords)

    // Update display_order in database
    try {
      const updates = newPasswords.map((password, index) => 
        supabase
          .from('passwords')
          .update({ display_order: index })
          .eq('id', password.id)
      )
      await Promise.all(updates)
    } catch (error) {
      console.error('Error updating password order:', error)
      if (selectedVault) loadPasswords(selectedVault) // Reload if error
    }
  }

  const currentVault = vaults.find(v => v.id === selectedVault)

  // Helper function to check if user can edit vault
  const canEditVault = (vault: Vault): boolean => {
    // Owner can always edit
    if (vault.owner_id === currentUserId) return true
    
    // Check if user has edit or full permissions
    const permission = vaultPermissions[vault.id]
    return permission === 'edit' || permission === 'full'
  }

  // Helper function to check if user can delete from vault
  const canDeleteFromVault = (vault: Vault): boolean => {
    // Owner can always delete
    if (vault.owner_id === currentUserId) return true
    
    // Only users with full permission can delete
    const permission = vaultPermissions[vault.id]
    return permission === 'full'
  }

  // Helper function to check if user is owner
  const isOwner = (vault: Vault): boolean => {
    return vault.owner_id === currentUserId
  }

  // Sortable Vault Component
  const SortableVault = ({ vault }: { vault: Vault }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: vault.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    return (
      <div ref={setNodeRef} style={style}>
        <Collapsible 
          open={expandedVaults[vault.id]}
          onOpenChange={() => toggleVaultExpanded(vault.id)}
        >
          <Card className="transition-all hover:border-primary/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="p-4 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-5 h-5 text-muted-foreground" />
                    </div>
                    {vault.is_shared ? <Globe className="w-5 h-5 text-muted-foreground" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                    <div>
                      <CardTitle className="text-base">{vault.name}</CardTitle>
                      {vault.description && (
                        <CardDescription className="text-sm mt-1">{vault.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner(vault) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditVault(vault)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteVault(vault.id)
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedVaults[vault.id] ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {canEditVault(vault) && (
                  <div className="flex justify-end mb-4">
                    <Button 
                      variant="security" 
                      size="sm"
                      onClick={() => {
                        setSelectedVault(vault.id)
                        setIsAddingPassword(true)
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить пароль
                    </Button>
                  </div>
                )}

                {selectedVault === vault.id && passwords.length === 0 && (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Пока нет паролей</h3>
                    <p className="text-muted-foreground mb-4">
                      Начните с добавления вашего первого пароля в это хранилище
                    </p>
                  </div>
                )}

                {selectedVault === vault.id && passwords.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handlePasswordDragEnd}
                  >
                    <SortableContext
                      items={passwords.map(p => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="grid gap-4">
                        {passwords.map((password) => (
                          <SortablePassword key={password.id} password={password} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    )
  }

  // Sortable Password Component
  const SortablePassword = ({ password }: { password: Password }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: password.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    return (
      <div ref={setNodeRef} style={style}>
        <Card className="p-4 bg-card-vault border-border/40 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing self-center">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium">{password.title}</h4>
                  {password.website_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(password.website_url, '_blank')}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center space-x-2">
                    <User className="w-3 h-3" />
                    <span>{password.username}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(password.username, 'Имя пользователя')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Lock className="w-3 h-3" />
                    <span>
                      {showPasswords[password.id] 
                        ? decryptPassword(password.encrypted_password)
                        : '••••••••'
                      }
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePasswordVisibility(password.id)}
                    >
                      {showPasswords[password.id] ? 
                        <EyeOff className="w-3 h-3" /> : 
                        <Eye className="w-3 h-3" />
                      }
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        decryptPassword(password.encrypted_password), 
                        'Пароль',
                        true
                      )}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  {password.notes && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {password.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {currentVault && canEditVault(currentVault) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => startEditPassword(password)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              {currentVault && canDeleteFromVault(currentVault) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    if (confirm('Вы уверены, что хотите удалить этот пароль?')) {
                      deletePassword(password.id)
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Загрузка хранилищ...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Хранилища паролей</h2>
          <p className="text-muted-foreground">Безопасное хранение и управление вашими паролями</p>
        </div>
        <Dialog open={isAddingVault} onOpenChange={(open) => {
          setIsAddingVault(open)
          if (!open) {
            setEditingVault(null)
            setNewVault({ name: '', description: '', is_shared: false })
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="security">
              <Plus className="w-4 h-4 mr-2" />
              Новое хранилище
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVault ? 'Редактировать хранилище' : 'Создать новое хранилище'}</DialogTitle>
              <DialogDescription>
                {editingVault ? 'Обновить настройки хранилища' : 'Создать защищённое хранилище для организации паролей'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="vault-name">Название хранилища</Label>
                <Input
                  id="vault-name"
                  placeholder="например, Рабочие аккаунты"
                  value={newVault.name}
                  onChange={(e) => setNewVault(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="vault-description">Описание</Label>
                <Textarea
                  id="vault-description"
                  placeholder="Краткое описание хранилища..."
                  value={newVault.description}
                  onChange={(e) => setNewVault(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="vault-shared"
                  checked={newVault.is_shared}
                  onChange={(e) => setNewVault(prev => ({ ...prev, is_shared: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="vault-shared">Сделать хранилище общим для команды</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsAddingVault(false)
                  setEditingVault(null)
                  setNewVault({ name: '', description: '', is_shared: false })
                }}>
                  Отмена
                </Button>
                <Button 
                  variant="security" 
                  onClick={createVault}
                  disabled={!newVault.name.trim()}
                >
                  {editingVault ? 'Обновить хранилище' : 'Создать хранилище'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vaults List */}
      {vaults.length > 0 && (
        <div className="space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleVaultDragEnd}
          >
            <SortableContext
              items={vaults.map(v => v.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-3">
                {vaults.map((vault) => (
                  <SortableVault key={vault.id} vault={vault} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {vaults.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="text-center py-12">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">Хранилища ещё не созданы</h3>
            <p className="text-muted-foreground mb-6">
              Создайте ваше первое защищённое хранилище, чтобы начать организацию паролей
            </p>
            <Button 
              variant="security" 
              onClick={() => setIsAddingVault(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать первое хранилище
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Password Add/Edit Dialog - Outside of vault loop to prevent re-rendering */}
      <Dialog open={isAddingPassword || !!editingPassword} onOpenChange={(open) => {
        if (!open) {
          setIsAddingPassword(false)
          setEditingPassword(null)
          setNewPassword({
            title: '',
            username: '',
            password: '',
            website_url: '',
            notes: ''
          })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPassword ? 'Редактировать пароль' : 'Добавить новый пароль'}</DialogTitle>
            <DialogDescription>
              {editingPassword ? 'Обновить данные пароля' : `Добавить новый пароль в ${currentVault?.name || 'хранилище'}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password-title">Название</Label>
              <Input
                id="password-title"
                placeholder="например, Аккаунт Gmail"
                value={newPassword.title}
                onChange={(e) => setNewPassword(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-username">Имя пользователя/Email</Label>
              <Input
                id="password-username"
                placeholder="username@example.com"
                value={newPassword.username}
                onChange={(e) => setNewPassword(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-password">Пароль {editingPassword && '(оставьте пустым для сохранения текущего)'}</Label>
              <Input
                id="password-password"
                type="password"
                placeholder={editingPassword ? "Введите новый пароль или оставьте пустым" : "Введите пароль"}
                value={newPassword.password}
                onChange={(e) => setNewPassword(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-url">URL сайта</Label>
              <Input
                id="password-url"
                placeholder="https://example.com"
                value={newPassword.website_url}
                onChange={(e) => setNewPassword(prev => ({ ...prev, website_url: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-notes">Заметки</Label>
              <Textarea
                id="password-notes"
                placeholder="Дополнительные заметки..."
                value={newPassword.notes}
                onChange={(e) => setNewPassword(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setIsAddingPassword(false)
                setEditingPassword(null)
                setNewPassword({
                  title: '',
                  username: '',
                  password: '',
                  website_url: '',
                  notes: ''
                })
              }}>
                Отмена
              </Button>
              <Button 
                variant="security" 
                onClick={editingPassword ? updatePassword : addPassword}
                disabled={!newPassword.title.trim() || (!editingPassword && !newPassword.password.trim())}
              >
                {editingPassword ? 'Обновить пароль' : 'Добавить пароль'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}