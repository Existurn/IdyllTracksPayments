// Unified Email Service Layer
// Dispatches emails via Resend with the custom Idyll Productions template and hosted logo.

import { supabase } from '../lib/supabaseClient';

const RESEND_API_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RESEND_API_KEY) || 
  '';

const DEFAULT_FROM = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RESEND_FROM_EMAIL) || 
  'Idyll Tracks Payments <billing@idylltrackspayments.online>';
const APP_BASE_URL = 'https://www.idylltrackspayments.online';
const LOGO_URL = 'https://www.idylltrackspayments.online/itp-logo-black.png';

export type EmailEventType = 
  | 'kyc_requested'
  | 'kyc_submitted'
  | 'kyc_under_review'
  | 'kyc_verification_in_progress'
  | 'kyc_verified'
  | 'kyc_rejected'
  | 'kyc_action_required'
  | 'kyc_resubmission_required'
  | 'kyc_resubmitted'
  | 'invoice_created'
  | 'invoice_submitted_user'
  | 'payment_received'
  | 'payment_reminder'
  | 'invoice_cancelled'
  | 'invoice_rejected'
  | 'invoice_submitted_admin'
  | 'kyc_submitted_admin'
  | 'account_approved'
  | 'role_updated'
  | 'support_ticket_admin'
  | 'support_ticket_confirmation'
  | 'generic';

export interface EmailDispatchPayload {
  to: string | string[];
  subject: string;
  eventType: EmailEventType;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string }>;
  data?: {
    userName?: string;
    clientName?: string;
    invoiceNumber?: string;
    amount?: number | string;
    dueDate?: string;
    paymentDate?: string;
    paymentMethod?: string;
    newRole?: string;
    reason?: string;
    message?: string;
    actionUrl?: string;
    buttonText?: string;
    [key: string]: any;
  };
  customHtml?: string;
}

/**
 * Builds the HTML body following the official Idyll Productions email template.
 */
