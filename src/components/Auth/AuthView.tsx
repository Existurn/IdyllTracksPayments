import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Mail, Lock, AlertCircle, Home, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { logAction } from '../../utils/auditLogger';

interface AuthViewProps {
  initialIsLogin?: boolean;
  onBack?: () => void;
  onSignupSuccess?: (email: string) => void;
  onLoginSuccess?: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ initialIsLogin = true, onBack, onSignupSuccess, onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showRedirectConfirm, setShowRedirectConfirm] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isAccountNotFound, setIsAccountNotFound] = useState(false);

  useEffect(() => {
    window.history.replaceState({}, '', isLogin ? '/login' : '/signup');
  }, [isLogin]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      setIsAccountNotFound(false);
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setIsAccountNotFound(false);

    try {
      // Check if an account with this email exists in user_roles
      const { data: userRecord, error: checkError } = await supabase
        .from('user_roles')
        .select('id, email')
        .ilike('email', trimmedEmail)
        .maybeSingle();

      if (checkError) {
        console.warn('[AuthView] Error checking user existence:', checkError);
      }

      if (!userRecord) {
        setIsAccountNotFound(true);
        setError("You don't have an account with this email address. Please go back to the home page and create your new account.");
        setLoading(false);
        return;
      }

      const redirectUrl = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl
      });
      if (resetError) throw resetError;

      setResetEmailSent(true);
    } catch (err: any) {
      console.error('[AuthView] Forgot password error:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await logAction('Login', 'User successfully logged into the workspace');
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('User already registered');
        }
        if (onSignupSuccess) {
          onSignupSuccess(email);
        } else {
          setMessage('Check your email for the confirmation link.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google authentication.');
      setLoading(false);
    }
  };

  const isInvalidLogin = error === 'Invalid login credentials';

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>
      <style>
        {`
          .autofill-error:-webkit-autofill,
          .autofill-error:-webkit-autofill:hover, 
          .autofill-error:-webkit-autofill:focus, 
          .autofill-error:-webkit-autofill:active {
              -webkit-box-shadow: 0 0 0 30px #FEF2F2 inset !important;
              -webkit-text-fill-color: #B91C1C !important;
          }
          .autofill-normal:-webkit-autofill,
          .autofill-normal:-webkit-autofill:hover, 
          .autofill-normal:-webkit-autofill:focus, 
          .autofill-normal:-webkit-autofill:active {
              -webkit-box-shadow: 0 0 0 30px #F7F7F7 inset !important;
              -webkit-text-fill-color: #1a1a1a !important;
          }
        `}
      </style>
      {/* Navbar */}
      <nav style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 80px', width: '100%', zIndex: 30 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/idyll_track_logo.svg" alt="Idyll Tracks Logo" style={{ height: '48px', width: 'auto' }} />
          <div style={{ fontFamily: "'Nohemi', sans-serif", fontSize: '24px', fontWeight: '400', color: '#111827', letterSpacing: '-0.02em', lineHeight: '1.1', textAlign: 'left' }}>
            Idyll Tracks<br />Payments
          </div>
        </div>

        {/* Right Button */}
        {onBack && (
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', color: '#111827', border: 'none', padding: '10px 20px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'color 0.2s' }} 
            onMouseEnter={(e) => e.currentTarget.style.color = '#374151'} 
            onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
          >
            <Home size={16} />
            Back to Home
          </button>
        )}
      </nav>

      {/* Center Wrapper to hold card and relative images */}
      <div className="relative flex justify-center items-center w-full max-w-[1200px] h-screen px-4">
        
        {/* Center Card */}
        <div className="bg-white relative z-20 w-full max-w-[460px]" style={{ 
          padding: '48px 40px'
        }}>
          
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <h2 style={{ 
              fontFamily: "'Nohemi', sans-serif",
              fontSize: '32px', 
              fontWeight: '700', 
              color: '#111827', 
              marginBottom: '8px',
              lineHeight: '1.2'
            }}>
              {isForgotPassword 
                ? (resetEmailSent ? 'Check Your Email' : 'Reset Password')
                : (isLogin ? 'Welcome Back' : 'Create Account')}
            </h2>
            <p style={{ color: '#6B7280', fontSize: '15px' }}>
              {isForgotPassword 
                ? (resetEmailSent ? 'A password reset link has been dispatched' : 'Enter your email address to receive a password reset link')
                : (isLogin ? 'Please login or sign up to continue' : 'Sign up to get started')}
            </p>
          </div>

          {error && error !== 'User already registered' && (
            <div style={{ marginBottom: '24px', padding: '14px 16px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <AlertCircle size={20} color="#EF4444" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '14px', color: '#B91C1C', lineHeight: '1.5', margin: 0, fontWeight: '500', width: '100%' }}>
                {isAccountNotFound ? (
                  <div>
                    <p style={{ margin: '0 0 10px 0', color: '#991B1B' }}>
                      You don't have an account with this email address. Please go back to the home page and create your new account.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(false);
                          setIsLogin(false);
                          setError(null);
                          setIsAccountNotFound(false);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: '#DC2626',
                          fontWeight: '700',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Create New Account →
                      </button>
                      {onBack && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setIsAccountNotFound(false);
                            onBack();
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#6B7280',
                            fontWeight: '600',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          Go Back to Home
                        </button>
                      )}
                    </div>
                  </div>
                ) : isInvalidLogin ? (
                  "You don't have any account (or your password is incorrect). Please create an account by clicking the sign up button below."
                ) : (
                  error
                )}
              </div>
            </div>
          )}

          {message && (
            <div style={{ marginBottom: '24px', padding: '12px 16px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #86EFAC', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check className="w-3 h-3 text-white" />
              </div>
              <p style={{ fontSize: '14px', color: '#15803D', lineHeight: '1.5', margin: 0, fontWeight: '500' }}>
                {message}
              </p>
            </div>
          )}

          {isForgotPassword ? (
            resetEmailSent ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '16px',
                  backgroundColor: '#FFF7ED',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  color: '#EA580C',
                  border: '1px solid #FFEDD5'
                }}>
                  <Mail size={30} />
                </div>
                <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.6', marginBottom: '24px' }}>
                  We have sent a password reset link to <strong style={{ color: '#111827' }}>{email}</strong>. Please check your inbox and click the link to reset your password.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setResetEmailSent(false);
                      setError(null);
                      setMessage(null);
                      setIsAccountNotFound(false);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#111827',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1F2937')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111827')}
                  >
                    Back to Login
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleForgotPassword}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#FF6600',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    {loading ? 'Resending...' : "Didn't receive email? Resend"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                      <Mail size={20} color={isAccountNotFound ? "#EF4444" : "#4b5563"} strokeWidth={1.5} />
                    </div>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                        if (isAccountNotFound) setIsAccountNotFound(false);
                      }}
                      placeholder="Your Email"
                      className={isAccountNotFound ? "autofill-error" : "autofill-normal"}
                      style={{ 
                        width: '100%', 
                        padding: '16px 16px 16px 52px', 
                        backgroundColor: isAccountNotFound ? '#FEF2F2' : '#F7F7F7', 
                        border: isAccountNotFound ? '1px solid #FCA5A5' : '1px solid #F0F0F0',
                        borderRadius: '8px', 
                        fontSize: '15px',
                        color: '#1a1a1a',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-white font-medium flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: '#FF6600',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      transition: 'all 0.2s',
                      border: 'none',
                      opacity: loading ? 0.7 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer'
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
                      'Send Reset Link'
                    )}
                  </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setError(null);
                      setMessage(null);
                      setIsAccountNotFound(false);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'none',
                      border: 'none',
                      color: '#4B5563',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#111827')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#4B5563')}
                  >
                    <ArrowLeft size={16} />
                    Back to Login
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Email Input */}
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <Mail size={20} color={error === 'User already registered' ? '#EF4444' : '#4b5563'} strokeWidth={1.5} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error === 'User already registered') setError(null);
                    }}
                    placeholder="Your Email"
                    className={error === 'User already registered' ? 'autofill-error' : 'autofill-normal'}
                    style={{ 
                      width: '100%', 
                      padding: '16px 16px 16px 52px', 
                      backgroundColor: error === 'User already registered' ? '#FEF2F2' : '#F7F7F7', 
                      border: error === 'User already registered' ? '1px solid #FCA5A5' : '1px solid #F0F0F0',
                      borderRadius: '8px', 
                      fontSize: '15px',
                      color: error === 'User already registered' ? '#B91C1C' : '#1a1a1a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Password Input */}
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <Lock size={20} color="#4b5563" strokeWidth={1.5} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your Password"
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
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#9ca3af" strokeWidth={1.5} />
                    ) : (
                      <Eye size={20} color="#9ca3af" strokeWidth={1.5} />
                    )}
                  </button>
                </div>

                {/* Forgot Password Link (Only shown on Login) */}
                {isLogin && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError(null);
                        setMessage(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6B7280',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        padding: '2px 0',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#111827')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {!isLogin && (
                  <>
                    {/* Confirm Password Input */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <Lock size={20} color="#4b5563" strokeWidth={1.5} />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
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
                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={20} color="#9ca3af" strokeWidth={1.5} />
                        ) : (
                          <Eye size={20} color="#9ca3af" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                    {(email.length > 0 || password.length > 0 || confirmPassword.length > 0) && (
                      <p style={{ fontSize: '13px', color: error === 'User already registered' ? '#EF4444' : '#3B82F6', marginTop: '-4px', lineHeight: '1.4', textAlign: 'center' }}>
                        {error === 'User already registered' 
                          ? 'It looks like you already have an account. Please log in.' 
                          : 'Manual signup takes a few extra steps. We recommend signing up with Google for a faster and easier experience.'}
                      </p>
                    )}
                  </>
                )}

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-medium flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: '#FF6600',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    transition: 'all 0.2s',
                    border: 'none',
                    opacity: loading ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#E55C00';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#FF6600';
                    }
                  }}
                >{loading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    isLogin ? 'Login' : 'Sign Up'
                  )}
                </button>
              </form>

              {/* Google Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  width: '100%',
                  marginTop: '16px',
                  border: '1.5px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: 'white',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {isLogin ? 'Log in with Google' : 'Sign up with Google'}
              </button>

              {/* Footer Link */}
              <div style={{ marginTop: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                {isLogin && isInvalidLogin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(false);
                      setError(null);
                      setMessage(null);
                    }}
                    style={{
                      backgroundColor: '#111827',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '600',
                      width: '100%',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F2937'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111827'}
                  >
                    Create New Account
                  </button>
                ) : (
                  <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                    {isLogin ? "Don't have an account? " : "Already Have An Account? "}
                    <button
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setError(null);
                        setMessage(null);
                      }}
                      style={{ 
                        fontWeight: '700', 
                        color: '#1a1a1a',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        marginLeft: '4px'
                      }}
                    >
                      {isLogin ? 'Sign up' : 'Login'}
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
          
        </div>

        {/* Footer Text */}
        <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <img src="/idyll_productions_black.png" alt="Idyll Productions" style={{ height: '28px', width: 'auto' }} />
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
            A Finance System by Idyll Productions
          </span>
        </div>
      </div>
    </div>
  );
};

// Simple Check icon for the success message
const Check = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export default AuthView;
