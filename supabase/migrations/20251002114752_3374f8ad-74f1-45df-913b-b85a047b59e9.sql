-- Drop existing policies for shared vault access on passwords table
DROP POLICY IF EXISTS "Users can insert passwords in shared vaults" ON public.passwords;
DROP POLICY IF EXISTS "Users can update passwords in shared vaults" ON public.passwords;
DROP POLICY IF EXISTS "Users can delete passwords in shared vaults" ON public.passwords;

-- Recreate policies with access level checks
-- Users with "редактирование" or "полный доступ" can insert passwords
CREATE POLICY "Users can insert passwords in shared vaults"
ON public.passwords
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level IN ('редактирование', 'полный доступ')
  )
);

-- Users with "редактирование" or "полный доступ" can update passwords
CREATE POLICY "Users can update passwords in shared vaults"
ON public.passwords
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level IN ('редактирование', 'полный доступ')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level IN ('редактирование', 'полный доступ')
  )
);

-- Only users with "полный доступ" can delete passwords
CREATE POLICY "Users can delete passwords in shared vaults"
ON public.passwords
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM vault_access_permissions
    WHERE vault_access_permissions.vault_id = passwords.vault_id
    AND vault_access_permissions.user_id = auth.uid()
    AND vault_access_permissions.access_level = 'полный доступ'
  )
);