export function renderIdyllEmailHtml(payload: EmailDispatchPayload): string {
  if (payload.customHtml) {
    return payload.customHtml;
  }

  const { eventType, data = {} } = payload;
  const userName = data.userName || data.clientName || 'there';
  const actionUrl = data.actionUrl || (typeof window !== 'undefined' ? window.location.origin : APP_BASE_URL);
  
  let paragraphs: string[] = [];
  let metadataBox = '';
  let buttonText = data.buttonText || 'Open Dashboard';
  let buttonUrl = actionUrl;

  switch (eventType) {
    case 'kyc_requested':
      paragraphs = [
        "The finance team has requested identity verification (KYC) for your account.",
        "To ensure seamless invoice creation and uninterrupted payment processing, please complete your identity verification by uploading a clear copy of your Aadhaar card.",
        "Verification is a quick, one-time security process."
      ];
      buttonText = 'Complete KYC Verification';
      break;

    case 'kyc_submitted':
    case 'kyc_resubmitted':
      paragraphs = [
        "Thank you for submitting your identity verification documents.",
        "Your details and Aadhaar card document have been received and placed into our review queue.",
        "Verification typically takes 1 to 2 business days. We will notify you as soon as review begins."
      ];
      buttonText = 'Check Verification Status';
      break;

    case 'kyc_under_review':
      paragraphs = [
        "Your identity verification submission is now under active review.",
        "Our compliance team is verifying your submitted documents against registered identity records.",
        "No further action is required from you at this time."
      ];
      buttonText = 'View Status';
      break;

    case 'kyc_verification_in_progress':
      paragraphs = [
        "Your identity verification has progressed to the final verification stage.",
        "An authorized compliance officer is finalizing the sign-off for your profile.",
        "You will receive a confirmation once verification is approved."
      ];
      buttonText = 'View KYC Details';
      break;

    case 'kyc_verified':
      paragraphs = [
        "Great news! Your identity verification (KYC) has been reviewed and approved.",
        "Invoice creation and billing features are now fully unlocked for your account.",
        "You can now create, send, and process invoices without restriction."
      ];
      buttonText = 'Go to Invoices';
      break;

    case 'kyc_rejected':
      paragraphs = [
        "Your recent identity verification submission could not be approved.",
        "Please review the finance team's reason below and submit an updated document with the corrected information."
      ];
      if (data.reason) {
        metadataBox = `
          <div style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 6px; padding: 14px 16px; margin: 24px 0; color: #991B1B; font-size: 14px; line-height: 1.5;">
            <strong>Reason for Rejection:</strong><br>${data.reason}
          </div>
        `;
      }
      buttonText = 'Resubmit KYC';
      break;

    case 'kyc_action_required':
      paragraphs = [
        "Action is required on your identity verification submission.",
        "Please review the notice below and update your submission."
      ];
      if (data.reason) {
        metadataBox = `
          <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 14px 16px; margin: 24px 0; color: #92400E; font-size: 14px; line-height: 1.5;">
            <strong>Action Item:</strong><br>${data.reason}
          </div>
        `;
      }
      buttonText = 'Review & Update KYC';
      break;

    case 'kyc_resubmission_required':
      paragraphs = [
        "A document resubmission is required for your identity verification.",
        "Please upload a clearer, uncropped copy of your Aadhaar card to complete verification."
      ];
      if (data.reason) {
        metadataBox = `
          <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 14px 16px; margin: 24px 0; color: #92400E; font-size: 14px; line-height: 1.5;">
            <strong>Resubmission Note:</strong><br>${data.reason}
          </div>
        `;
      }
      buttonText = 'Upload Document';
      break;

    case 'invoice_created':
      paragraphs = [
        `You have received a new invoice #${data.invoiceNumber || ''} from ${data.creatorName || 'Idyll Productions'}.`,
        "Please find the invoice summary details below. You can view the full breakdown and complete payment securely by clicking the button below."
      ];
      metadataBox = `
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #374151;">
          <div style="margin-bottom: 6px;"><strong>Invoice Number:</strong> #${data.invoiceNumber || 'N/A'}</div>
          <div style="margin-bottom: 6px;"><strong>Amount Due:</strong> ₹${Number(data.amount || 0).toLocaleString('en-IN')}</div>
          <div><strong>Due Date:</strong> ${data.dueDate || 'Upon Receipt'}</div>
        </div>
      `;
      buttonText = 'View & Pay Invoice';
      break;

    case 'invoice_submitted_user':
      paragraphs = [
        `We have successfully received your invoice #${data.invoiceNumber || ''}.`,
        "Your invoice has been received and submitted to the finance team for review.",
        "You can track the verification and payment status anytime directly in your dashboard. We will notify you as soon as payment is processed."
      ];
      metadataBox = `
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #374151;">
          <div style="margin-bottom: 6px;"><strong>Invoice Number:</strong> #${data.invoiceNumber || 'N/A'}</div>
          <div style="margin-bottom: 6px;"><strong>Amount:</strong> ₹${Number(data.amount || 0).toLocaleString('en-IN')}</div>
          <div style="margin-bottom: 6px;"><strong>Billed To:</strong> ${data.clientName || 'Idyll Productions Pvt. Ltd.'}</div>
          <div><strong>Status:</strong> Under Review</div>
        </div>
      `;
      buttonText = 'View Invoice Status';
      buttonUrl = 'https://www.idylltrackspayments.online/payments';
      break;

    case 'payment_received':
      paragraphs = [
        `Payment has been successfully recorded for invoice #${data.invoiceNumber || ''}.`,
        "Thank you for your prompt payment! A copy of this receipt has been saved to your account."
      ];
      metadataBox = `
        <div style="background-color: #F0FDF4; border: 1px solid #DCFCE7; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #166534;">
          <div style="margin-bottom: 6px;"><strong>Amount Paid:</strong> ₹${Number(data.amount || 0).toLocaleString('en-IN')}</div>
          <div style="margin-bottom: 6px;"><strong>Payment Method:</strong> ${data.paymentMethod || 'Online Transfer'}</div>
          <div><strong>Payment Date:</strong> ${data.paymentDate || new Date().toLocaleDateString('en-IN')}</div>
        </div>
      `;
      buttonText = 'View Invoice Details';
      break;

    case 'payment_reminder':
      paragraphs = [
        `This is a friendly reminder that invoice #${data.invoiceNumber || ''} is due on ${data.dueDate || 'soon'}.`,
        "Please ensure payment is completed by the due date to keep services running smoothly."
      ];
      metadataBox = `
        <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #92400E;">
          <div style="margin-bottom: 6px;"><strong>Invoice:</strong> #${data.invoiceNumber || 'N/A'}</div>
          <div style="margin-bottom: 6px;"><strong>Outstanding Balance:</strong> ₹${Number(data.amount || 0).toLocaleString('en-IN')}</div>
          <div><strong>Due Date:</strong> ${data.dueDate || 'Immediate'}</div>
        </div>
      `;
      buttonText = 'Pay Invoice Now';
      break;

    case 'invoice_cancelled':
      paragraphs = [
        `Invoice #${data.invoiceNumber || ''} has been cancelled by the issuer.`,
        "No further payment or action is required for this invoice."
      ];
      buttonText = 'View Invoices';
      break;

    case 'invoice_rejected':
      paragraphs = [
        `Your invoice #${data.invoiceNumber || ''} has been reviewed and marked as Rejected by the finance team.`,
        "Please review the invoice, address any feedback or corrections required, and update or resubmit as needed."
      ];
      if (data.reason) {
        metadataBox = `
          <div style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 6px; padding: 14px 16px; margin: 24px 0; color: #991B1B; font-size: 14px; line-height: 1.5;">
            <strong>Reason:</strong><br>${data.reason}
          </div>
        `;
      }
      buttonText = 'View Invoice Details';
      break;

    case 'invoice_submitted_admin':
      paragraphs = [
        `A new invoice #${data.invoiceNumber || ''} has been submitted for review by ${data.creatorName || 'a team member'}.`,
        "Please review the submitted invoice details in the Admin Panel."
      ];
      metadataBox = `
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #374151;">
          <div style="margin-bottom: 6px;"><strong>Invoice Number:</strong> #${data.invoiceNumber || 'N/A'}</div>
          <div style="margin-bottom: 6px;"><strong>Creator:</strong> ${data.creatorName || 'User'}</div>
          <div style="margin-bottom: 6px;"><strong>Amount:</strong> ₹${Number(data.amount || 0).toLocaleString('en-IN')}</div>
          <div><strong>Client:</strong> ${data.clientName || 'N/A'}</div>
        </div>
      `;
      buttonText = 'Open Admin Panel';
      break;

    case 'kyc_submitted_admin':
      paragraphs = [
        `A new KYC verification request has been submitted by ${data.userName || 'a user'}.`,
        "The submission details and uploaded Aadhaar document are waiting in the review queue."
      ];
      metadataBox = `
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #374151;">
          <div style="margin-bottom: 6px;"><strong>User:</strong> ${data.userName || 'User'}</div>
          <div style="margin-bottom: 6px;"><strong>Email:</strong> ${data.userEmail || 'N/A'}</div>
          <div><strong>Status:</strong> Submitted for Review</div>
        </div>
      `;
      buttonText = 'Review KYC Submission';
      break;

    case 'account_approved':
      paragraphs = [
        "Your account registration has been approved by the finance team!",
        "You now have full access to sign in to your dashboard and manage payments."
      ];
      buttonText = 'Sign In to Dashboard';
      break;

    case 'role_updated':
      paragraphs = [
        `Your workspace role permissions have been updated to ${data.newRole || 'Member'}.`,
        "Your new capabilities are active immediately upon your next sign-in."
      ];
      buttonText = 'Access Workspace';
      break;

    case 'support_ticket_confirmation':
      paragraphs = [
        "We have received your support request.",
        "Our team will review your inquiry and get back to you as soon as possible."
      ];
      if (data.message) {
        metadataBox = `
          <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 14px; line-height: 1.5; color: #4B5563;">
            <strong style="color: #111827;">Your Message:</strong>
            <p style="margin: 8px 0 0 0; font-style: italic; color: #111827;">"${data.message}"</p>
          </div>
        `;
      }
      buttonText = 'Go to Dashboard';
      break;

    case 'support_ticket_admin':
      paragraphs = [
        `A user has submitted a new support request from the Idyll Tracks Payments portal.`,
        "Review the inquiry below and reply directly to this email to contact the user."
      ];
      metadataBox = `
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #374151;">
          <div style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 14px; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px;">User Information</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
              <td style="padding: 6px 0; color: #6B7280; width: 140px; font-weight: 500;">User Name:</td>
              <td style="padding: 6px 0; color: #111827; font-weight: 600;">${data.userName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6B7280; font-weight: 500;">User Email:</td>
              <td style="padding: 6px 0; color: #111827; font-weight: 600;"><a href="mailto:${data.userEmail}" style="color: #2563EB; text-decoration: none;">${data.userEmail || 'N/A'}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6B7280; font-weight: 500;">User Role:</td>
              <td style="padding: 6px 0; color: #111827;">${data.userRole || 'User'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6B7280; font-weight: 500;">Account ID:</td>
              <td style="padding: 6px 0; color: #4B5563; font-family: monospace; font-size: 13px;">${data.accountId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6B7280; font-weight: 500;">Submitted At:</td>
              <td style="padding: 6px 0; color: #4B5563;">${data.date || new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</td>
            </tr>
          </table>
          <div style="border-top: 1px solid #E5E7EB; padding-top: 16px;">
            <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #6B7280; margin-bottom: 8px;">Message / Problem Description:</div>
            <div style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; color: #111827; white-space: pre-wrap; font-size: 14.5px; line-height: 1.6;">${data.message || ''}</div>
          </div>
        </div>
      `;
      buttonText = 'Open Admin Dashboard';
      buttonUrl = (typeof window !== 'undefined' ? window.location.origin : '') + '/dashboard';
      break;

    default:
      paragraphs = [data.message || 'You have an update from Idyll Tracks Payments.'];
      break;
  }

  const paragraphHtml = paragraphs
    .map(p => `<p style="margin-bottom: 24px;">${p}</p>`)
    .join('');

  const greetingRecipient = eventType === 'support_ticket_admin' ? 'Idyll Tracks Team' : userName;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.subject}</title>
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; color: #111827; font-size: 15px; line-height: 1.6;">
    
    <p style="margin-bottom: 24px;">Hi ${greetingRecipient},</p>
    
    ${paragraphHtml}

    ${metadataBox}
    
    <p style="margin-bottom: 32px;">Keep creating amazing things!</p>
    
    <p style="margin-bottom: 32px;">
      Best regards,<br>
      Idyll Productions
    </p>
    
    <div style="margin-bottom: 40px;">
      <a href="${buttonUrl}" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
        ${buttonText}
      </a>
    </div>

    <!-- Centered Logo (Universal Email-Safe Hosted PNG) -->
    <div style="text-align: center; margin-top: 48px; margin-bottom: 16px;">
      <img 
        src="${LOGO_URL}" 
        alt="Idyll Tracks Payments Logo" 
        width="48" 
        height="48" 
        style="display: inline-block; width: 48px; height: 48px; opacity: 0.9; border: 0; outline: none; text-decoration: none;" 
      />
    </div>

    <!-- Small Footer Text -->
    <div style="text-align: center; color: #9ca3af; font-size: 15px; line-height: 1.5;">
      <p style="margin: 4px 0;">Email sent by Idyll Tracks Payments.</p>
      <p style="margin: 4px 0;">Please do not reply to this email, this email is not monitored.</p>
      <p style="margin: 4px 0;">Powered by Idyll Productions.</p>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Helper to check if system emails are globally enabled in Admin Panel Settings.
 * Returns true by default. If toggled off in Admin Panel, returns false.
 */
