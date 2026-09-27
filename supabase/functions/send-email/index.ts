// Supabase Edge Function: send-email
// Runtime: Deno (TypeScript)
// Description: Secure server-side email dispatching via Resend API using secret RESEND_API_KEY.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string | string[];
  subject: string;
  eventType: 
    | 'kyc_requested'
    | 'kyc_submitted'
    | 'kyc_under_review'
    | 'kyc_verification_in_progress'
    | 'kyc_verified'
    | 'kyc_rejected'
    | 'kyc_action_required'
    | 'kyc_resubmission_required'
    | 'kyc_resubmitted'
    | 'support_ticket_admin'
    | 'support_ticket_confirmation'
    | 'generic';
  data?: {
    userName?: string;
    userEmail?: string;
    accountId?: string;
    reason?: string;
    message?: string;
    date?: string;
    actionUrl?: string;
    [key: string]: any;
  };
  customHtml?: string;
}

// Unified Idyll Tracks Payments Email Template Generator
function renderIdyllEmail(payload: EmailPayload): string {
  if (payload.customHtml) {
    return payload.customHtml;
  }

  const { eventType, data = {} } = payload;
  const userName = data.userName || 'Valued Partner';
  const reason = data.reason ? `<div style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 6px; padding: 14px 16px; margin: 20px 0; color: #991B1B; font-size: 14px; line-height: 1.5;"><strong>Reason:</strong> ${data.reason}</div>` : '';
  const actionUrl = data.actionUrl || 'https://idylltrackspayments.com';

  let heading = '';
  let bodyContent = '';
  let buttonText = 'View Identity Verification';
  let buttonUrl = actionUrl;

  switch (eventType) {
    case 'kyc_requested':
      heading = 'Identity Verification Required';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Hello ${userName},
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          An administrator has requested identity verification (KYC) for your account. Please complete this one-time verification to enable seamless invoice creation and payouts.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #6B7280;">
          You will need your Aadhaar details along with a clear copy (PDF, JPG, or PNG) of your physical Aadhaar card.
        </p>
      `;
      break;

    case 'kyc_submitted':
    case 'kyc_resubmitted':
      heading = eventType === 'kyc_resubmitted' ? 'KYC Resubmission Received' : 'KYC Information Received';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Hello ${userName},
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Thank you for submitting your identity verification documents. Your submission is queued for automated review.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #6B7280;">
          Verification typically takes 1 to 2 business days. We will notify you once review begins.
        </p>
      `;
      break;

    case 'kyc_under_review':
      heading = 'KYC Documents Under Review';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Hello ${userName},
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Your identity verification submission has moved to <strong>Under Review</strong>. Our automated compliance systems are verifying the provided documentation.
        </p>
      `;
      break;

    case 'kyc_verification_in_progress':
      heading = 'Verification in Progress';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Hello ${userName},
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Your identity verification has progressed to <strong>Verification in Progress</strong>. An authorized KYC manager will review your file for final sign-off.
        </p>
      `;
      break;

    case 'kyc_verified':
      heading = 'Identity Verification Approved';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Hello ${userName},
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Congratulations! Your identity verification (KYC) has been successfully approved and verified.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Invoice creation and billing features are now fully unlocked for your account.
        </p>
      `;
      buttonText = 'Go to Invoices';
      break;

    case 'kyc_rejected':
      heading = 'KYC Verification Rejected';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Hello ${userName},
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Your recent identity verification submission could not be verified by our compliance team.
        </p>
        ${reason}
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #6B7280;">
          Please review the reason above and resubmit your details and Aadhaar document with the correct information.
        </p>
      `;
      buttonText = 'Resubmit KYC';
      break;

    case 'kyc_action_required':
    case 'kyc_resubmission_required':
      heading = eventType === 'kyc_action_required' ? 'Action Required on Your KYC' : 'Resubmission Required';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Hello ${userName},
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Our compliance team has reviewed your KYC submission and identified items requiring your immediate attention:
        </p>
        ${reason}
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #6B7280;">
          Please sign in to update or re-upload your document so we can complete your verification.
        </p>
      `;
      buttonText = 'Update Documents';
      break;

    case 'support_ticket_admin':
      heading = 'New Support Request Received';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          A user has submitted a new support request from Idyll Tracks Payments.
        </p>
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;"><strong>User Name:</strong> ${userName}</p>
          <p style="margin: 0 0 8px 0;"><strong>User Email:</strong> ${data.userEmail || 'N/A'}</p>
          <p style="margin: 0 0 8px 0;"><strong>Account ID:</strong> ${data.accountId || 'N/A'}</p>
          <p style="margin: 0 0 12px 0;"><strong>Timestamp:</strong> ${data.date || new Date().toISOString()}</p>
          <div style="border-top: 1px solid #E5E7EB; padding-top: 12px;">
            <strong>Message:</strong>
            <p style="margin: 8px 0 0 0; white-space: pre-wrap; color: #111827;">${data.message || ''}</p>
          </div>
        </div>
      `;
      buttonText = 'Open Workspace';
      break;

    case 'support_ticket_confirmation':
      heading = 'Support Request Received';
      bodyContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          Hello ${userName},
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          We have received your support request. Our support team will review the details and get back to you as soon as possible.
        </p>
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px 16px; margin: 16px 0; font-size: 14px; line-height: 1.5; color: #4B5563;">
          <strong>Your Message:</strong>
          <p style="margin: 6px 0 0 0; font-style: italic; color: #111827;">"${data.message || ''}"</p>
        </div>
      `;
      buttonText = 'Go to Dashboard';
      break;

    default:
      heading = payload.subject;
      bodyContent = `<p style="font-size: 15px; line-height: 1.6; color: #374151;">${data.message || ''}</p>`;
      break;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.subject}</title>
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; color: #111827; font-size: 15px; line-height: 1.6;">
    
    <p style="margin-bottom: 24px;">Hi ${userName},</p>
    
    <div style="margin-bottom: 24px;">
      ${bodyContent}
    </div>
    
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
        src="https://anikhkgojeurvgymgblq.supabase.co/storage/v1/object/public/payment_qrcodes/email_assets/itp_logo_black.png" 
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

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-email] Missing RESEND_API_KEY environment variable in Supabase Secrets.");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "RESEND_API_KEY is not configured in Supabase Secrets." 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const payload: EmailPayload = await req.json();
    if (!payload.to || !payload.subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, subject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Idyll Tracks Payments <billing@idylltrackspayments.online>";
    const html = renderIdyllEmail(payload);

    // Call Resend REST API
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: html,
        ...((payload as any).replyTo || payload.data?.userEmail ? { reply_to: (payload as any).replyTo || payload.data?.userEmail } : {})
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      console.error("[send-email] Resend API Error:", resendData);
      return new Response(
        JSON.stringify({ success: false, error: resendData }),
        { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: resendData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-email] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
