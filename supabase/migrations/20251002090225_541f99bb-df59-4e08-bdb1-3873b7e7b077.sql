-- Add setting to profiles table to require 2FA for viewing passwords
ALTER TABLE public.profiles 
ADD COLUMN require_mfa_for_passwords boolean DEFAULT false;

COMMENT ON COLUMN public.profiles.require_mfa_for_passwords IS 'When true, user must have 2FA enabled to view or copy passwords';