export function areEmailsEnabled(): boolean {
  try {
    const raw = localStorage.getItem('system_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.emailsEnabled === 'boolean') {
        return parsed.emailsEnabled;
      }
    }
  } catch (_) {}
  return true;
}

/**
 * Universal Email Dispatcher
 * Sends emails via Resend API directly (via dev proxy or direct endpoint)
 * and falls back to Supabase Edge Function 'send-email'.
 */
export async function dispatchEmail(payload: EmailDispatchPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Check if system emails are globally disabled in Admin Panel Settings (Development Mode)
    if (!areEmailsEnabled()) {
      console.warn(`[Email Service] Emails are globally MUTED (Admin Dev Mode). Suppressed '${payload.eventType}' notification to:`, payload.to);
      return { 
        success: true, 
        id: `muted-dev-mode-${Date.now()}` 
      };
    }

    const html = renderIdyllEmailHtml(payload);
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    const filteredRecipients = recipients.filter(Boolean);

    if (filteredRecipients.length === 0) {
      return { success: false, error: 'No recipient email specified' };
    }

    // Try 1: Resend API via /api/resend proxy (works in Vite dev server with zero CORS errors)
    try {
      const proxyUrl = '/api/resend/emails';
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: DEFAULT_FROM,
          to: filteredRecipients,
          subject: payload.subject,
          html: html,
          ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
          ...(payload.attachments && payload.attachments.length > 0 ? { attachments: payload.attachments } : {})
        })
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, id: data.id };
      }
    } catch (proxyErr) {
      // Dev proxy not running, proceed to Edge function
    }

    // Try 2: Supabase Edge Function 'send-email'
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          ...payload,
          to: filteredRecipients,
          customHtml: html,
          ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
          ...(payload.attachments && payload.attachments.length > 0 ? { attachments: payload.attachments } : {})
        }
      });

      if (!error && data?.success) {
        return { success: true, id: data.id };
      }
    } catch (edgeErr) {
      // Edge function failed or not deployed
    }

    // Try 3: Direct Resend API (Node / server environment)
    const isNode = typeof window === 'undefined' || Boolean((globalThis as any)?.process?.versions?.node);
    if (isNode) {
      const directRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: DEFAULT_FROM,
          to: filteredRecipients,
          subject: payload.subject,
          html: html,
          ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
          ...(payload.attachments && payload.attachments.length > 0 ? { attachments: payload.attachments } : {})
        })
      });

      const directData = await directRes.json();
      if (directRes.ok) {
        return { success: true, id: directData.id };
      }
      return { success: false, error: directData.message || 'Direct Resend dispatch failed' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[EmailService] Email dispatch exception:', err.message || err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// ----------------------------------------------------------------------
// KYC Email Helpers
// ----------------------------------------------------------------------

export async function sendKycRequestedEmail(params: { to: string; userName: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Action Required: Identity Verification Requested',
    eventType: 'kyc_requested',
    data: {
      userName: params.userName,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/kyc'
    }
  });
}

