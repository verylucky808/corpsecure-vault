import { Button } from '@/components/ui/button'
import { 
  Shield, 
  Key, 
  Users, 
  Settings, 
  BarChart3, 
  LogOut,
  Vault,
  FileText
} from 'lucide-react'

interface User {
  id: string
  email: string
  full_name?: string
  role?: string
}

interface SidebarProps {
  user: User | null
  activeTab: string
  onTabChange: (tab: string) => void
  onSignOut: () => void
}

const menuItems = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'vaults', label: 'Password Vaults', icon: Vault },
  { id: 'generator', label: 'Password Generator', icon: Key },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'logs', label: 'Audit Logs', icon: FileText, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export const Sidebar = ({ user, activeTab, onTabChange, onSignOut }: SidebarProps) => {
  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-2">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h2 className="font-bold text-lg">CorpPassSecure</h2>
            <p className="text-xs text-muted-foreground">Enterprise Security</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-border">
        <div className="space-y-1">
          <p className="text-sm font-medium">{user?.full_name || 'User'}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <span className="text-xs text-muted-foreground capitalize">
              {user?.role || 'user'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          const isAdmin = user?.role === 'admin'
          
          // Hide admin-only items for non-admins
          if (item.adminOnly && !isAdmin) {
            return null
          }
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start h-11 ${
                isActive ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : ''
              }`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon className="w-4 h-4 mr-3" />
              {item.label}
            </Button>
          )
        })}
      </nav>

      {/* Security Status */}
      <div className="p-4 border-t border-border">
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Security Status</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span className="text-xs text-accent">Secure</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            All systems operational
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="p-4">
        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={onSignOut}
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}