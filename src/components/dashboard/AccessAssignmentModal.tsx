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
        const accessRecords = vaults.map((vault) => ({
          user_id: userId,
          vault_id: vault.id,
          access_level: accessLevel,
          granted_by: user.id,
        }))

        const { error } = await supabase
          .from('vault_access_permissions')
          .upsert(accessRecords)

        if (error) throw error

        toast({
          title: 'Access granted',
          description: `Granted ${accessLevel} access to all vaults`,
        })
      } else {
        // Assign access to selected vault
        if (!selectedVaultId) {
          toast({
            title: 'Error',
            description: 'Please select a vault',
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
          })

        if (error) throw error

        toast({
          title: 'Access granted',
          description: `Granted ${accessLevel} access to selected vault`,
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
        title: 'Error',
        description: error.message || 'Failed to assign access',
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
        title: 'Access revoked',
        description: 'Vault access has been revoked',
      })

      loadCurrentAccess()
    } catch (error: any) {
      console.error('Error revoking access:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke access',
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
    return <Badge variant={colors[level] || 'outline'}>{level}</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Vault Access - {userName}
          </DialogTitle>
          <DialogDescription>
            Assign or revoke vault access permissions for this user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Assign New Access */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-medium">Assign New Access</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="all-vaults"
                checked={addToAllVaults}
                onCheckedChange={(checked) => setAddToAllVaults(checked as boolean)}
              />
              <Label htmlFor="all-vaults">Add to all vaults</Label>
            </div>

            {!addToAllVaults && (
              <div className="space-y-2">
                <Label>Select Vault</Label>
                <Select value={selectedVaultId} onValueChange={setSelectedVaultId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a vault" />
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
              <Label>Access Level</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read Only</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="full">Full Control</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAssignAccess}
              disabled={loading || (!addToAllVaults && !selectedVaultId)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Assign Access
            </Button>
          </div>

          {/* Current Access */}
          <div className="space-y-4">
            <h3 className="font-medium">Current Access</h3>
            {currentAccess.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No vault access assigned yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vault</TableHead>
                    <TableHead>Access Level</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