export async function sendKycSubmittedEmail(params: { to: string; userName: string; isResubmission?: boolean }) {
  return dispatchEmail({
    to: params.to,
    subject: params.isResubmission ? 'KYC Resubmission Received' : 'KYC Information Received',
    eventType: params.isResubmission ? 'kyc_resubmitted' : 'kyc_submitted',
    data: {
      userName: params.userName,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/kyc'
    }
  });
}

export async function sendKycUnderReviewEmail(params: { to: string; userName: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Your KYC Verification is Now Under Review',
    eventType: 'kyc_under_review',
    data: {
      userName: params.userName,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/kyc'
    }
  });
}

export async function sendKycVerificationInProgressEmail(params: { to: string; userName: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Your Identity Verification is in Progress',
    eventType: 'kyc_verification_in_progress',
    data: {
      userName: params.userName,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/kyc'
    }
  });
}

export async function sendKycVerifiedEmail(params: { to: string; userName: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Congratulations: Your Identity Verification is Approved',
    eventType: 'kyc_verified',
    data: {
      userName: params.userName,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/payments'
    }
  });
}

export async function sendKycRejectedEmail(params: { to: string; userName: string; reason?: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Important: Your KYC Verification Was Rejected',
    eventType: 'kyc_rejected',
    data: {
      userName: params.userName,
      reason: params.reason || 'Verification details could not be validated.',
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/kyc'
    }
  });
}

