// Notifications Utility & Database Helpers
import { supabase } from '../lib/supabaseClient';

import { 
  sendPaymentReceivedEmail, 
  sendInvoiceCancelledEmail, 
  sendInvoiceRejectedEmail,
  sendPaymentReminderEmail,
  isUserEmailNotificationsEnabled
} from './emailService';

// Helper function to dispatch a toast event
export const showToast = (
  message: string, 
  type: 'default' | 'error' | 'success' | 'red' = 'default', 
  shake: boolean = false
) => {
  const detail = (type === 'default' && !shake) ? message : { message, type, shake };
  const event = new CustomEvent('show-toast', { detail });
  window.dispatchEvent(event);
};

export interface EmailParams {
  toUserId?: string;
  toEmail?: string;
  invoiceNo: string;
  status: string;
  invoiceId: string;
  amount?: number | string;
  clientName?: string;
  dueDate?: string;
  reason?: string;
}

// Unified sender for invoice emails on status updates
export const sendInvoiceEmail = async (params: EmailParams): Promise<boolean> => {
  try {
    // 0. Check if target user has opted out of email notifications
    if (params.toUserId && !isUserEmailNotificationsEnabled(params.toUserId)) {
      console.log(`[Notifications] Skipping invoice email: user ${params.toUserId} disabled email notifications.`);
      return true;
    }

    let recipientEmail = params.toEmail;
    let recipientName = params.clientName || 'Valued Client';
    let invoiceAmount = params.amount;
    let invoiceDueDate = params.dueDate;

    // 1. If toEmail not provided, query user_roles
    if (!recipientEmail && params.toUserId) {
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('email, name')
        .eq('id', params.toUserId)
        .maybeSingle();

      if (userRole?.email) {
        recipientEmail = userRole.email;
        if (userRole.name) recipientName = userRole.name;
      }
    }

    // 2. Fetch invoice metadata if fields are missing or email still empty
    if (!invoiceAmount || !recipientEmail || !invoiceDueDate) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('amount, client_name, due_date, invoice_data')
        .eq('id', params.invoiceId)
        .maybeSingle();

      if (inv) {
        if (!invoiceAmount && inv.amount) invoiceAmount = inv.amount;
        if (!invoiceDueDate && inv.due_date) invoiceDueDate = inv.due_date;
        if (!recipientName && inv.client_name) recipientName = inv.client_name;
        if (!recipientEmail && inv.invoice_data?.clientEmail) {
          recipientEmail = inv.invoice_data.clientEmail;
        }
      }
    }

    if (!recipientEmail) {
      console.warn('[Notifications] No recipient email found for invoice:', params.invoiceNo);
      return false;
    }

    const normStatus = params.status?.toLowerCase() || '';

    if (normStatus === 'paid') {
      await sendPaymentReceivedEmail({
        to: recipientEmail,
        userName: recipientName,
        invoiceNumber: params.invoiceNo,
        amount: invoiceAmount || 0
      });
    } else if (normStatus === 'rejected') {
      await sendInvoiceRejectedEmail({
        to: recipientEmail,
        userName: recipientName,
        invoiceNumber: params.invoiceNo,
        reason: params.reason
      });
    } else if (normStatus === 'pending') {
      await sendPaymentReminderEmail({
        to: recipientEmail,
        clientName: recipientName,
        invoiceNumber: params.invoiceNo,
        amount: invoiceAmount || 0,
        dueDate: invoiceDueDate || 'Upon Receipt'
      });
    }

    return true;
  } catch (err: any) {
    console.warn('[Notifications] Error sending invoice email:', err.message || err);
    return false;
  }
};

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface GeneralNotification {
  id: string;
  title: string;
  message: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  start_at: string;
  end_at: string;
  created_by?: string;
  created_at?: string;
}

/**
 * Create a user-scoped notification in user_notifications table
 */
export async function createUserNotification(params: {
  userId: string;
  title: string;
  message: string;
  type?: string;
}) {
  try {
    const { error } = await supabase.from('user_notifications').insert({
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type || 'info',
      is_read: false
    });
    if (error) throw error;
    // Dispatch event so active header dropdown updates immediately
    window.dispatchEvent(new CustomEvent('new-notification', { detail: params }));
  } catch (err) {
    console.warn('[Notifications] Could not save user notification to DB:', err);
  }
}

/**
 * Fetch all user notifications for the logged in user
 */
export async function fetchUserNotifications(userId: string): Promise<UserNotification[]> {
  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Notifications] Error fetching user notifications:', err);
    return [];
  }
}

/**
 * Clear or mark all user notifications as read
 */
export async function clearUserNotifications(userId: string) {
  try {
    await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[Notifications] Error clearing notifications:', err);
  }
}

/**
 * Fetch currently active general notifications for the Dashboard
 * Condition: now >= start_at and now <= end_at
 */
export async function fetchActiveGeneralNotifications(): Promise<GeneralNotification[]> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('general_notifications')
      .select('*')
      .lte('start_at', nowIso)
      .gte('end_at', nowIso)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Notifications] Error fetching active general notifications:', err);
    return [];
  }
}

/**
 * Fetch all general notifications (Admin list view)
 */
export async function fetchAllGeneralNotifications(): Promise<GeneralNotification[]> {
  try {
    const { data, error } = await supabase
      .from('general_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Notifications] Error fetching all general notifications:', err);
    return [];
  }
}

/**
 * Admin: Create a general notification banner
 */
export async function createGeneralNotification(params: {
  title: string;
  message: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string;   // YYYY-MM-DD
  endTime: string;   // HH:mm
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const startAt = new Date(`${params.startDate}T${params.startTime}`).toISOString();
    const endAt = new Date(`${params.endDate}T${params.endTime}`).toISOString();

    const { error } = await supabase.from('general_notifications').insert({
      title: params.title,
      message: params.message,
      start_date: params.startDate,
      start_time: params.startTime,
      end_date: params.endDate,
      end_time: params.endTime,
      start_at: startAt,
      end_at: endAt,
      created_by: user?.id
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[Notifications] Error creating general notification:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Update or extend a general notification
 */
export async function updateGeneralNotification(id: string, params: {
  title?: string;
  message?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  startAt?: string;
  endAt?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: any = {};
    if (params.title !== undefined) updates.title = params.title;
    if (params.message !== undefined) updates.message = params.message;
    if (params.startDate !== undefined) updates.start_date = params.startDate;
    if (params.startTime !== undefined) updates.start_time = params.startTime;
    if (params.endDate !== undefined) updates.end_date = params.endDate;
    if (params.endTime !== undefined) updates.end_time = params.endTime;

    if (params.startDate && params.startTime) {
      updates.start_at = new Date(`${params.startDate}T${params.startTime}`).toISOString();
    } else if (params.startAt) {
      updates.start_at = params.startAt;
    }

    if (params.endDate && params.endTime) {
      updates.end_at = new Date(`${params.endDate}T${params.endTime}`).toISOString();
    } else if (params.endAt) {
      updates.end_at = params.endAt;
    }

    const { error } = await supabase
      .from('general_notifications')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[Notifications] Error updating general notification:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Delete a general notification
 */
export async function deleteGeneralNotification(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('general_notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
