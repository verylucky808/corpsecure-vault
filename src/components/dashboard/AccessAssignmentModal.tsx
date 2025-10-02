import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface AccessAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
  userName?: string
}

interface Vault {
  id: string
  name: string
  description: string | null
}

interface VaultAccess {
  id: string
  vault_id: string
  access_level: string
  vaults: {
    name: string
  }
}

export const AccessAssignmentModal = ({
  open,
  onOpenChange,
  userId,
  userName,
}: AccessAssignmentModalProps) => {
  const [vaults, setVaults] = useState<Vault[]>([])
  const [selectedVaultId, setSelectedVaultId] = useState<string>('')
  const [accessLevel, setAccessLevel] = useState<string>('read')
  const [addToAllVaults, setAddToAllVaults] = useState(false)
  const [currentAccess, setCurrentAccess] = useState<VaultAccess[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && userId) {
      loadVaults()
      loadCurrentAccess()
    }
  }, [open, userId])

  const loadVaults = async () => {
    const { data, error } = await supabase
      .from('vaults')
      .select('id, name, description')
      .order('name')

    if (error) {
      console.error('Error loading vaults:', error)
      return
    }

    setVaults(data || [])
  }

  const loadCurrentAccess = async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('vault_access_permissions')
      .select(`
        id,
        vault_id,
        access_level,
        vaults (
          name
        )
      `)
      .eq('user_id', userId)

    if (error) {
      console.error('Error loading current access:', error)
      return
    }

    setCurrentAccess(data || [])
  }

  const handleAssignAccess = async () => {
    if (!userId) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (addToAllVaults) {
        // Assign access to all vaults
        for (const vault of vaults) {
          const { error } = await supabase
            .from('vault_access_permissions')
            .upsert({
              user_id: userId,
              vault_id: vault.id,
              access_level: accessLevel,
              granted_by: user.id,
            }, {
              onConflict: 'user_id,vault_id'
            })

          if (error) {
            console.error(`Error granting access to vault ${vault.id}:`, error)
          }
        }

        toast({
          title: 'Доступ предоставлен',
          description: `Предоставлен доступ уровня ${accessLevel} ко всем хранилищам`,
        })
      } else {
        // Assign access to selected vault
        if (!selectedVaultId) {
          toast({
            title: 'Ошибка',
            description: 'Пожалуйста, выберите хранилище',
            variant: 'destructive',
          })
          return
        }

        const { error } = await supabase
          .from('vault_access_permissions')
          .upsert({
            user_id: userId,
            vault_id: selectedVaultId,
            access_level: accessLevel,
            granted_by: user.id,
          }, {
            onConflict: 'user_id,vault_id'
          })

        if (error) throw error

        toast({
          title: 'Доступ предоставлен',
          description: `Предоставлен доступ уровня ${accessLevel} к выбранному хранилищу`,
        })
      }

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'grant_vault_access',
        resource_type: 'vault_access',
        details: {
          target_user: userId,
          access_level: accessLevel,
          add_to_all: addToAllVaults,
        },
      })

      loadCurrentAccess()
      setSelectedVaultId('')
      setAddToAllVaults(false)
    } catch (error: any) {
      console.error('Error assigning access:', error)
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось назначить доступ',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeAccess = async (accessId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('vault_access_permissions')
        .delete()
        .eq('id', accessId)

      if (error) throw error

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'revoke_vault_access',
        resource_type: 'vault_access',
        resource_id: accessId,
        details: {
          target_user: userId,
        },
      })

      toast({
        title: 'Доступ отозван',
        description: 'Доступ к хранилищу успешно отозван',
      })

      loadCurrentAccess()
    } catch (error: any) {
      console.error('Error revoking access:', error)
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отозвать доступ',
        variant: 'destructive',
      })
    }
  }

  const getAccessLevelBadge = (level: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive"> = {
      read: 'secondary',
      edit: 'default',
      full: 'destructive',
    }
    const labels: Record<string, string> = {
      read: 'Только чтение',
      edit: 'Редактирование',
      full: 'Полный контроль',
    }
    return <Badge variant={colors[level] || 'outline'}>{labels[level] || level}</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Управление доступом к хранилищу - {userName}
          </DialogTitle>
          <DialogDescription>
            Назначить или отозвать права доступа к хранилищу для этого пользователя
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Назначение нового доступа */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-medium">Назначить новый доступ</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="all-vaults"
                checked={addToAllVaults}
                onCheckedChange={(checked) => setAddToAllVaults(checked as boolean)}
              />
              <Label htmlFor="all-vaults">Добавить ко всем хранилищам</Label>
            </div>

            {!addToAllVaults && (
              <div className="space-y-2">
                <Label>Выбрать хранилище</Label>
                <Select value={selectedVaultId} onValueChange={setSelectedVaultId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите хранилище" />
                  </SelectTrigger>
                  <SelectContent>
                    {vaults.map((vault) => (
                      <SelectItem key={vault.id} value={vault.id}>
                        {vault.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Уровень доступа</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Только чтение</SelectItem>
                  <SelectItem value="edit">Редактирование</SelectItem>
                  <SelectItem value="full">Полный контроль</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAssignAccess}
              disabled={loading || (!addToAllVaults && !selectedVaultId)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Назначить доступ
            </Button>
          </div>

          {/* Текущие доступы */}
          <div className="space-y-4">
            <h3 className="font-medium">Текущие доступы</h3>
            {currentAccess.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Доступ к хранилищам пока не назначен
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Хранилище</TableHead>
                    <TableHead>Уровень доступа</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentAccess.map((access) => (
                    <TableRow key={access.id}>
                      <TableCell className="font-medium">
                        {access.vaults.name}
                      </TableCell>
                      <TableCell>
                        {getAccessLevelBadge(access.access_level)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeAccess(access.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
