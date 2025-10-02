-- Drop existing ALL policies for passwords table
DROP POLICY IF EXISTS "Users can access passwords in their vaults" ON public.passwords;
DROP POLICY IF EXISTS "Users can manage passwords in vaults with write access" ON public.passwords;
DROP POLICY IF EXISTS "Users can view passwords in vaults with granted access" ON public.passwords;

-- Create separate policies for different operations

-- SELECT: All users can view passwords in their own vaults or vaults with granted access
CREATE POLICY "Users can view passwords in owned vaults" 
ON public.passwords
FOR SELECT 
USING (
  vault_id IN (
    SELECT id FROM vaults WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can view passwords in shared vaults" 
ON public.passwords
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM vault_access_permissions
    WHERE vault_id = passwords.vault_id
      AND user_id = auth.uid()
  )
);

-- INSERT: Only admins and moderators can add passwords
CREATE POLICY "Admins and moderators can insert passwords in owned vaults" 
ON public.passwords
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND vault_id IN (
    SELECT id FROM vaults WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Admins and moderators can insert passwords in vaults with write access" 
ON public.passwords
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND EXISTS (
    SELECT 1 FROM vault_access_permissions
    WHERE vault_id = passwords.vault_id
      AND user_id = auth.uid()
      AND access_level IN ('write', 'admin')
  )
);

-- UPDATE: Only admins and moderators can update passwords
CREATE POLICY "Admins and moderators can update passwords in owned vaults" 
ON public.passwords
FOR UPDATE 
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND vault_id IN (
    SELECT id FROM vaults WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Admins and moderators can update passwords in vaults with write access" 
ON public.passwords
FOR UPDATE 
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND EXISTS (
    SELECT 1 FROM vault_access_permissions
    WHERE vault_id = passwords.vault_id
      AND user_id = auth.uid()
      AND access_level IN ('write', 'admin')
  )
);

-- DELETE: Only admins and moderators can delete passwords
CREATE POLICY "Admins and moderators can delete passwords in owned vaults" 
ON public.passwords
FOR DELETE 
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND vault_id IN (
    SELECT id FROM vaults WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Admins and moderators can delete passwords in vaults with write access" 
ON public.passwords
FOR DELETE 
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND EXISTS (
    SELECT 1 FROM vault_access_permissions
    WHERE vault_id = passwords.vault_id
      AND user_id = auth.uid()
      AND access_level IN ('write', 'admin')
  )
);