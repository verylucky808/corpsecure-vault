-- Add display_order column to vaults table
ALTER TABLE public.vaults 
ADD COLUMN display_order INTEGER;

-- Set initial display_order values based on created_at
UPDATE public.vaults 
SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at DESC) as row_num
  FROM public.vaults
) as subquery
WHERE vaults.id = subquery.id;

-- Add display_order column to passwords table
ALTER TABLE public.passwords 
ADD COLUMN display_order INTEGER;

-- Set initial display_order values based on created_at
UPDATE public.passwords 
SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY vault_id ORDER BY created_at DESC) as row_num
  FROM public.passwords
) as subquery
WHERE passwords.id = subquery.id;