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
  const { toast } = useToast()

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
  }, [])

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

      // Load all vaults (RLS policies will filter based on ownership and access permissions)
      const { data, error } = await supabase
        .from('vaults')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load vaults",
          variant: "destructive",
        })
        return
      }

      setVaults(data || [])
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
          title: "Error",
          description: "Failed to load passwords",
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
            title: "Error",
            description: "Failed to update vault",
            variant: "destructive",
          })
          return
        }

        toast({
          title: "Success",
          description: "Vault updated successfully",
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
            title: "Error",
            description: "Failed to create vault",
            variant: "destructive",
          })
          return
        }

        toast({
          title: "Success",
          description: "Vault created successfully",
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
          title: "Error",
          description: "Failed to delete vault",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Vault deleted successfully",
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
          title: "Error",
          description: "Failed to add password",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Password added successfully",
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

  const togglePasswordVisibility = (passwordId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [passwordId]: !prev[passwordId]
    }))
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied",
        description: `${type} copied to clipboard`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
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
          title: "Error",
          description: "Failed to update password",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Password updated successfully",
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
          title: "Error",
          description: "Failed to delete password",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Password deleted successfully",
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
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedVaults[vault.id] ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
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
                    Add Password
                  </Button>
                </div>

                {selectedVault === vault.id && passwords.length === 0 && (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No passwords yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start by adding your first password to this vault
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
        <Card className="p-4 border-border/30">
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
                      onClick={() => copyToClipboard(password.username, 'Username')}
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
                        'Password'
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
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => startEditPassword(password)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this password?')) {
                    deletePassword(password.id)
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
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
          <span>Loading vaults...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Password Vaults</h2>
          <p className="text-muted-foreground">Securely store and manage your passwords</p>
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
              New Vault
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVault ? 'Edit Vault' : 'Create New Vault'}</DialogTitle>
              <DialogDescription>
                {editingVault ? 'Update vault settings' : 'Create a secure vault to organize your passwords'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="vault-name">Vault Name</Label>
                <Input
                  id="vault-name"
                  placeholder="e.g., Work Accounts"
                  value={newVault.name}
                  onChange={(e) => setNewVault(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="vault-description">Description</Label>
                <Textarea
                  id="vault-description"
                  placeholder="Brief description of this vault..."
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
                <Label htmlFor="vault-shared">Make this vault shared with team</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsAddingVault(false)
                  setEditingVault(null)
                  setNewVault({ name: '', description: '', is_shared: false })
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="security" 
                  onClick={createVault}
                  disabled={!newVault.name.trim()}
                >
                  {editingVault ? 'Update Vault' : 'Create Vault'}
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
            <h3 className="text-xl font-medium mb-2">No vaults created yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first secure vault to start organizing your passwords
            </p>
            <Button 
              variant="security" 
              onClick={() => setIsAddingVault(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Vault
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
            <DialogTitle>{editingPassword ? 'Edit Password' : 'Add New Password'}</DialogTitle>
            <DialogDescription>
              {editingPassword ? 'Update password details' : `Add a new password to ${currentVault?.name || 'vault'}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password-title">Title</Label>
              <Input
                id="password-title"
                placeholder="e.g., Gmail Account"
                value={newPassword.title}
                onChange={(e) => setNewPassword(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-username">Username/Email</Label>
              <Input
                id="password-username"
                placeholder="username@example.com"
                value={newPassword.username}
                onChange={(e) => setNewPassword(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-password">Password {editingPassword && '(leave empty to keep current)'}</Label>
              <Input
                id="password-password"
                type="password"
                placeholder={editingPassword ? "Enter new password or leave empty" : "Enter password"}
                value={newPassword.password}
                onChange={(e) => setNewPassword(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-url">Website URL</Label>
              <Input
                id="password-url"
                placeholder="https://example.com"
                value={newPassword.website_url}
                onChange={(e) => setNewPassword(prev => ({ ...prev, website_url: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-notes">Notes</Label>
              <Textarea
                id="password-notes"
                placeholder="Additional notes..."
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
                Cancel
              </Button>
              <Button 
                variant="security" 
                onClick={editingPassword ? updatePassword : addPassword}
                disabled={!newPassword.title.trim() || (!editingPassword && !newPassword.password.trim())}
              >
                {editingPassword ? 'Update Password' : 'Add Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}