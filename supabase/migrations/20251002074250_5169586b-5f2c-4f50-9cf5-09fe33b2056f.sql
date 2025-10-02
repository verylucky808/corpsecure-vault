-- Allow users to view vaults they have been granted access to
CREATE POLICY "Users can view vaults with granted access"
ON public.vaults
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vault_access_permissions
    WHERE vault_access_permissions.vault_id = vaults.id
    AND vault_access_permissions.user_id = auth.uid()
  )
);

-- Allow users to update passwords in vaults they have write access to
CREATE POLICY "Users can manage passwords in vaults with write access"
ON public.passwords
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level IN ('write', 'admin')
  )
);

-- Allow users to read passwords in vaults they have any access to
CREATE POLICY "Users can view passwords in vaults with granted access"
ON public.passwords
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
  )
);