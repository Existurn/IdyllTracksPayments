import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface AuthenticationViewProps {
  isVerified: boolean;
  email?: string;
  onNext: () => void;
  onBackToLogin?: () => void;
}

const AuthenticationView: React.FC<AuthenticationViewProps> = ({ 
  isVerified, 
  email: initialEmail, 
  onNext,
  onBackToLogin
}) => {
  // Retrieve email from prop or localStorage
  const [email, setEmail] = useState(() => {
    return initialEmail || localStorage.getItem('unverified_signup_email') || '';
  });

  const [resendCooldown, setResendCooldown] = useState(() => {
    const lastResend = localStorage.getItem('lastResendTimer');
    if (lastResend) {
      const elapsed = Math.floor((Date.now() - parseInt(lastResend)) / 1000);
      if (elapsed < 30) return 30 - elapsed;
    }
    return 0;
  });

  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [showRedirectConfirm, setShowRedirectConfirm] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState('');

  // Keep email state in sync if prop changes
  useEffect(() => {
    if (initialEmail && initialEmail !== email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    let timer: number;
    if (resendCooldown > 0) {
      timer = window.setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  const handleResend = async () => {
    const targetEmail = (isEditingEmail && customEmailInput ? customEmailInput : email).trim();
    
    if (!targetEmail) {
      setIsEditingEmail(true);
      setResendError('Please enter your email address to receive the verification link.');
      return;
    }

    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setResendError(null);
    setResendSuccess(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        setResendError(error.message || 'Error sending confirmation email. Please try again.');
      } else {
        localStorage.setItem('lastResendTimer', Date.now().toString());
        localStorage.setItem('unverified_signup_email', targetEmail);
        setEmail(targetEmail);
        setIsEditingEmail(false);
        setResendCooldown(30);
        setResendSuccess(`Verification email sent to ${targetEmail}! Please check your inbox and spam folder.`);
      }
    } catch (err: any) {
      setResendError(err.message || 'Error resending verification email. Please check your connection.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Navbar */}
      <nav style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 80px', width: '100%', zIndex: 30 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/idyll_track_logo.svg" alt="Idyll Tracks Logo" style={{ height: '48px', width: 'auto' }} />
          <div style={{ fontFamily: "'Nohemi', sans-serif", fontSize: '24px', fontWeight: '400', color: '#111827', letterSpacing: '-0.02em', lineHeight: '1.1', textAlign: 'left' }}>
            Idyll Tracks<br />Payments
          </div>
        </div>
      </nav>

      {/* Center Wrapper */}
      <div className="relative flex justify-center items-center w-full max-w-[1200px] h-screen px-4">
        
        {/* Center Card */}
        <div className="bg-white relative z-20 w-full max-w-[460px]" style={{ padding: '48px 40px' }}>
          
          {isVerified ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: '80px', height: '80px', backgroundColor: '#ECFCCB', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
              }}>
                <CheckCircle2 size={40} color="#65A30D" strokeWidth={2} />
              </div>
              
              <h2 style={{ 
                fontFamily: "'Nohemi', sans-serif",
                fontSize: '32px', 
                fontWeight: '700', 
                color: '#111827', 
                marginBottom: '12px',
                lineHeight: '1.2'
              }}>
                Authentication Successful
              </h2>
              
              <p style={{ color: '#6B7280', fontSize: '15px', marginBottom: '32px', lineHeight: '1.5' }}>
                Your authentication has been completed successfully. You can continue to your profile.
              </p>
              
              <button
                type="button"
                onClick={onNext}
                style={{
                  backgroundColor: '#FF6600',
                  color: 'white',
                  padding: '16px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  width: '100%',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E55C00'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FF6600'}
              >
                Continue
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <img src="/link_sent_icon.png" alt="Link Sent" style={{ width: '140px', height: 'auto', marginBottom: '24px' }} />
              
              <h2 style={{ 
                fontFamily: "'Nohemi', sans-serif",
                fontSize: '32px', 
                fontWeight: '700', 
                color: '#111827', 
                marginBottom: '12px',
                lineHeight: '1.2'
              }}>
                Link has been sent
              </h2>
              
              <p style={{ color: '#6B7280', fontSize: '15px', marginBottom: '8px', lineHeight: '1.5' }}>
                We've sent a verification link to{' '}
                {email ? (
                  <span style={{ color: '#111827', fontWeight: '600' }}>{email}</span>
                ) : (
                  'your email address'
                )}
                . Please check your inbox and click the link to complete your authentication.
              </p>
              
              <p style={{ color: '#3B82F6', fontSize: '14px', fontWeight: '500', marginBottom: '24px' }}>
                If you don't see the email, please check your spam folder.
              </p>

              {/* Success Notification */}
              {resendSuccess && (
                <div style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}>
                  <CheckCircle2 size={18} color="#16A34A" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#166534', lineHeight: '1.4' }}>
                    {resendSuccess}
                  </span>
                </div>
              )}

              {/* Error Notification */}
              {resendError && (
                <div style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}>
                  <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#991B1B', lineHeight: '1.4' }}>
                    {resendError}
                  </span>
                </div>
              )}

              {/* Optional Inline Email Field if user wants to change or input email */}
              {isEditingEmail && (
                <div style={{ width: '100%', marginBottom: '16px', textAlign: 'left' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={customEmailInput || email}
                    onChange={(e) => setCustomEmailInput(e.target.value)}
                    placeholder="Enter your email"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
              
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                style={{
                  backgroundColor: (resendCooldown > 0 || isResending) ? '#E5E7EB' : '#111827',
                  color: (resendCooldown > 0 || isResending) ? '#9CA3AF' : 'white',
                  padding: '16px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  width: '100%',
                  cursor: (resendCooldown > 0 || isResending) ? 'not-allowed' : 'pointer',
                  border: 'none',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}
                onMouseEnter={(e) => { if (resendCooldown === 0 && !isResending) e.currentTarget.style.backgroundColor = '#1F2937' }}
                onMouseLeave={(e) => { if (resendCooldown === 0 && !isResending) e.currentTarget.style.backgroundColor = '#111827' }}
              >
                {isResending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending Email...
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend Email in ${resendCooldown}s`
                ) : (
                  'Resend Verification Email'
                )}
              </button>

              {/* Navigation Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
                {!isEditingEmail ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingEmail(true);
                      setCustomEmailInput(email);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4B5563',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: '4px 8px'
                    }}
                  >
                    Wrong email address? Change it
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6B7280',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '4px 8px'
                    }}
                  >
                    Cancel
                  </button>
                )}

                {onBackToLogin && (
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      color: '#111827',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      marginTop: '4px'
                    }}
                  >
                    <ArrowLeft size={14} />
                    Back to Sign In
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Text */}
      <div 
        onClick={() => setShowRedirectConfirm(true)}
        style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, textAlign: 'center', fontSize: '13px', color: '#374151', fontWeight: '500', cursor: 'pointer' }}
      >
        A Finance System by Idyll Productions
      </div>

      {/* Custom Confirm Modal for Footer Link */}
      {showRedirectConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Open Main Website?</h3>
            <p style={{ fontSize: '15px', color: '#4B5563', marginBottom: '24px', lineHeight: '1.5' }}>
              You are about to be redirected to idyllproductions.com. Do you want to continue?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setShowRedirectConfirm(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowRedirectConfirm(false);
                  window.open('https://idyllproductions.com', '_blank');
                }}
                style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#FF6600', color: 'white', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthenticationView;
