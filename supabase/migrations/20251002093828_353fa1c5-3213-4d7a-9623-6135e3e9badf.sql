-- Сначала изменяем тип колонки на text
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE text;

-- Обновляем существующие значения на русские
UPDATE public.user_roles 
SET role = CASE 
  WHEN role = 'user' THEN 'пользователь'
  WHEN role = 'admin' THEN 'администратор'
  WHEN role = 'moderator' THEN 'модератор'
  ELSE role
END;

-- Удаляем старый enum
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Создаём новый enum с русскими названиями
CREATE TYPE public.app_role AS ENUM ('пользователь', 'администратор', 'модератор');

-- Применяем новый enum тип к колонке
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

-- Пересоздаём функцию has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;