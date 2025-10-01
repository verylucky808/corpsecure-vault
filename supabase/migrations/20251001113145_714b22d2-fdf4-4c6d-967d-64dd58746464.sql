-- Fix RLS policies for groups table
CREATE POLICY "Admins can manage groups"
ON public.groups FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view groups they belong to"
ON public.groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_groups
    WHERE user_groups.group_id = groups.id
    AND user_groups.user_id = auth.uid()
  )
);

-- Fix RLS policies for user_groups table
CREATE POLICY "Admins can manage user groups"
ON public.user_groups FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own group memberships"
ON public.user_groups FOR SELECT
USING (auth.uid() = user_id);