-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true);

-- Create RLS policies for logo uploads
CREATE POLICY "Admins can upload company logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'администратор'::app_role
  )
);

CREATE POLICY "Admins can update company logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'администратор'::app_role
  )
);

CREATE POLICY "Admins can delete company logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'администратор'::app_role
  )
);

CREATE POLICY "Anyone can view company logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-logos');