-- ==============================================================================
-- Migration: KYC, Notifications & Support System
-- Description: Sets up tables, RLS policies, storage bucket, automated 1-hour 
--              progression via pg_cron, and cleanup RPCs.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. KYC RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_holder_name TEXT,
    legal_name TEXT,
    aadhar_number TEXT,
    dob TEXT,
    address TEXT,
    document_url TEXT,
    document_name TEXT,
    document_type TEXT,
    document_size BIGINT,
    status TEXT NOT NULL DEFAULT 'Requested' 
        CHECK (status IN ('Requested', 'Submitted', 'Under Review', 'Verification in Progress', 'Verified', 'Action Required', 'Resubmission Required', 'Rejected')),
    is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    requested_by UUID REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ,
    status_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_kyc UNIQUE (user_id)
);

-- Index for fast user and status queries
CREATE INDEX IF NOT EXISTS idx_kyc_records_user_id ON public.kyc_records(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_records_status ON public.kyc_records(status);
CREATE INDEX IF NOT EXISTS idx_kyc_records_submitted_at ON public.kyc_records(submitted_at);

-- 3. KYC NOTES TABLE (Internal Admin Notes & User-Facing Latest Reasons)
CREATE TABLE IF NOT EXISTS public.kyc_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID REFERENCES public.kyc_records(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status_context TEXT NOT NULL,
    note TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_notes_user_id ON public.kyc_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_notes_created_at ON public.kyc_notes(created_at DESC);

-- 4. KYC AUDIT HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.kyc_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_holder_name TEXT,
    aadhar_number_masked TEXT,
    document_name TEXT,
    previous_status TEXT,
    new_status TEXT,
    action TEXT NOT NULL,
    action_by UUID,
    action_by_name TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_history_user_id ON public.kyc_history(user_id);

-- 5. GENERAL NOTIFICATIONS TABLE (Admin Broadcast Banners)
CREATE TABLE IF NOT EXISTS public.general_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    start_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_date DATE NOT NULL,
    end_time TIME NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_general_notifications_window ON public.general_notifications(start_at, end_at);

-- 6. USER NOTIFICATIONS TABLE (User-Specific Alerts & Bell Dropdown)
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications(user_id, created_at DESC);

-- 7. SUPPORT TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_email TEXT NOT NULL,
    account_id TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. STORAGE BUCKET SETUP: aadhaar_documents (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'aadhaar_documents',
    'aadhaar_documents',
    FALSE,
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET 
    public = FALSE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

-- 9. POSTGRES FUNCTION: AUTOMATIC 1-HOUR KYC PROGRESSION
-- Progression: Submitted -> (1 hr) -> Under Review -> (1 hr) -> Verification in Progress
CREATE OR REPLACE FUNCTION advance_kyc_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
BEGIN
    -- 1. Advance from 'Submitted' to 'Under Review' after 1 hour
    FOR rec IN 
        SELECT id, user_id, account_holder_name, submitted_at 
        FROM public.kyc_records
        WHERE status = 'Submitted'
          AND is_manual_override = FALSE
          AND submitted_at <= (NOW() - INTERVAL '1 hour')
    LOOP
        UPDATE public.kyc_records
        SET status = 'Under Review',
            status_updated_at = NOW(),
            updated_at = NOW()
        WHERE id = rec.id;

        -- Create user notification
        INSERT INTO public.user_notifications (user_id, title, message, type)
        VALUES (
            rec.user_id,
            'KYC Under Review',
            'Your identity verification documents are now officially under review by our compliance team.',
            'kyc_under_review'
        );

        -- Record in audit history
        INSERT INTO public.kyc_history (user_id, account_holder_name, previous_status, new_status, action, note)
        VALUES (
            rec.user_id,
            rec.account_holder_name,
            'Submitted',
            'Under Review',
            'AUTOMATED_1HR_TRANSITION',
            'Advanced automatically by server scheduler after 1 hour'
        );
    END LOOP;

    -- 2. Advance from 'Under Review' to 'Verification in Progress' after another 1 hour (2 hours total from submitted_at)
    FOR rec IN 
        SELECT id, user_id, account_holder_name, submitted_at 
        FROM public.kyc_records
        WHERE status = 'Under Review'
          AND is_manual_override = FALSE
          AND submitted_at <= (NOW() - INTERVAL '2 hours')
    LOOP
        UPDATE public.kyc_records
        SET status = 'Verification in Progress',
            status_updated_at = NOW(),
            updated_at = NOW()
        WHERE id = rec.id;

        -- Create user notification
        INSERT INTO public.user_notifications (user_id, title, message, type)
        VALUES (
            rec.user_id,
            'KYC Verification in Progress',
            'Your identity verification is now actively in progress. An authorized manager will review your submission shortly.',
            'kyc_verification_in_progress'
        );

        -- Record in audit history
        INSERT INTO public.kyc_history (user_id, account_holder_name, previous_status, new_status, action, note)
        VALUES (
            rec.user_id,
            rec.account_holder_name,
            'Under Review',
            'Verification in Progress',
            'AUTOMATED_2HR_TRANSITION',
            'Advanced automatically by server scheduler after 2 hours total'
        );
    END LOOP;
END;
$$;

-- 10. CRON JOB SCHEDULE (Runs every 5 minutes server-side)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove existing schedule if exists to avoid duplicate registrations
        PERFORM cron.unschedule('kyc_auto_advance_job') WHERE EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'kyc_auto_advance_job'
        );
        PERFORM cron.schedule('kyc_auto_advance_job', '*/5 * * * *', 'SELECT advance_kyc_statuses()');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron registration skipped or not permitted: %', SQLERRM;
END $$;

-- 11. RPC FUNCTION: DELETE USER KYC RESET
CREATE OR REPLACE FUNCTION delete_user_kyc(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_rec RECORD;
    admin_name TEXT := 'Admin';
BEGIN
    -- Authorization check: caller must be Admin / CEO
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE id = auth.uid() AND role IN ('CEO', 'Admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can delete KYC submissions';
    END IF;

    -- Fetch existing record
    SELECT * INTO existing_rec FROM public.kyc_records WHERE user_id = target_user_id;
    
    IF FOUND THEN
        -- Record audit history
        INSERT INTO public.kyc_history (
            user_id,
            account_holder_name,
            document_name,
            previous_status,
            new_status,
            action,
            action_by,
            note
        ) VALUES (
            target_user_id,
            existing_rec.account_holder_name,
            existing_rec.document_name,
            existing_rec.status,
            'Deleted/Reset',
            'KYC_DELETED',
            auth.uid(),
            'Active KYC record and uploaded documents deleted by admin'
        );

        -- Delete documents from storage
        IF existing_rec.document_url IS NOT NULL THEN
            DELETE FROM storage.objects 
            WHERE bucket_id = 'aadhaar_documents' 
              AND name = existing_rec.document_url;
        END IF;

        -- Delete any other files in user's directory
        DELETE FROM storage.objects 
        WHERE bucket_id = 'aadhaar_documents' 
          AND name LIKE (target_user_id || '/%');

        -- Delete the active record
        DELETE FROM public.kyc_records WHERE user_id = target_user_id;

        -- Create notification for user
        INSERT INTO public.user_notifications (user_id, title, message, type)
        VALUES (
            target_user_id,
            'KYC Record Reset',
            'Your previous KYC verification record has been reset. You will need a new verification request before submitting again.',
            'kyc_reset'
        );
    END IF;
END;
$$;

-- 12. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Helper to check if current user is admin/manager
CREATE OR REPLACE FUNCTION is_kyc_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() 
      AND (role IN ('CEO', 'Admin') OR overrides->>'kyc-management' = 'true')
  );
$$;

-- RLS: kyc_records
DROP POLICY IF EXISTS "Users can view own kyc record" ON public.kyc_records;
CREATE POLICY "Users can view own kyc record" 
ON public.kyc_records FOR SELECT 
USING (auth.uid() = user_id OR is_kyc_manager());

DROP POLICY IF EXISTS "Users can insert own kyc record" ON public.kyc_records;
CREATE POLICY "Users can insert own kyc record" 
ON public.kyc_records FOR INSERT 
WITH CHECK (auth.uid() = user_id OR is_kyc_manager());

DROP POLICY IF EXISTS "Users can update own kyc record" ON public.kyc_records;
CREATE POLICY "Users can update own kyc record" 
ON public.kyc_records FOR UPDATE 
USING (auth.uid() = user_id OR is_kyc_manager());

DROP POLICY IF EXISTS "Managers can delete kyc records" ON public.kyc_records;
CREATE POLICY "Managers can delete kyc records" 
ON public.kyc_records FOR DELETE 
USING (is_kyc_manager());

-- RLS: kyc_notes
DROP POLICY IF EXISTS "Users can view notes for their kyc" ON public.kyc_notes;
CREATE POLICY "Users can view notes for their kyc" 
ON public.kyc_notes FOR SELECT 
USING (auth.uid() = user_id OR is_kyc_manager());

DROP POLICY IF EXISTS "Managers can insert kyc notes" ON public.kyc_notes;
CREATE POLICY "Managers can insert kyc notes" 
ON public.kyc_notes FOR INSERT 
WITH CHECK (is_kyc_manager());

-- RLS: general_notifications
DROP POLICY IF EXISTS "Everyone can view active general notifications" ON public.general_notifications;
CREATE POLICY "Everyone can view active general notifications" 
ON public.general_notifications FOR SELECT 
USING (TRUE);

DROP POLICY IF EXISTS "Managers can insert general notifications" ON public.general_notifications;
CREATE POLICY "Managers can insert general notifications" 
ON public.general_notifications FOR INSERT 
WITH CHECK (is_kyc_manager());

DROP POLICY IF EXISTS "Managers can update general notifications" ON public.general_notifications;
CREATE POLICY "Managers can update general notifications" 
ON public.general_notifications FOR UPDATE 
USING (is_kyc_manager());

DROP POLICY IF EXISTS "Managers can delete general notifications" ON public.general_notifications;
CREATE POLICY "Managers can delete general notifications" 
ON public.general_notifications FOR DELETE 
USING (is_kyc_manager());

-- RLS: user_notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
CREATE POLICY "Users can view own notifications" 
ON public.user_notifications FOR SELECT 
USING (auth.uid() = user_id OR is_kyc_manager());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.user_notifications;
CREATE POLICY "Users can update own notifications" 
ON public.user_notifications FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.user_notifications;
CREATE POLICY "System can insert notifications" 
ON public.user_notifications FOR INSERT 
WITH CHECK (TRUE);

-- RLS: support_tickets
DROP POLICY IF EXISTS "Users can view own support tickets" ON public.support_tickets;
CREATE POLICY "Users can view own support tickets" 
ON public.support_tickets FOR SELECT 
USING (auth.uid() = user_id OR is_kyc_manager());

DROP POLICY IF EXISTS "Authenticated users can create support tickets" ON public.support_tickets;
CREATE POLICY "Authenticated users can create support tickets" 
ON public.support_tickets FOR INSERT 
WITH CHECK (TRUE);

-- RLS: storage.objects for aadhaar_documents
DROP POLICY IF EXISTS "Users can upload own aadhaar document" ON storage.objects;
CREATE POLICY "Users can upload own aadhaar document"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'aadhaar_documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view own aadhaar document or managers view all" ON storage.objects;
CREATE POLICY "Users can view own aadhaar document or managers view all"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'aadhaar_documents' 
    AND ((storage.foldername(name))[1] = auth.uid()::text OR is_kyc_manager())
);

DROP POLICY IF EXISTS "Users can delete own aadhaar document or managers delete all" ON storage.objects;
CREATE POLICY "Users can delete own aadhaar document or managers delete all"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'aadhaar_documents' 
    AND ((storage.foldername(name))[1] = auth.uid()::text OR is_kyc_manager())
);
