import { supabase } from '../lib/supabaseClient';

export const logAction = async (action: string, details?: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_logs').insert([{
      action,
      details,
      performed_by: user.id,
      performed_by_email: user.email,
    }]);
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
};
