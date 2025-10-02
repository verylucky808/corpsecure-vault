-- Drop existing policies for shared vault access on passwords table
DROP POLICY IF EXISTS "Users can insert passwords in shared vaults" ON public.passwords;
DROP POLICY IF EXISTS "Users can update passwords in shared vaults" ON public.passwords;
DROP POLICY IF EXISTS "Users can delete passwords in shared vaults" ON public.passwords;

-- Recreate policies with access level checks using English values
-- Users with "edit" or "full" can insert passwords
CREATE POLICY "Users can insert passwords in shared vaults"
ON public.passwords
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level IN ('edit', 'full')
  )
);

-- Users with "edit" or "full" can update passwords
CREATE POLICY "Users can update passwords in shared vaults"
ON public.passwords
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level IN ('edit', 'full')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level IN ('edit', 'full')
  )
);

-- Only users with "full" can delete passwords
CREATE POLICY "Users can delete passwords in shared vaults"
ON public.passwords
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level = 'full'
  )
);