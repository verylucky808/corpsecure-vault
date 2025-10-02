import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface UserDeleteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
  userName?: string
  userEmail?: string
  onSuccess?: () => void
}

export const UserDeleteModal = ({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  onSuccess,
}: UserDeleteModalProps) => {
  const [loading, setLoading] = useState(false)
  const [softDelete, setSoftDelete] = useState(true)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!userId) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Revoke all vault access
      const { error: revokeError } = await supabase
        .from('vault_access_permissions')
        .delete()
        .eq('user_id', userId)

      if (revokeError) {
        console.error('Error revoking vault access:', revokeError)
      }

      // Remove from all groups
      const { error: groupError } = await supabase
        .from('user_groups')
        .delete()
        .eq('user_id', userId)

      if (groupError) {
        console.error('Error removing from groups:', groupError)
      }

      // Delete user roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      if (roleError) {
        console.error('Error deleting roles:', roleError)
      }

      if (softDelete) {
        // Soft delete: mark profile as inactive/deleted
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: `[DELETED] ${userName}`,
            role: 'deleted',
          })
          .eq('user_id', userId)

        if (profileError) throw profileError
      } else {
        // Hard delete: call edge function to delete user from auth
        const { error: deleteError } = await supabase.functions.invoke('delete-user', {
          body: { userId }
        })

        if (deleteError) throw deleteError
      }

      // Log the deletion
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: softDelete ? 'soft_delete_user' : 'hard_delete_user',
        resource_type: 'user',
        resource_id: userId,
        details: {
          deleted_user_email: userEmail,
          deleted_user_name: userName,
          soft_delete: softDelete,
        },
      })

      toast({
        title: 'Пользователь удалён',
        description: `Пользователь ${userName} был ${softDelete ? 'деактивирован' : 'удалён навсегда'}`,
      })

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить пользователя',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Удалить пользователя
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Вы уверены, что хотите удалить <strong>{userName}</strong> ({userEmail})?
            </p>
            <div className="bg-muted p-4 rounded-md space-y-2">
              <p className="font-medium text-foreground">Это действие:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Отзовёт доступ ко всем хранилищам</li>
                <li>Удалит из всех групп</li>
                <li>Удалит все назначенные роли</li>
                <li>{softDelete ? 'Пометит пользователя как удалённого (восстанавливается)' : 'Удалит данные пользователя навсегда (НЕ восстанавливается)'}</li>
              </ul>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="soft-delete"
                checked={softDelete}
                onCheckedChange={(checked) => setSoftDelete(checked as boolean)}
              />
              <Label htmlFor="soft-delete" className="text-sm font-normal">
                Мягкое удаление (рекомендуется - возможно восстановление)
              </Label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              'Удаление...'
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить пользователя
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