export async function sendKycActionRequiredEmail(params: { to: string; userName: string; reason?: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Action Required on Your KYC Verification',
    eventType: 'kyc_action_required',
    data: {
      userName: params.userName,
      reason: params.reason || 'Additional information or a clearer document is required.',
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/kyc'
    }
  });
}

export async function sendKycResubmissionRequiredEmail(params: { to: string; userName: string; reason?: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Resubmission Required for Identity Verification',
    eventType: 'kyc_resubmission_required',
    data: {
      userName: params.userName,
      reason: params.reason || 'Please re-upload your document.',
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/kyc'
    }
  });
}

// ----------------------------------------------------------------------
// Invoice & Payment Email Helpers
// ----------------------------------------------------------------------

export async function sendInvoiceCreatedEmail(params: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: number | string;
  dueDate: string;
  creatorName?: string;
  actionUrl?: string;
}) {
  return dispatchEmail({
    to: params.to,
    subject: `New Invoice #${params.invoiceNumber} from ${params.creatorName || 'Idyll Productions'}`,
    eventType: 'invoice_created',
    data: {
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      dueDate: params.dueDate,
      creatorName: params.creatorName,
      actionUrl: params.actionUrl
    }
  });
}

// Helper to check if a user has enabled email notifications (default is true)
export function isUserEmailNotificationsEnabled(userId?: string | null, userMetadata?: any): boolean {
  if (userMetadata?.email_notifications === false) return false;
  if (userId && typeof window !== 'undefined') {
    const local = localStorage.getItem(`idyll_email_notifications_${userId}`);
    if (local === 'false') return false;
  }
  return true;
}

