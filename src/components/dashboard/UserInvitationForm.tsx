import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Mail, Send, Clock, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useAuditLog } from '@/hooks/useAuditLog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const invitationSchema = z.object({
  email: z.string().email({ message: 'Неверный адрес электронной почты' }),
  role: z.enum(['администратор', 'модератор', 'пользователь']),
})

type InvitationFormValues = z.infer<typeof invitationSchema>

interface Invitation {
  id: string
  email: string
  status: string
  created_at: string
  expires_at: string
}

export const UserInvitationForm = () => {
  const [loading, setLoading] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const { toast } = useToast()
  const { logEvent } = useAuditLog()

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: '',
      role: 'пользователь',
    },
  })

  const loadInvitations = async () => {
    const { data, error } = await supabase
      .from('invitation_tokens')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading invitations:', error)
      return
    }

    setInvitations(data || [])
  }

  const onSubmit = async (values: InvitationFormValues) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: values.email,
          role: values.role,
          invitedBy: user.id,
          appUrl: window.location.origin,
          isResend: false,
        },
      })

      if (error) throw error

      await logEvent({
        action: 'send_invitation',
        resource_type: 'user',
        details: { email: values.email, role: values.role }
      })

      toast({
        title: 'Приглашение отправлено!',
        description: `Приглашение отправлено на ${values.email}`,
      })

      form.reset()
      loadInvitations()
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отправить приглашение',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResendInvitation = async (email: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email,
          role: 'пользователь',
          invitedBy: user.id,
          appUrl: window.location.origin,
          isResend: true,
        },
      })

      if (error) throw error

      toast({
        title: 'Приглашение отправлено повторно!',
        description: `Новое приглашение отправлено на ${email}`,
      })

      loadInvitations()
    } catch (error: any) {
      console.error('Error resending invitation:', error)
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отправить приглашение повторно',
        variant: 'destructive',
      })
    }
  }

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('invitation_tokens')
        .update({ status: 'revoked' })
        .eq('id', invitationId)

      if (error) throw error

      toast({
        title: 'Приглашение отозвано',
        description: `Приглашение для ${email} было отозвано`,
      })

      loadInvitations()
    } catch (error: any) {
      console.error('Error revoking invitation:', error)
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отозвать приглашение',
        variant: 'destructive',
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'revoked':
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const statusNames: Record<string, string> = {
      pending: 'Ожидает',
      accepted: 'Принято',
      expired: 'Истекло',
      revoked: 'Отозвано',
    }
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: 'secondary',
      accepted: 'default',
      expired: 'destructive',
      revoked: 'destructive',
    }
    return (
      <Badge variant={variants[status] || 'outline'}>
        {statusNames[status] || status}
      </Badge>
    )
  }

  useState(() => {
    loadInvitations()
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Пригласить нового пользователя
          </CardTitle>
          <CardDescription>
            Отправить приглашение по электронной почте для добавления нового пользователя в CorpPassSecure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Адрес электронной почты</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="user@company.com"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Пользователь получит ссылку-приглашение по электронной почте
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Роль</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите роль" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="пользователь">Пользователь</SelectItem>
                        <SelectItem value="модератор">Модератор</SelectItem>
                        <SelectItem value="администратор">Администратор</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Назначить роль для этого пользователя
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  'Отправка...'
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить приглашение
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ожидающие приглашения</CardTitle>
          <CardDescription>
            Отслеживание статуса отправленных приглашений
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Приглашения ещё не отправлены
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Отправлено</TableHead>
                  <TableHead>Истекает</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(invitation.status)}
                        {getStatusBadge(invitation.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation.email)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Повторить
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevokeInvitation(invitation.id, invitation.email)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Отозвать
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
