import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: any;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name?: string;
  email?: string;
}

export const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const { data: logsData, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      if (logsData) {
        setLogs(logsData);

        // Load user profiles
        const userIds = [...new Set(logsData.map((log) => log.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        // Get emails from edge function
        const { data: usersData } = await supabase.functions.invoke("get-users-list");
        
        const profileMap = new Map<string, Profile>();
        
        profilesData?.forEach((profile) => {
          const user = usersData?.users?.find((u: any) => u.user_id === profile.user_id);
          profileMap.set(profile.user_id, {
            user_id: profile.user_id,
            full_name: profile.full_name,
            email: user?.email,
          });
        });

        setProfiles(profileMap);
      }
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes("create") || actionLower.includes("add")) {
      return <Badge variant="default">Создание</Badge>;
    }
    if (actionLower.includes("update") || actionLower.includes("edit")) {
      return <Badge variant="secondary">Изменение</Badge>;
    }
    if (actionLower.includes("delete") || actionLower.includes("remove")) {
      return <Badge variant="destructive">Удаление</Badge>;
    }
    if (actionLower.includes("view") || actionLower.includes("access")) {
      return <Badge variant="outline">Просмотр</Badge>;
    }
    return <Badge>{action}</Badge>;
  };

  const getResourceType = (type: string) => {
    const types: Record<string, string> = {
      user: "Пользователь",
      vault: "Хранилище",
      password: "Пароль",
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Загрузка логов...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Журнал событий</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата и время</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Тип ресурса</TableHead>
                <TableHead>Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const profile = profiles.get(log.user_id);
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "dd.MM.yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {profile?.full_name || "Неизвестный"}
                        </span>
                        {profile?.email && (
                          <span className="text-xs text-muted-foreground">
                            {profile.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>{getResourceType(log.resource_type)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Нет событий для отображения
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
