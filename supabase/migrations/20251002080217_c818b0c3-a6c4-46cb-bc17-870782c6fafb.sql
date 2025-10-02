-- Drop old constraint
ALTER TABLE public.invitation_tokens 
DROP CONSTRAINT IF EXISTS invitation_tokens_status_check;

-- Add new constraint with 'revoked' status
ALTER TABLE public.invitation_tokens 
ADD CONSTRAINT invitation_tokens_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text]));