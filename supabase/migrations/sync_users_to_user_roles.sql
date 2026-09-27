-- ==============================================================================
-- Migration: Sync Auth Users to public.user_roles & Auto-add Trigger
-- Run this in Supabase Project -> SQL Editor -> Click 'Run'
-- ==============================================================================

-- 1. Sync all existing auth.users into public.user_roles if missing
INSERT INTO public.user_roles (
  id, 
  name, 
  email, 
  role, 
  status, 
  overrides, 
  request_date,
  avatar_url
)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', email, 'User'),
  email,
  CASE WHEN LOWER(email) = 'harshidyllproductions@gmail.com' THEN 'CEO' ELSE 'Client' END,
  CASE WHEN LOWER(email) = 'harshidyllproductions@gmail.com' THEN 'Approved' ELSE 'Pending' END,
  '{}'::jsonb,
  COALESCE(created_at, NOW()),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  name = CASE 
    WHEN public.user_roles.name IS NULL OR public.user_roles.name = 'User' 
    THEN EXCLUDED.name 
    ELSE public.user_roles.name 
  END;

-- 2. Create automated trigger function: whenever an account is created in auth.users,
-- automatically insert into public.user_roles as Client (Pending) so they appear in Workspace Users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (
    id, name, email, role, status, overrides, request_date, avatar_url
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User'),
    NEW.email,
    CASE WHEN LOWER(NEW.email) = 'harshidyllproductions@gmail.com' THEN 'CEO' ELSE 'Client' END,
    CASE WHEN LOWER(NEW.email) = 'harshidyllproductions@gmail.com' THEN 'Approved' ELSE 'Pending' END,
    '{}'::jsonb,
    NOW(),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_role();
