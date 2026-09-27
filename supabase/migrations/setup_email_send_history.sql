-- Table for storing email send history metadata (NO binary attachments stored)
CREATE TABLE IF NOT EXISTS public.email_send_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resend_id TEXT,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_snippet TEXT,
    sender_email TEXT,
    sender_name TEXT,
    attachment_count INT DEFAULT 0,
    attachment_names TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_send_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full read/insert/update
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_send_history' AND policyname = 'Allow authenticated read email_send_history'
    ) THEN
        CREATE POLICY "Allow authenticated read email_send_history" 
            ON public.email_send_history FOR SELECT 
            TO authenticated 
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_send_history' AND policyname = 'Allow authenticated insert email_send_history'
    ) THEN
        CREATE POLICY "Allow authenticated insert email_send_history" 
            ON public.email_send_history FOR INSERT 
            TO authenticated 
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_send_history' AND policyname = 'Allow authenticated update email_send_history'
    ) THEN
        CREATE POLICY "Allow authenticated update email_send_history" 
            ON public.email_send_history FOR UPDATE 
            TO authenticated 
            USING (true);
    END IF;
END
$$;
