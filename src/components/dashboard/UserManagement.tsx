import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Shield } from 'lucide-react'

export const UserManagement = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">User Management</h2>
        <p className="text-muted-foreground">Manage team members and access controls</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="text-center py-12">
          <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">User Management Coming Soon</h3>
          <p className="text-muted-foreground">
            Advanced user management features including groups, roles, and permissions will be available in the next update.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}