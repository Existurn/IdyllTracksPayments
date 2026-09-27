import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Lock, Eye, EyeOff, Check, AlertCircle, ArrowLeft } from 'lucide-react';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onBackToLogin?: () => void;
  onClose?: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ 
  isOpen, 
  onSuccess, 
  onBackToLogin,
  onClose 
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Clean up the URL hash (remove recovery tokens from address bar)
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('[ResetPassword] Error updating password:', err);
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLoginClick = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[ResetPassword] Signout error:', e);
    }
    if (onBackToLogin) {
      onBackToLogin();
    } else if (onClose) {
      onClose();
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundColor: '#FFFFFF', 
        fontFamily: "'Inter', sans-serif",
        zIndex: 99999 
      }}
    >
      {/* Navbar */}
      <nav style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '40px 80px', 
        width: '100%', 
        zIndex: 30 
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/idyll_track_logo.svg" alt="Idyll Tracks Logo" style={{ height: '48px', width: 'auto' }} />
          <div style={{ 
            fontFamily: "'Nohemi', sans-serif", 
            fontSize: '24px', 
            fontWeight: '400', 
            color: '#111827', 
            letterSpacing: '-0.02em', 
            lineHeight: '1.1', 
            textAlign: 'left' 
          }}>
            Idyll Tracks<br />Payments
          </div>
        </div>

        {/* Top Back Action Button */}
        {!success && (onClose || onBackToLogin) && (
          <button 
            type="button"
            onClick={handleBackToLoginClick}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: 'transparent', 
              color: '#111827', 
              border: 'none', 
              padding: '10px 20px', 
              fontSize: '15px', 
              fontWeight: '600', 
              cursor: 'pointer', 
              transition: 'color 0.2s' 
            }} 
            onMouseEnter={(e) => e.currentTarget.style.color = '#374151'} 
            onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
          >
            <ArrowLeft size={16} />
            Back to Login
          </button>
        )}
      </nav>

      {/* Center Wrapper to hold card */}
      <div className="relative flex justify-center items-center w-full max-w-[1200px] h-screen px-4">
        
        {/* Center Card */}
        <div className="bg-white relative z-20 w-full max-w-[460px]" style={{ padding: '48px 40px' }}>
          
          {success ? (
            /* Premium Success State without automatic redirect */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#111827',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                color: '#FFFFFF'
              }}>
                <Check size={28} strokeWidth={2.5} color="#FFFFFF" />
              </div>

              <h2 style={{ 
                fontFamily: "'Nohemi', sans-serif",
                fontSize: '28px', 
                fontWeight: '700', 
                color: '#111827', 
                marginBottom: '10px',
                lineHeight: '1.2'
              }}>
                Password Changed
              </h2>

              <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                Your password has been successfully updated. Where would you like to go next?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Button 1: Enter Dashboard */}
                <button
                  type="button"
                  onClick={onSuccess}
                  style={{
                    backgroundColor: '#FF6600',
                    color: '#FFFFFF',
                    padding: '14px 24px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E55C00')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FF6600')}
                >
                  Enter Dashboard
                </button>

                {/* Button 2: Back to Login */}
                <button
                  type="button"
                  onClick={handleBackToLoginClick}
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    padding: '14px 24px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    border: '1.5px solid #E5E7EB',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#9CA3AF';
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  Back to Login
                </button>
              </div>
            </div>
          ) : (
            /* Reset Form */
            <>
              <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <h2 style={{ 
                  fontFamily: "'Nohemi', sans-serif",
                  fontSize: '32px', 
                  fontWeight: '700', 
                  color: '#111827', 
                  marginBottom: '8px',
                  lineHeight: '1.2'
                }}>
                  Set New Password
                </h2>
                <p style={{ color: '#6B7280', fontSize: '15px' }}>
                  Enter your new password below to regain access to your account.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div style={{ 
                  marginBottom: '24px', 
                  padding: '12px 16px', 
                  backgroundColor: '#FEF2F2', 
                  borderRadius: '8px', 
                  border: '1px solid #FCA5A5', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px' 
                }}>
                  <AlertCircle size={20} color="#EF4444" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: '14px', color: '#B91C1C', lineHeight: '1.5', margin: 0, fontWeight: '500' }}>
                    {error}
                  </p>
                </div>
              )}

              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Field 1: New Password */}
                <div style={{ position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', 
                    left: '16px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    pointerEvents: 'none' 
                  }}>
                    <Lock size={20} color="#4b5563" strokeWidth={1.5} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New Password (min. 6 characters)"
                    style={{ 
                      width: '100%', 
                      padding: '16px 52px 16px 52px', 
                      backgroundColor: '#F7F7F7', 
                      border: '1px solid #F0F0F0',
                      borderRadius: '8px', 
                      fontSize: '15px',
                      color: '#1a1a1a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{ 
                      position: 'absolute', 
                      right: '16px', 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: 0 
                    }}
                  >
                    {showNewPassword ? (
                      <EyeOff size={20} color="#9ca3af" strokeWidth={1.5} />
                    ) : (
                      <Eye size={20} color="#9ca3af" strokeWidth={1.5} />
                    )}
                  </button>
                </div>

                {/* Field 2: Confirm Password */}
                <div style={{ position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', 
                    left: '16px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    pointerEvents: 'none' 
                  }}>
                    <Lock size={20} color="#4b5563" strokeWidth={1.5} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm New Password"
                    style={{ 
                      width: '100%', 
                      padding: '16px 52px 16px 52px', 
                      backgroundColor: '#F7F7F7', 
                      border: '1px solid #F0F0F0',
                      borderRadius: '8px', 
                      fontSize: '15px',
                      color: '#1a1a1a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ 
                      position: 'absolute', 
                      right: '16px', 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: 0 
                    }}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color="#9ca3af" strokeWidth={1.5} />
                    ) : (
                      <Eye size={20} color="#9ca3af" strokeWidth={1.5} />
                    )}
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-medium flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: '#FF6600',
                    padding: '14px 24px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    border: 'none',
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = '#E55C00';
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = '#FF6600';
                  }}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Update Password'
                  )}
                </button>

              </form>
            </>
          )}

        </div>

        {/* Footer Text */}
        <div style={{ 
          position: 'absolute', 
          bottom: '40px', 
          left: 0, 
          right: 0, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '8px' 
        }}>
          <img src="/idyll_productions_black.png" alt="Idyll Productions" style={{ height: '28px', width: 'auto' }} />
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
            A Finance System by Idyll Productions
          </span>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
