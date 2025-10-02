-- Fix 1: Remove obsolete role column from profiles table
-- This column is unused and creates confusion risk for developers
-- Authorization is correctly handled via user_roles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Add comment to user_roles table for clarity
COMMENT ON TABLE public.user_roles IS 
  'PRIMARY TABLE FOR ROLE-BASED ACCESS CONTROL. All authorization checks must use this table via has_role() function.';

-- Fix 2: Restrict system_settings RLS policies
-- Drop overly permissive policy that allows any user to read all settings
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;

-- Create granular policies based on setting sensitivity
CREATE POLICY "Users can read public system settings"
ON public.system_settings
FOR SELECT
USING (
  key IN (
    'require_mfa_for_passwords',
    'company_name'
  )
);

CREATE POLICY "Admins can read all system settings"
ON public.system_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() 
    AND role = 'администратор'::app_role
  )
);