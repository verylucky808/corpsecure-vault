-- Create system_settings table for global settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read system settings
CREATE POLICY "Anyone can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

-- Only admins can update system settings
CREATE POLICY "Only admins can update system settings"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default setting for MFA requirement
INSERT INTO public.system_settings (key, value)
VALUES ('require_mfa_for_passwords', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Remove the require_mfa_for_passwords column from profiles as it's now global
ALTER TABLE public.profiles DROP COLUMN IF EXISTS require_mfa_for_passwords;

-- Drop the admin-only update policy we created earlier
DROP POLICY IF EXISTS "Only admins can update mfa password requirement" ON public.profiles;