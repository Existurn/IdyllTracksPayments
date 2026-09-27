import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, LifeBuoy } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { 
  sendSupportTicketAdminEmail, 
  sendSupportTicketConfirmationEmail 
} from '../../utils/emailService';
import { showToast } from '../../utils/notifications';
import { useRBAC } from '../../contexts/RBACContext';
import styles from './SupportView.module.css';

export const SupportView: React.FC = () => {
  const { currentUser } = useRBAC();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Authenticated user state
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('User');

  const activeName = currentUser?.name || userName;
  const activeEmail = currentUser?.email || userEmail;
  const activeUserId = currentUser?.id || userId;
  const activeRole = currentUser?.role || userRole;

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || '');

        // Name
        if (user.user_metadata?.full_name) {
          setUserName(user.user_metadata.full_name);
        } else if (user.email) {
          const parts = user.email.split('@')[0].split(/[._-]/);
          setUserName(parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '));
        }

        // Fetch role from user_roles
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (roleData) {
          setUserRole(roleData.role);
        }
      }
    };

    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      showToast('Please enter a description of your problem.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save ticket into database
      await supabase.from('support_tickets').insert({
        user_id: activeUserId || null,
        user_name: activeName,
        user_email: activeEmail,
        account_id: activeUserId,
        message: message.trim(),
        status: 'Open'
      });

      // 2. Send email to idylltracks@gmail.com via Resend
      await sendSupportTicketAdminEmail({
        userName: activeName,
        userEmail: activeEmail || 'No email provided',
        userRole: activeRole,
        accountId: activeUserId,
        message: message.trim(),
        originUrl: window.location.origin
      });

      // 3. Send confirmation email to user
      if (activeEmail) {
        await sendSupportTicketConfirmationEmail({
          to: activeEmail,
          userName: activeName,
          message: message.trim()
        });
      }

      setSubmittedSuccess(true);
      setMessage('');
      showToast('Message sent successfully. Our team will review your request.');
    } catch (err: any) {
      console.error('[Support] Error sending ticket:', err);
      showToast(err.message || 'Error submitting request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Help & Support</h1>
        <p className={styles.subtitle}>
          Need help with your invoices, payments, or account? Reach out to the Idyll Tracks team directly.
        </p>
      </div>

      {submittedSuccess && (
        <div className={styles.successBanner}>
          <CheckCircle2 size={20} className={styles.successIcon} />
          <div>
            <div className={styles.successTitle}>Request Sent Successfully</div>
            <div>Message sent successfully. Our team will review your request and get back to you shortly.</div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="supportMessage" className={styles.label}>
              Describe your issue or question
            </label>
            <textarea
              id="supportMessage"
              className={styles.textarea}
              placeholder="Describe your problem here..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (submittedSuccess) setSubmittedSuccess(false);
              }}
              required
            />
          </div>

          <div className={styles.infoMetaRow}>
            <span>Submitting as: <strong>{activeName}</strong> ({activeEmail})</span>
          </div>

          <button
            type="submit"
            className={styles.sendBtn}
            disabled={submitting}
          >
            <Send size={15} />
            {submitting ? 'Sending Request...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SupportView;
