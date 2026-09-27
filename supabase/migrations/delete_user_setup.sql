-- ==============================================================================
-- Function: delete_user_account & Foreign Key Fixes
-- Description: Permanently and completely deletes a user account from Supabase Auth,
--              public.user_roles, storage objects, KYC records, notifications,
--              while PRESERVING all invoices (detaching user IDs safely).
-- Run this script in your Supabase Project -> SQL Editor -> Click 'Run'.
-- ==============================================================================

-- 1. Automatically convert ALL blocking foreign keys referencing auth.users to CASCADE or SET NULL
DO $$
DECLARE
    r RECORD;
    target_action TEXT;
BEGIN
    FOR r IN (
        SELECT 
            c.conname,
            n.nspname AS schema_name,
            cl.relname AS table_name,
            a.attname AS column_name
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.confrelid = 'auth.users'::regclass
          AND c.contype = 'f'
          AND c.confdeltype IN ('a', 'r') -- NO ACTION or RESTRICT
    ) LOOP
        IF r.table_name IN ('user_roles', 'user_notifications') 
           OR (r.table_name = 'kyc_records' AND r.column_name = 'user_id') 
           OR (r.table_name = 'kyc_notes' AND r.column_name = 'user_id') THEN
            target_action := 'CASCADE';
        ELSE
            target_action := 'SET NULL';
        END IF;

        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I;', r.schema_name, r.table_name, r.conname);
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s;', 
            r.schema_name, r.table_name, r.conname, r.column_name, target_action);
    END LOOP;
END $$;

-- 2. Explicitly ensure audit_logs allows NULL performed_by
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        FOR r IN (
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'public.audit_logs'::regclass
              AND contype = 'f'
        ) LOOP
            EXECUTE 'ALTER TABLE public.audit_logs DROP CONSTRAINT ' || quote_ident(r.conname);
        END LOOP;

        ALTER TABLE public.audit_logs ALTER COLUMN performed_by DROP NOT NULL;
        
        ALTER TABLE public.audit_logs 
            ADD CONSTRAINT audit_logs_performed_by_fkey 
            FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Explicitly ensure general_notifications allows NULL created_by
ALTER TABLE IF EXISTS public.general_notifications 
    DROP CONSTRAINT IF EXISTS general_notifications_created_by_fkey;

ALTER TABLE IF EXISTS public.general_notifications ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE IF EXISTS public.general_notifications 
    ADD CONSTRAINT general_notifications_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. CREATE FUNCTION delete_user_account
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, pg_temp
AS $$
BEGIN
  -- 1. Security Check: Ensure caller is authenticated and has role CEO or Admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE id = auth.uid() AND role IN ('CEO', 'Admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators (CEO) can permanently delete users';
  END IF;

  -- Prevent accidental deletion of self
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account from the Users management panel.';
  END IF;

  -- Prevent deletion of locked root account (must be removed directly via database if needed)
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = target_user_id AND LOWER(email) = 'harshidyllproductions@gmail.com'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE id = target_user_id AND LOWER(email) = 'harshidyllproductions@gmail.com'
  ) THEN
    RAISE EXCEPTION 'This user ID is locked and cannot be removed from here. It should be removed only from the database.';
  END IF;

  -- 2. Preserve Invoices: Detach the user from all invoices without deleting the invoices
  BEGIN
    UPDATE public.invoices 
    SET owner_id = NULL 
    WHERE owner_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.invoices 
    SET creator_id = NULL 
    WHERE creator_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.invoices 
    SET user_id = NULL 
    WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 3. Detach admin reference from audit logs & general notifications
  BEGIN
    UPDATE public.audit_logs SET performed_by = NULL WHERE performed_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.general_notifications 
    SET created_by = NULL 
    WHERE created_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 4. Delete user-specific notifications
  BEGIN
    DELETE FROM public.user_notifications 
    WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 5. Clean up KYC records, KYC notes, and KYC audit history
  BEGIN
    DELETE FROM public.kyc_notes WHERE user_id = target_user_id;
    UPDATE public.kyc_notes SET created_by = NULL WHERE created_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.kyc_history WHERE user_id = target_user_id;
    UPDATE public.kyc_history SET action_by = NULL WHERE action_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.kyc_records SET requested_by = NULL WHERE requested_by = target_user_id;
    DELETE FROM public.kyc_records WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 6. Clean up support tickets
  BEGIN
    DELETE FROM public.support_tickets WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 7. Clean up Storage files owned by or uploaded by this user across buckets
  -- (avatars, aadhaar_documents, etc.) while preserving invoice documents
  BEGIN
    DELETE FROM storage.objects 
    WHERE (bucket_id IS NULL OR bucket_id != 'invoices')
      AND (
        owner = target_user_id 
        OR owner::text = target_user_id::text
        OR name LIKE (target_user_id::text || '/%') 
        OR name LIKE (target_user_id::text || '-%')
      );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- For invoices bucket, detach user ownership so invoice files remain accessible
  BEGIN
    UPDATE storage.objects 
    SET owner = NULL 
    WHERE owner = target_user_id OR owner::text = target_user_id::text;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 8. Delete the user's role from user_roles
  BEGIN
    DELETE FROM public.user_roles WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 9. Clean up auth-related session, identity, and factor tables
  BEGIN
    DELETE FROM auth.identities WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM auth.sessions WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM auth.mfa_factors WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 10. Permanently delete the user entirely from Supabase Auth
  DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;

-- Grant permissions to execute the function
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO service_role;

-- Ensure delete policy exists on user_roles for admins as a backup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' AND policyname = 'Allow admins to delete roles'
  ) THEN
    CREATE POLICY "Allow admins to delete roles" 
    ON public.user_roles 
    FOR DELETE 
    USING (EXISTS (
      SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('CEO', 'Admin')
    ));
  END IF;
END $$;
