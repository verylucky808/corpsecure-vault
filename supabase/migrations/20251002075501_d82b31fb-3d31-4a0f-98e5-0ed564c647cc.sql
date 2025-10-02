-- First, delete duplicate pending invitations, keeping only the most recent one
DELETE FROM public.invitation_tokens
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY email, status ORDER BY created_at DESC) as rn
    FROM public.invitation_tokens
    WHERE status = 'pending'
  ) t
  WHERE t.rn > 1
);

-- Allow updating invitation tokens when accepted
CREATE POLICY "Allow updating invitation tokens on acceptance"
ON public.invitation_tokens
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add unique constraint to prevent duplicate pending invitations
CREATE UNIQUE INDEX unique_pending_invitation 
ON public.invitation_tokens (email, status) 
WHERE status = 'pending';