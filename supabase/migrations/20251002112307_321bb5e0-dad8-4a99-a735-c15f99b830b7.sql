-- Enable RLS on vault_access_permissions
ALTER TABLE public.vault_access_permissions ENABLE ROW LEVEL SECURITY;

-- Владельцы хранилищ могут предоставлять доступ к своим хранилищам
CREATE POLICY "Vault owners can grant access to their vaults"
ON public.vault_access_permissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vaults
    WHERE vaults.id = vault_access_permissions.vault_id
    AND vaults.owner_id = auth.uid()
  )
);

-- Владельцы хранилищ могут удалять доступ к своим хранилищам
CREATE POLICY "Vault owners can revoke access to their vaults"
ON public.vault_access_permissions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.vaults
    WHERE vaults.id = vault_access_permissions.vault_id
    AND vaults.owner_id = auth.uid()
  )
);

-- Пользователи могут видеть свои права доступа
CREATE POLICY "Users can view their own access permissions"
ON public.vault_access_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Владельцы хранилищ могут видеть все права доступа к своим хранилищам
CREATE POLICY "Vault owners can view all access permissions for their vaults"
ON public.vault_access_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vaults
    WHERE vaults.id = vault_access_permissions.vault_id
    AND vaults.owner_id = auth.uid()
  )
);

-- Владельцы хранилищ могут обновлять уровень доступа
CREATE POLICY "Vault owners can update access levels"
ON public.vault_access_permissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vaults
    WHERE vaults.id = vault_access_permissions.vault_id
    AND vaults.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vaults
    WHERE vaults.id = vault_access_permissions.vault_id
    AND vaults.owner_id = auth.uid()
  )
);

-- Администраторы могут управлять всеми правами доступа
CREATE POLICY "Administrators can manage all access permissions"
ON public.vault_access_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'администратор'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'администратор'::app_role));