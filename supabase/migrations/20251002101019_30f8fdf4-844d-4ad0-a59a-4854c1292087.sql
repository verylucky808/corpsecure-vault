-- Allow administrators to update and insert system settings
CREATE POLICY "Administrators can update system settings"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'администратор'))
WITH CHECK (public.has_role(auth.uid(), 'администратор'));

CREATE POLICY "Administrators can insert system settings"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'администратор'));