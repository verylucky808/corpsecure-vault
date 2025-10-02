-- Allow public (unauthenticated) users to read invitation tokens for validation
CREATE POLICY "Anyone can read invitation tokens for validation"
ON public.invitation_tokens
FOR SELECT
TO public
USING (true);