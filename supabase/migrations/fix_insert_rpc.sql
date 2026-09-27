-- Fix the missing column that was causing all inserts to fail
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE OR REPLACE FUNCTION create_user_role(
  target_id UUID, 
  target_name TEXT, 
  target_email TEXT, 
  target_role TEXT, 
  target_status TEXT,
  target_avatar_url TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert the user into user_roles safely, bypassing RLS
  INSERT INTO public.user_roles (
    id, name, email, role, status, overrides, request_date, avatar_url
  ) VALUES (
    target_id, target_name, target_email, target_role, target_status, '{}'::jsonb, NOW(), target_avatar_url
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    status = EXCLUDED.status,
    role = EXCLUDED.role,
    avatar_url = EXCLUDED.avatar_url;
END;
$$;
