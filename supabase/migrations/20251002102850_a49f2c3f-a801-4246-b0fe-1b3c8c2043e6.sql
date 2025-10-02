-- Add RLS policies for vaults table
CREATE POLICY "Users can insert their own vaults"
ON public.vaults
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own vaults"
ON public.vaults
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own vaults"
ON public.vaults
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Add RLS policies for passwords table
CREATE POLICY "Users can insert passwords in owned vaults"
ON public.passwords
FOR INSERT
TO authenticated
WITH CHECK (
  vault_id IN (
    SELECT id FROM vaults WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can insert passwords in shared vaults"
ON public.passwords
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vault_access_permissions
    WHERE vault_id = passwords.vault_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update passwords in owned vaults"
ON public.passwords
FOR UPDATE
TO authenticated
USING (
  vault_id IN (
    SELECT id FROM vaults WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  vault_id IN (
    SELECT id FROM vaults WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update passwords in shared vaults"
ON public.passwords
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM vault_access_permissions
    WHERE vault_id = passwords.vault_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vault_access_permissions
    WHERE vault_id = passwords.vault_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete passwords in owned vaults"
ON public.passwords
FOR DELETE
TO authenticated
USING (
  vault_id IN (
    SELECT id FROM vaults WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete passwords in shared vaults"
ON public.passwords
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM vault_access_permissions
    WHERE vault_id = passwords.vault_id
    AND user_id = auth.uid()
  )
);