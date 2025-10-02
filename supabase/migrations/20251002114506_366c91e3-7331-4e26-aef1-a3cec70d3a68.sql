-- Drop the problematic policies on vault_access_permissions
DROP POLICY IF EXISTS "Vault owners can grant access to their vaults" ON public.vault_access_permissions;
DROP POLICY IF EXISTS "Vault owners can revoke access to their vaults" ON public.vault_access_permissions;
DROP POLICY IF EXISTS "Users can view their own access permissions" ON public.vault_access_permissions;
DROP POLICY IF EXISTS "Vault owners can view all access permissions for their vaults" ON public.vault_access_permissions;
DROP POLICY IF EXISTS "Vault owners can update access levels" ON public.vault_access_permissions;
DROP POLICY IF EXISTS "Administrators can manage all access permissions" ON public.vault_access_permissions;

-- Create simplified policies that don't cause recursion
-- Allow INSERT for authenticated users (vault ownership will be checked in app logic)
CREATE POLICY "Vault owners can grant access to their vaults"
ON public.vault_access_permissions
FOR INSERT
WITH CHECK (auth.uid() = granted_by);

-- Allow DELETE for the person who granted access
CREATE POLICY "Vault owners can revoke access to their vaults"
ON public.vault_access_permissions
FOR DELETE
USING (auth.uid() = granted_by);

-- Allow users to view their own access
CREATE POLICY "Users can view their own access permissions"
ON public.vault_access_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Allow grantors to view access they granted
CREATE POLICY "Vault owners can view all access permissions for their vaults"
ON public.vault_access_permissions
FOR SELECT
USING (auth.uid() = granted_by);

-- Allow UPDATE for the person who granted access
CREATE POLICY "Vault owners can update access levels"
ON public.vault_access_permissions
FOR UPDATE
USING (auth.uid() = granted_by)
WITH CHECK (auth.uid() = granted_by);

-- Administrators can manage all access permissions
CREATE POLICY "Administrators can manage all access permissions"
ON public.vault_access_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'администратор'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'администратор'::app_role));