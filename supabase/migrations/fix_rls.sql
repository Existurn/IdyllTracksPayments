-- Enable RLS on the table (just in case it's not)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read all user roles (needed for Admin to see pending users)
CREATE POLICY "Allow all users to view user_roles" 
ON public.user_roles 
FOR SELECT 
USING (true);

-- Allow authenticated users to insert their own role
CREATE POLICY "Allow users to insert their own role" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow users to update their own role (or admins to update others)
CREATE POLICY "Allow users to update roles" 
ON public.user_roles 
FOR UPDATE 
USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('CEO', 'Admin')
));

-- Allow admins to delete roles
CREATE POLICY "Allow admins to delete roles" 
ON public.user_roles 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('CEO', 'Admin')
));
