-- Fix the handle_new_user trigger to use correct Russian role values
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_exists BOOLEAN;
  user_role app_role;
BEGIN
  -- Insert profile for the new user
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Check if any admin already exists in the system
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE role = 'администратор'
  ) INTO admin_exists;
  
  -- Determine role: if no admins exist, make this user admin; otherwise make them a regular user
  IF admin_exists THEN
    user_role := 'пользователь';
  ELSE
    user_role := 'администратор';
  END IF;
  
  -- Assign the role to the new user
  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (NEW.id, user_role, NEW.id);
  
  RETURN NEW;
END;
$function$;