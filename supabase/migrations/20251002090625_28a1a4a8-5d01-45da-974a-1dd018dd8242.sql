-- Only admins can update the require_mfa_for_passwords setting
CREATE POLICY "Only admins can update mfa password requirement"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);