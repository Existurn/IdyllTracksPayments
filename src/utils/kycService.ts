// KYC Service Layer
// Manages KYC records, secure document uploads to private bucket,
// Aadhaar masking, signed URL generation, notes, and admin workflows.

import { supabase } from '../lib/supabaseClient';
import { 
  sendKycRequestedEmail, 
  sendKycSubmittedEmail, 
  sendKycUnderReviewEmail,
  sendKycVerificationInProgressEmail,
  sendKycVerifiedEmail, 
  sendKycRejectedEmail, 
  sendKycActionRequiredEmail, 
  sendKycResubmissionRequiredEmail,
  sendKycAdminAlertEmail 
} from './emailService';
import { createUserNotification } from './notifications';

export type KycStatus = 
  | 'Not Requested'
  | 'Requested'
  | 'Submitted'
  | 'Under Review'
  | 'Verification in Progress'
  | 'Verified'
  | 'Action Required'
  | 'Resubmission Required'
  | 'Rejected';

export interface KycRecord {
  id: string;
  user_id: string;
  account_holder_name: string;
  legal_name?: string;
  aadhar_number?: string;
  dob?: string;
  address?: string;
  document_url?: string;
  document_name?: string;
  document_type?: string;
  document_size?: number;
  status: KycStatus;
  is_manual_override: boolean;
  requested_at?: string;
  requested_by?: string;
  submitted_at?: string;
  status_updated_at?: string;
  created_at?: string;
  updated_at?: string;
  user_role?: string;
}

