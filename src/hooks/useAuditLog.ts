import { supabase } from "@/integrations/supabase/client";

interface AuditLogEntry {
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
}

export const useAuditLog = () => {
  const logEvent = async ({
    action,
    resource_type,
    resource_id,
    details,
  }: AuditLogEntry) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action,
        resource_type,
        resource_id,
        details,
      });
    } catch (error) {
      console.error("Failed to log audit event:", error);
    }
  };

  return { logEvent };
};
