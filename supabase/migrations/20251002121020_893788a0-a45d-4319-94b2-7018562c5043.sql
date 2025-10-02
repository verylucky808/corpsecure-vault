-- Allow administrators to manage user roles
CREATE POLICY "Administrators can view all user roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'администратор'::app_role));

CREATE POLICY "Administrators can update user roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'администратор'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'администратор'::app_role));

CREATE POLICY "Administrators can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'администратор'::app_role));

CREATE POLICY "Administrators can delete user roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'администратор'::app_role));