export async function sendInvoiceSubmittedUserEmail(params: {
  to: string;
  userName: string;
  invoiceNumber: string;
  amount: number | string;
  clientName?: string;
  actionUrl?: string;
  userId?: string;
}) {
  if (params.userId && !isUserEmailNotificationsEnabled(params.userId)) {
    console.log(`[EmailService] User ${params.userId} has disabled email notifications. Skipping invoice submission email.`);
    return { success: true, skipped: true };
  }

  return dispatchEmail({
    to: params.to,
    subject: `We have received your invoice #${params.invoiceNumber} - Idyll Tracks Payments`,
    eventType: 'invoice_submitted_user',
    data: {
      userName: params.userName,
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      clientName: params.clientName || 'Idyll Productions Pvt. Ltd.',
      actionUrl: params.actionUrl || (typeof window !== 'undefined' ? window.location.origin : '') + '/payments'
    }
  });
}

export async function sendPaymentReceivedEmail(params: {
  to: string;
  userName: string;
  invoiceNumber: string;
  amount: number | string;
  paymentDate?: string;
  paymentMethod?: string;
}) {
  return dispatchEmail({
    to: params.to,
    subject: `Payment Received: Invoice #${params.invoiceNumber}`,
    eventType: 'payment_received',
    data: {
      userName: params.userName,
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      paymentDate: params.paymentDate || new Date().toLocaleDateString('en-IN'),
      paymentMethod: params.paymentMethod || 'Online Payment'
    }
  });
}

export async function sendPaymentReminderEmail(params: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: number | string;
  dueDate: string;
}) {
  return dispatchEmail({
    to: params.to,
    subject: `Payment Reminder: Invoice #${params.invoiceNumber}`,
    eventType: 'payment_reminder',
    data: {
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      dueDate: params.dueDate
    }
  });
}

export async function sendInvoiceCancelledEmail(params: {
  to: string;
  clientName: string;
  invoiceNumber: string;
}) {
  return dispatchEmail({
    to: params.to,
    subject: `Invoice #${params.invoiceNumber} has been Cancelled`,
    eventType: 'invoice_cancelled',
    data: {
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber
    }
  });
}

export async function sendInvoiceRejectedEmail(params: {
  to: string;
  userName?: string;
  invoiceNumber: string;
  reason?: string;
}) {
  return dispatchEmail({
    to: params.to,
    subject: `Notice: Invoice #${params.invoiceNumber} Rejected`,
    eventType: 'invoice_rejected',
    data: {
      userName: params.userName,
      invoiceNumber: params.invoiceNumber,
      reason: params.reason,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/payments'
    }
  });
}

export async function sendInvoiceAdminAlertEmail(params: {
  invoiceNumber: string;
  creatorName: string;
  amount: number | string;
  clientName?: string;
}) {
  return dispatchEmail({
    to: 'idylltracks@gmail.com',
    subject: `New Invoice #${params.invoiceNumber} Submitted by ${params.creatorName}`,
    eventType: 'invoice_submitted_admin',
    data: {
      invoiceNumber: params.invoiceNumber,
      creatorName: params.creatorName,
      amount: params.amount,
      clientName: params.clientName,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/billing'
    }
  });
}

export async function sendKycAdminAlertEmail(params: {
  userName: string;
  userEmail: string;
  isResubmission?: boolean;
}) {
  return dispatchEmail({
    to: 'idylltracks@gmail.com',
    subject: `New KYC Submission: ${params.userName} (${params.userEmail})`,
    eventType: 'kyc_submitted_admin',
    data: {
      userName: params.userName,
      userEmail: params.userEmail,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/kyc'
    }
  });
}