export interface KycNote {
  id: string;
  kyc_id?: string;
  user_id: string;
  status_context: string;
  note: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

/**
 * Aadhaar Number Masking
 * Formats 12-digit Aadhaar number as: •••• •••• 1234
 * Strictly prevents full exposure in tables, preview, logs, or notifications.
 */
export function maskAadhaar(aadhaar?: string): string {
  if (!aadhaar) return '•••• •••• ••••';
  const clean = aadhaar.replace(/\D/g, '');
  if (clean.length === 12) {
    return `•••• •••• ${clean.slice(8)}`;
  }
  if (clean.length > 4) {
    return `•••• •••• ${clean.slice(-4)}`;
  }
  return '•••• •••• ••••';
}

/**
 * Evaluates the authoritative effective status based on elapsed server time.
 * Progression: Submitted -> (1 hr) -> Under Review -> (1 hr) -> Verification in Progress.
 * Permanently locks if is_manual_override is true.
 */
export function getEffectiveKycStatus(record: KycRecord): KycStatus {
  if (record.is_manual_override) {
    return record.status;
  }

  // Only auto-advance in-progress statuses
  if (!['Submitted', 'Under Review', 'Verification in Progress'].includes(record.status)) {
    return record.status;
  }

  if (!record.submitted_at) {
    return record.status;
  }

  const submittedTime = new Date(record.submitted_at).getTime();
  const elapsedMs = Date.now() - submittedTime;
  const ONE_HOUR = 60 * 60 * 1000;
  const TWO_HOURS = 2 * ONE_HOUR;

  if (elapsedMs >= TWO_HOURS) {
    return 'Verification in Progress';
  } else if (elapsedMs >= ONE_HOUR) {
    return 'Under Review';
  }
  return 'Submitted';
}

/**
 * Fetch the active user's KYC record & latest active note.
 */
export async function fetchUserKyc(userId: string): Promise<{
  record: KycRecord | null;
  latestNote: KycNote | null;
  error?: string;
}> {
  try {
    const { data: recordData, error: recordError } = await supabase
      .from('kyc_records')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (recordError) {
      console.warn('[KYC] Error fetching user KYC record:', recordError.message);
      return { record: null, latestNote: null, error: recordError.message };
    }

    if (!recordData) {
      return { record: null, latestNote: null };
    }

    // Evaluate effective status
    const effectiveStatus = getEffectiveKycStatus(recordData);
    if (effectiveStatus !== recordData.status && !recordData.is_manual_override) {
      // Sync DB silently in background
      supabase
        .from('kyc_records')
        .update({ status: effectiveStatus, status_updated_at: new Date().toISOString() })
        .eq('id', recordData.id)
        .then();
      recordData.status = effectiveStatus;
    }

    // Fetch latest active note for this user
    const { data: noteData } = await supabase
      .from('kyc_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      record: recordData,
      latestNote: noteData || null
    };
  } catch (err: any) {
    return { record: null, latestNote: null, error: err.message };
  }
}

/**
 * Fetch all internal notes for a user's KYC record (Admin view).
 */
export async function fetchUserNotes(userId: string): Promise<KycNote[]> {
  try {
    const { data, error } = await supabase
      .from('kyc_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[KYC] Error fetching notes:', err);
    return [];
  }
}

/**
 * Upload Aadhaar document to private storage bucket 'aadhaar_documents'
 */
export async function uploadAadhaarDocument(userId: string, file: File): Promise<{
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const cleanBaseName = file.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = `${userId}/${Date.now()}_${cleanBaseName}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('aadhaar_documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  return {
    filePath,
    fileName: file.name,
    fileType: file.type || `application/${fileExt}`,
    fileSize: file.size
  };
}

/**
 * Generate short-lived signed URL for viewing/downloading Aadhaar document
 */
export async function getSignedDocumentUrl(filePath: string, expiresIn = 300): Promise<{ signedUrl?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('aadhaar_documents')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      return { error: error.message };
    }
    return { signedUrl: data?.signedUrl };
  } catch (err: any) {
    return { error: err.message || 'Failed to create signed URL' };
  }
}

/**
 * User submits or resubmits KYC details.
 * Starts a fresh verification cycle: Submitted -> (1 hr) -> Under Review -> (1 hr) -> Verification in Progress.
 */
export async function submitUserKyc(
  userId: string,
  formData: {
    accountHolderName: string;
    legalName?: string;
    aadharNumber: string;
    dob: string;
    address: string;
  },
  file?: File,
  existingDocument?: { url: string; name: string; type: string; size: number }
): Promise<{ success: boolean; record?: KycRecord; error?: string }> {
  try {
    let documentDetails = existingDocument ? {
      document_url: existingDocument.url,
      document_name: existingDocument.name,
      document_type: existingDocument.type,
      document_size: existingDocument.size
    } : null;

    if (file) {
      const uploaded = await uploadAadhaarDocument(userId, file);
      documentDetails = {
        document_url: uploaded.filePath,
        document_name: uploaded.fileName,
        document_type: uploaded.fileType,
        document_size: uploaded.fileSize
      };
    }

    if (!documentDetails) {
      return { success: false, error: 'Aadhaar document copy is required.' };
    }

    const now = new Date().toISOString();

    const payload = {
      user_id: userId,
      account_holder_name: formData.accountHolderName,
      legal_name: formData.legalName || formData.accountHolderName,
      aadhar_number: formData.aadharNumber.replace(/\D/g, ''),
      dob: formData.dob,
      address: formData.address,
      ...documentDetails,
      status: 'Submitted' as KycStatus,
      is_manual_override: false, // Reset override on fresh submission
      submitted_at: now,
      status_updated_at: now,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('kyc_records')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Record in KYC History
    await supabase.from('kyc_history').insert({
      user_id: userId,
      account_holder_name: formData.accountHolderName,
      aadhar_number_masked: maskAadhaar(formData.aadharNumber),
      document_name: documentDetails.document_name,
      previous_status: 'None',
      new_status: 'Submitted',
      action: 'USER_SUBMITTED',
      action_by: userId,
      note: 'User submitted KYC details and Aadhaar card document'
    });

    // Create user dashboard notification
    await createUserNotification({
      userId,
      title: 'KYC Information Submitted',
      message: 'Your identity verification documents have been received and queued for review.',
      type: 'kyc_submitted'
    });

    // Send email notification to user & admin alert
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.email) {
      sendKycSubmittedEmail({
        to: userData.user.email,
        userName: formData.accountHolderName
      }).catch(err => console.warn('[KYC] Email dispatch error:', err));

      sendKycAdminAlertEmail({
        userName: formData.accountHolderName || userData.user.email.split('@')[0],
        userEmail: userData.user.email
      }).catch(err => console.warn('[KYC] Admin alert error:', err));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kyc-status-updated', { detail: { userId, status: 'Submitted' } }));
    }

    return { success: true, record: data };
  } catch (err: any) {
    console.error('[KYC] Error submitting KYC:', err);
    return { success: false, error: err.message || 'Submission failed' };
  }
}

/**
 * Admin: Fetch all KYC records with user details.
 * Fetches all registered workspace users from user_roles and merges with kyc_records.
 * Users without a KYC record are represented with status 'Not Requested', guaranteeing
 * that all users in the workspace appear across KYC Management sections.
 */
export async function fetchAllKycRecords(): Promise<{
  records: (KycRecord & { user_name?: string; user_email?: string; user_role?: string; latest_note?: string })[];
  error?: string;
}> {
  try {
    // 1. Fetch User Roles first (source of truth for all users in workspace)
    const { data: usersData, error: usersError } = await supabase
      .from('user_roles')
      .select('*')
      .order('name', { ascending: true });

    if (usersError) {
      console.warn('[KYC] Error fetching user_roles:', usersError.message);
    }

    // 2. Fetch KYC records
    const { data: kycData, error: kycError } = await supabase
      .from('kyc_records')
      .select('*')
      .order('updated_at', { ascending: false });

    if (kycError) {
      console.warn('[KYC] Error fetching kyc_records:', kycError.message);
    }

    // 3. Fetch latest notes
    const { data: notesData } = await supabase
      .from('kyc_notes')
      .select('user_id, note, created_at')
      .order('created_at', { ascending: false });

    const noteMap = new Map<string, string>();
    if (notesData) {
      notesData.forEach(n => {
        if (!noteMap.has(n.user_id)) {
          noteMap.set(n.user_id, n.note);
        }
      });
    }

    // Map existing KYC records by user_id
    const kycMap = new Map<string, KycRecord>();
    if (kycData) {
      kycData.forEach(r => kycMap.set(r.user_id, r));
    }

    const records: (KycRecord & { user_name?: string; user_email?: string; user_role?: string; latest_note?: string })[] = [];
    const processedUserIds = new Set<string>();

    // Merge registered workspace users
    if (usersData && usersData.length > 0) {
      usersData.forEach(u => {
        processedUserIds.add(u.id);
        const kycRecord = kycMap.get(u.id);
        if (kycRecord) {
          const effectiveStatus = getEffectiveKycStatus(kycRecord);
          records.push({
            ...kycRecord,
            status: effectiveStatus,
            user_name: u.name || kycRecord.account_holder_name || 'User',
            user_email: u.email || '',
            user_role: u.role || 'Client',
            latest_note: noteMap.get(u.id) || ''
          });
        } else {
          // User exists, but has not yet submitted or been requested for KYC
          records.push({
            id: `not_requested_${u.id}`,
            user_id: u.id,
            account_holder_name: u.name || 'Account Holder',
            legal_name: u.name || 'Account Holder',
            status: 'Not Requested',
            is_manual_override: false,
            user_name: u.name,
            user_email: u.email || '',
            user_role: u.role || 'Client',
            latest_note: noteMap.get(u.id) || '',
            created_at: u.request_date || u.created_at
          });
        }
      });
    }

    // Also include any orphan kyc_records (if user_id not found in user_roles)
    if (kycData) {
      kycData.forEach(r => {
        if (!processedUserIds.has(r.user_id)) {
          const effectiveStatus = getEffectiveKycStatus(r);
          records.push({
            ...r,
            status: effectiveStatus,
            user_name: r.account_holder_name || 'Account Holder',
            user_email: '',
            user_role: 'User',
            latest_note: noteMap.get(r.user_id) || ''
          });
        }
      });
    }

    return { records };
  } catch (err: any) {
    console.error('[KYC] Error fetching all KYC records:', err);
    return { records: [], error: err.message };
  }
}

/**
 * Admin: Send KYC Verification Request to a User
 */
export async function sendKycRequest(
  targetUserId: string,
  targetUserName?: string,
  targetUserEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Check if target user details need to be fetched from user_roles
    let name = targetUserName;
    let email = targetUserEmail;
    if (!name || !email) {
      const { data: uData } = await supabase
        .from('user_roles')
        .select('name, email')
        .eq('id', targetUserId)
        .maybeSingle();
      if (uData) {
        name = name || uData.name || 'Account Holder';
        email = email || uData.email || '';
      }
    }
    const finalName = name || 'Account Holder';
    const finalEmail = email || '';

    // Check if user already has an active KYC record in progress
    const { data: existing } = await supabase
      .from('kyc_records')
      .select('id, status')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (existing && !['Rejected', 'Requested', 'Not Requested'].includes(existing.status)) {
      return { success: false, error: 'User already has an active KYC process.' };
    }

    const now = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from('kyc_records')
      .upsert({
        user_id: targetUserId,
        account_holder_name: finalName,
        status: 'Requested',
        is_manual_override: true,
        requested_at: now,
        requested_by: user?.id,
        status_updated_at: now,
        updated_at: now
      }, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    // Log to KYC History
    await supabase.from('kyc_history').insert({
      user_id: targetUserId,
      account_holder_name: finalName,
      previous_status: existing?.status || 'Not Requested',
      new_status: 'Requested',
      action: 'ADMIN_REQUESTED_KYC',
      action_by: user?.id,
      note: 'Admin initiated identity verification request'
    });

    // Send user notification
    await createUserNotification({
      userId: targetUserId,
      title: 'KYC Verification Required',
      message: 'Please complete your identity verification to continue creating invoices.',
      type: 'kyc_requested'
    });

    // Send Email
    if (finalEmail) {
      sendKycRequestedEmail({
        to: finalEmail,
        userName: finalName
      }).catch(e => console.warn('[KYC] Email error:', e));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kyc-status-updated', { detail: { userId: targetUserId, status: 'Requested' } }));
    }

    return { success: true };
  } catch (err: any) {
    console.error('[KYC] Error sending KYC request:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Cancel an active/pending KYC verification request.
 * Removes the KYC record (so the user reverts to 'Not Requested'),
 * cleans up the user's dashboard notification and banner, logs to history,
 * and emits 'kyc-status-updated' so all views update in real time.
 */
export async function cancelKycRequest(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch current record
    const { data: existing } = await supabase
      .from('kyc_records')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    const previousStatus = existing?.status || 'Requested';
    const accountHolderName = existing?.account_holder_name || 'Account Holder';

    // 2. Delete the record from kyc_records
    const { error: delError } = await supabase
      .from('kyc_records')
      .delete()
      .eq('user_id', targetUserId);

    if (delError) {
      console.warn('[KYC] Error deleting kyc_record on cancel:', delError.message);
      return { success: false, error: delError.message };
    }

    // 3. Clear user notifications about KYC request
    await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', targetUserId)
      .in('type', ['kyc_requested', 'kyc_action_required', 'kyc_resubmission_required']);

    // 4. Log to KYC History
    await supabase.from('kyc_history').insert({
      user_id: targetUserId,
      account_holder_name: accountHolderName,
      previous_status: previousStatus,
      new_status: 'Not Requested',
      action: 'ADMIN_CANCELLED_KYC_REQUEST',
      action_by: user?.id,
      note: 'Admin cancelled the pending identity verification request. Account restored to normal (Not Requested).'
    });

    // 5. Notify listeners across the application
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kyc-status-updated', { 
        detail: { userId: targetUserId, status: 'Not Requested' } 
      }));
    }

    return { success: true };
  } catch (err: any) {
    console.error('[KYC] Error cancelling KYC request:', err);
    return { success: false, error: err.message || 'Failed to cancel KYC request' };
  }
}

/**
 * Admin: Update KYC status manually with optional reason note.
 * Permanently locks out automated status progression for this cycle (is_manual_override = true).
 */
export async function updateKycStatus(
  userId: string,
  newStatus: KycStatus,
  noteText?: string,
  adminName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch current record
    const { data: currentRecord } = await supabase
      .from('kyc_records')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!currentRecord) {
      return { success: false, error: 'Record not found.' };
    }

    const previousStatus = currentRecord.status;
    const now = new Date().toISOString();

    // 2. Update status and set is_manual_override = true
    const { error: updateError } = await supabase
      .from('kyc_records')
      .update({
        status: newStatus,
        is_manual_override: true,
        status_updated_at: now,
        updated_at: now
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // 3. Save note if provided
    if (noteText && noteText.trim()) {
      await supabase.from('kyc_notes').insert({
        kyc_id: currentRecord.id,
        user_id: userId,
        status_context: newStatus,
        note: noteText.trim(),
        created_by: user?.id,
        created_by_name: adminName || 'Compliance Admin'
      });
    }

    // 4. Log to KYC History
    await supabase.from('kyc_history').insert({
      user_id: userId,
      account_holder_name: currentRecord.account_holder_name,
      aadhar_number_masked: maskAadhaar(currentRecord.aadhar_number),
      document_name: currentRecord.document_name,
      previous_status: previousStatus,
      new_status: newStatus,
      action: 'ADMIN_MANUAL_STATUS_OVERRIDE',
      action_by: user?.id,
      action_by_name: adminName,
      note: noteText || `Admin manually changed status from ${previousStatus} to ${newStatus}`
    });

    // 5. Fetch target user's email from user_roles
    const { data: targetUserData } = await supabase
      .from('user_roles')
      .select('email, name')
      .eq('id', userId)
      .maybeSingle();

    const targetEmail = targetUserData?.email;
    const userName = targetUserData?.name || currentRecord.account_holder_name || 'User';

    // 6. Create User Dashboard Notification
    let notifTitle = 'KYC Status Updated';
    let notifMessage = `Your identity verification status has been updated to ${newStatus}.`;

    if (newStatus === 'Verified') {
      notifTitle = 'KYC Verification Approved';
      notifMessage = 'Your identity verification has been verified successfully. Invoice creation is now unlocked.';
    } else if (newStatus === 'Rejected') {
      notifTitle = 'KYC Verification Rejected';
      notifMessage = noteText ? `Your KYC verification was rejected: ${noteText}` : 'Your KYC verification was rejected. Please review and resubmit.';
    } else if (newStatus === 'Action Required') {
      notifTitle = 'Action Required on KYC';
      notifMessage = noteText || 'Please review your identity verification details.';
    } else if (newStatus === 'Resubmission Required') {
      notifTitle = 'KYC Resubmission Required';
      notifMessage = noteText || 'Please upload a clearer copy of your Aadhaar document.';
    }

    await createUserNotification({
      userId,
      title: notifTitle,
      message: notifMessage,
      type: `kyc_${newStatus.toLowerCase().replace(/\s+/g, '_')}`
    });

    // 7. Dispatch Email
    if (targetEmail) {
      if (newStatus === 'Verified') {
        sendKycVerifiedEmail({ to: targetEmail, userName });
      } else if (newStatus === 'Rejected') {
        sendKycRejectedEmail({ to: targetEmail, userName, reason: noteText });
      } else if (newStatus === 'Action Required') {
        sendKycActionRequiredEmail({ to: targetEmail, userName, reason: noteText });
      } else if (newStatus === 'Resubmission Required') {
        sendKycResubmissionRequiredEmail({ to: targetEmail, userName, reason: noteText });
      } else if (newStatus === 'Under Review') {
        sendKycUnderReviewEmail({ to: targetEmail, userName });
      } else if (newStatus === 'Verification in Progress') {
        sendKycVerificationInProgressEmail({ to: targetEmail, userName });
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kyc-status-updated', { detail: { userId, status: newStatus } }));
    }

    return { success: true };
  } catch (err: any) {
    console.error('[KYC] Error updating KYC status:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Delete KYC Submission (Full Reset)
 * Removes active KYC record & document from storage.
 * Locks user from resubmitting until new KYC request is sent.
 */
export async function deleteUserKyc(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Attempt deletion via RPC first
    const { error: rpcError } = await supabase.rpc('delete_user_kyc', {
      target_user_id: targetUserId
    });

    if (rpcError) {
      console.warn('[KYC] RPC delete failed, falling back to direct delete:', rpcError.message);

      // Fetch existing record to delete document
      const { data: existing } = await supabase
        .from('kyc_records')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (existing) {
        // Delete documents from bucket
        if (existing.document_url) {
          await supabase.storage.from('aadhaar_documents').remove([existing.document_url]);
        }

        // Delete active record
        await supabase.from('kyc_records').delete().eq('user_id', targetUserId);

        // Record history
        await supabase.from('kyc_history').insert({
          user_id: targetUserId,
          account_holder_name: existing.account_holder_name,
          document_name: existing.document_name,
          previous_status: existing.status,
          new_status: 'Deleted/Reset',
          action: 'KYC_DELETED',
          note: 'Active KYC record and uploaded document deleted by admin'
        });

        // Notify user
        await createUserNotification({
          userId: targetUserId,
          title: 'KYC Record Reset',
          message: 'Your previous KYC verification record has been reset. You will need a new verification request before submitting again.',
          type: 'kyc_reset'
        });
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kyc-status-updated', { detail: { userId: targetUserId, status: 'Deleted/Reset' } }));
    }

    return { success: true };
  } catch (err: any) {
    console.error('[KYC] Error deleting user KYC:', err);
    return { success: false, error: err.message };
  }
}
