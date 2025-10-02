-- Fix 1: Secure invitation_tokens table
-- Remove public read access and restrict to admins only
DROP POLICY IF EXISTS "Anyone can read invitation tokens for validation" ON public.invitation_tokens;

CREATE POLICY "Admins can view all invitations"
ON public.invitation_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'администратор'::app_role
  )
);

-- Fix 2: Improve audit_logs security
-- Add retention cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Restrict audit log insertion to prevent tampering
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Users can insert their own audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'администратор'::app_role
  )
);

CREATE POLICY "Users can view their own audit logs"
ON public.audit_logs
FOR SELECT
USING (auth.uid() = user_id);