// ----------------------------------------------------------------------
// User & Admin Helpers
// ----------------------------------------------------------------------

export async function sendUserAccountApprovedEmail(params: { to: string; userName: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Your Account Has Been Approved - Idyll Tracks Payments',
    eventType: 'account_approved',
    data: {
      userName: params.userName,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '')
    }
  });
}

export async function sendUserRoleUpdatedEmail(params: { to: string; userName: string; newRole: string }) {
  return dispatchEmail({
    to: params.to,
    subject: 'Your Workspace Role Has Been Updated - Idyll Tracks Payments',
    eventType: 'role_updated',
    data: {
      userName: params.userName,
      newRole: params.newRole,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '')
    }
  });
}

// ----------------------------------------------------------------------
// Support Helpers
// ----------------------------------------------------------------------

export async function sendSupportTicketAdminEmail(params: {
  userName: string;
  userEmail: string;
  userRole?: string;
  accountId?: string;
  message: string;
  originUrl?: string;
}) {
  const formattedDate = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  return dispatchEmail({
    to: 'idylltracks@gmail.com',
    replyTo: params.userEmail && params.userEmail.includes('@') ? params.userEmail : undefined,
    subject: `Support Request: ${params.userName} (${params.userEmail || 'No Email'})`,
    eventType: 'support_ticket_admin',
    data: {
      userName: params.userName,
      userEmail: params.userEmail,
      userRole: params.userRole || 'User',
      accountId: params.accountId || 'N/A',
      date: formattedDate,
      message: params.message,
      actionUrl: params.originUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    }
  });
}

export async function sendSupportTicketConfirmationEmail(params: {
  to: string;
  userName: string;
  message: string;
}) {
  return dispatchEmail({
    to: params.to,
    subject: 'We Have Received Your Support Request - Idyll Tracks Payments',
    eventType: 'support_ticket_confirmation',
    data: {
      userName: params.userName,
      message: params.message,
      actionUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/dashboard'
    }
  });
}

// ----------------------------------------------------------------------
// Compose & Custom Email Helpers
// ----------------------------------------------------------------------

export interface CustomComposeAttachment {
  filename: string;
  content: string; // Base64 encoded string
  size?: number;   // In bytes, for UI display
  type?: string;   // MIME type, for UI display
}

export interface CustomComposeParams {
  to: string | string[];
  subject: string;
  body: string;
  attachments?: CustomComposeAttachment[];
  replyTo?: string;
  senderName?: string;
}

export async function sendCustomComposeEmail(params: CustomComposeParams): Promise<{ success: boolean; id?: string; error?: string }> {
  // Convert plain text body with newlines into clean HTML paragraphs
  const safeBody = params.body
    .split(/\n\n+/)
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #111827; font-size: 15px;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FFFFFF; margin: 0; padding: 36px 20px; color: #111827;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="margin-bottom: 28px;">
      <img src="${LOGO_URL}" alt="Idyll Tracks Payments" style="height: 36px; width: auto;" />
    </div>
    
    <div style="margin-bottom: 32px;">
      ${safeBody}
    </div>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; line-height: 1.5;">
      <p style="margin: 0 0 4px 0;">Sent securely via <strong>Idyll Tracks Payments</strong></p>
      <p style="margin: 0;">billing@idylltrackspayments.online • Powered by Idyll Productions</p>
    </div>
  </div>
</body>
</html>`;

  // Resend expects attachments as: [{ filename: string, content: string }]
  const resendAttachments = params.attachments?.map(att => ({
    filename: att.filename,
    content: att.content
  }));

  return dispatchEmail({
    to: params.to,
    subject: params.subject,
    eventType: 'generic',
    replyTo: params.replyTo,
    customHtml: html,
    attachments: resendAttachments
  });
}

/**
 * Fetch real-time delivery status for an email via Resend API
 */
export async function fetchResendEmailStatus(emailId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const proxyUrl = `/api/resend/emails/${emailId}`;
    const res = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }

    // Direct fallback
    const directRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (directRes.ok) {
      const data = await directRes.json();
      return { success: true, data };
    }

    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.message || 'Unable to fetch email status from Resend' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to connect to Resend API' };
  }
}

