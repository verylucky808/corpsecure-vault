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
  Lock
} from 'lucide-react'

interface Vault {
  id: string
  name: string
  description: string
  is_shared: boolean
  created_at: string
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

  const loadVaults = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('vaults')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

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
        .order('created_at', { ascending: false })

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

      const { data, error } = await supabase
        .from('vaults')
        .insert([{
          name: newVault.name,
          description: newVault.description,
          is_shared: newVault.is_shared,
          owner_id: user.id
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

      setNewVault({ name: '', description: '', is_shared: false })
      setIsAddingVault(false)
      loadVaults()
      onStatsUpdate()
    } catch (error) {
      console.error('Error creating vault:', error)
    }
  }

  const addPassword = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !selectedVault) return

      const encryptedPassword = encryptPassword(newPassword.password)

      const { data, error } = await supabase
        .from('passwords')
        .insert([{
          vault_id: selectedVault,
          title: newPassword.title,
          username: newPassword.username,
          encrypted_password: encryptedPassword,
          website_url: newPassword.website_url,
          notes: newPassword.notes,
          created_by: user.id
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

  const currentVault = vaults.find(v => v.id === selectedVault)

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
        <Dialog open={isAddingVault} onOpenChange={setIsAddingVault}>
          <DialogTrigger asChild>
            <Button variant="security">
              <Plus className="w-4 h-4 mr-2" />
              New Vault
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Vault</DialogTitle>
              <DialogDescription>
                Create a secure vault to organize your passwords
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
                <Button variant="outline" onClick={() => setIsAddingVault(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="security" 
                  onClick={createVault}
                  disabled={!newVault.name.trim()}
                >
                  Create Vault
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vault Selection */}
      {vaults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Label htmlFor="vault-select">Select Vault:</Label>
            <Select value={selectedVault} onValueChange={setSelectedVault}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose a vault" />
              </SelectTrigger>
              <SelectContent>
                {vaults.map((vault) => (
                  <SelectItem key={vault.id} value={vault.id}>
                    <div className="flex items-center space-x-2">
                      {vault.is_shared ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      <span>{vault.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentVault && (
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {currentVault.is_shared ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    <CardTitle>{currentVault.name}</CardTitle>
                  </div>
                  <Dialog open={isAddingPassword} onOpenChange={setIsAddingPassword}>
                    <DialogTrigger asChild>
                      <Button variant="security" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Password</DialogTitle>
                        <DialogDescription>
                          Add a new password to {currentVault.name}
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
                          <Label htmlFor="password-password">Password</Label>
                          <Input
                            id="password-password"
                            type="password"
                            placeholder="Enter password"
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
                          <Button variant="outline" onClick={() => setIsAddingPassword(false)}>
                            Cancel
                          </Button>
                          <Button 
                            variant="security" 
                            onClick={addPassword}
                            disabled={!newPassword.title.trim() || !newPassword.password.trim()}
                          >
                            Add Password
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>{currentVault.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {passwords.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No passwords yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start by adding your first password to this vault
                    </p>
                    <Button 
                      variant="security" 
                      onClick={() => setIsAddingPassword(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Password
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {passwords.map((password) => (
                      <Card key={password.id} className="p-4 border-border/30">
                        <div className="flex items-start justify-between">
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
                          <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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
    </div>
  )
}