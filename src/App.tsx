import { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from './components/Layout/AppLayout';
import Dashboard from './components/Dashboard/Dashboard';
import InvoiceTable from './components/InvoiceTable/InvoiceTable';
import InvoiceBuilder from './components/invoicing/InvoiceBuilder';
import BillingView from './components/Billing/BillingView';
import PaymentDetailsView from './components/PaymentDetails/PaymentDetailsView';
import UsersView from './components/Users/UsersView';
import AdminPanelView from './components/AdminPanel/AdminPanelView';
import SettingsView from './components/Settings/SettingsView';
import type { SettingsUnsavedHandlers } from './components/Settings/SettingsView';
import AuthView from './components/Auth/AuthView';
import ResetPasswordModal from './components/Auth/ResetPasswordModal';
import ProfileOnboarding from './components/Auth/ProfileOnboarding';
import AuthenticationView from './components/Auth/AuthenticationView';
import ApprovalWaiting from './components/Auth/ApprovalWaiting';
import LandingPage from './components/Landing/LandingPage';
import AuditView from './components/Audit/AuditView';
import PrivacyPolicy from './components/Privacy/PrivacyPolicy';
import AccountDeleted from './components/Auth/AccountDeleted';
import Kyc from './components/Kyc/Kyc';
import KycManagementView from './components/KycManagement/KycManagementView';
import NotificationManagementView from './components/Notifications/NotificationManagementView';
import SupportView from './components/Support/SupportView';
import TutorialView from './components/Tutorial/TutorialView';
import ComposeView from './components/Compose/ComposeView';
import ClientView from './components/Client/ClientView';
import { supabase } from './lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useRBAC } from './contexts/RBACContext';
import { getGoogleAvatarUrl, isAvatarExplicitlyRemoved } from './utils/avatarHelper';
import { Lock, HelpCircle, X, ShieldAlert, AlertCircle } from 'lucide-react';
import { fetchUserKyc } from './utils/kycService';

import ErrorBoundary from './components/common/ErrorBoundary';
import NotFound from './components/NotFound/NotFound';
import DancingDotsLoader from './components/common/DancingDotsLoader';

function App() {
  const [activePage, setActivePage] = useState(() => {
    const rawPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    const decodedPath = decodeURIComponent(rawPath);
    let path = decodedPath;
    if (path === 'invoice-builder' || path === 'idyll-invoicing' || path === 'idyll invoicing') {
      path = 'idyll-invoicing';
    }
    const validPages = ['dashboard', 'payments', 'payment-details', 'users', 'billing', 'audit', 'admin-panel', 'settings', 'privacy', 'authentication', 'signup', 'login', 'invoice-builder', 'idyll-invoicing', 'idyll invoicing', 'landing', 'profile', 'approval', 'account-verified', 'kyc', 'kyc-management', 'notifications-management', 'support', 'tutorial', 'compose', 'client'];
    // Default any auth, approval, landing, or empty entry paths to 'dashboard'
    if (['', 'approval', 'login', 'signup', 'landing', 'authentication'].includes(path)) {
      return 'dashboard';
    }
    if (validPages.includes(path)) return path;
    return '404';
  });
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userKycStatus, setUserKycStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountDeleted, setIsAccountDeleted] = useState(false);
  const [justVerified, setJustVerified] = useState(() => window.location.hash.includes('type=signup'));
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(() => window.location.hash.includes('type=recovery'));
  const [showAuth, setShowAuth] = useState(window.location.pathname === '/login' || window.location.pathname === '/signup');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(window.location.pathname === '/signup' ? 'signup' : 'login');
  const [toastMessage, setToastMessage] = useState<{ id: number; message: string; type?: string; shake?: boolean; isExiting?: boolean } | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const toastExitTimeoutRef = useRef<any>(null);

  const closeToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    if (toastExitTimeoutRef.current) clearTimeout(toastExitTimeoutRef.current);
    setToastMessage(prev => prev ? { ...prev, isExiting: true } : null);
    toastExitTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 300);
  }, []);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Unsaved changes prompt for Settings
  const unsavedSettingsHandlerRef = useRef<SettingsUnsavedHandlers | null>(null);
  const [unsavedPrompt, setUnsavedPrompt] = useState<{
    targetPage: string;
  } | null>(null);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [isSavingFromPrompt, setIsSavingFromPrompt] = useState(false);

  useEffect(() => {
    if (shakeTrigger > 0 && unsavedPrompt) {
      try {
        const audio = new Audio('/macos-sound-fx-pop.wav');
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn('Audio play prevented or error:', err);
        });
      } catch (e) {
        console.warn('Audio init error:', e);
      }
    }
  }, [shakeTrigger]);

  const isPageLocked = (page: string) => {
    return !['dashboard', 'settings', 'support', 'tutorial', 'client', 'privacy', 'login', 'signup', 'landing', 'approval', 'account-verified', 'authentication', 'account-deleted'].includes(page);
  };

  const isProfileComplete = (user: any): boolean => {
    if (!user) return false;
    const meta = user.user_metadata || {};
    const hasDisplayName = Boolean(meta.full_name && meta.full_name.trim());
    const hasFullName = Boolean(meta.legal_full_name && meta.legal_full_name.trim());
    return hasDisplayName && hasFullName;
  };

  const handlePageChange = (newPage: string) => {
    if (newPage === activePage) return;

    if (activePage === 'settings' && unsavedSettingsHandlerRef.current?.isDirty()) {
      setUnsavedPrompt({ targetPage: newPage });
      setShakeTrigger((prev) => prev + 1);
      return;
    }

    if (session?.user && !isProfileComplete(session.user) && isPageLocked(newPage)) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: 'Please complete your profile settings (Display Name & Full Name) to access this page.',
          type: 'error',
          shake: true
        }
      }));
      return;
    }

    if (!checkAccess(newPage)) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: 'You do not have permission to access this page.',
          type: 'error',
          shake: true
        }
      }));
      return;
    }

    setActivePage(newPage);
  };
  const [showWhyLocked, setShowWhyLocked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(event.target as Node)) {
        setShowHelp(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(() => {
    return localStorage.getItem('unverified_signup_email') || null;
  });

  const { users, hasPermission, canCreateInvoices, updateUser, addUser, isUsersLoaded, currentUser, refreshUsers } = useRBAC();

  useEffect(() => {
    // Check for pending toasts in sessionStorage (for page reloads like logout)
    const pendingToast = sessionStorage.getItem('toastMessage');
    if (pendingToast) {
      setToastMessage({ id: Date.now(), message: pendingToast, type: 'default', shake: false });
      sessionStorage.removeItem('toastMessage');
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
    }

    // Mobile responsiveness check
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);

    // Listen for custom toast events (to avoid reloading the page)
    const handleShowToast = (e: any) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (toastExitTimeoutRef.current) clearTimeout(toastExitTimeoutRef.current);
      const detail = e.detail;
      if (typeof detail === 'object' && detail !== null) {
        const isError = detail.type === 'error' || detail.type === 'red' || detail.color === 'red';
        setToastMessage({
          id: Date.now(),
          message: detail.message || detail.text || '',
          type: isError ? 'error' : (detail.type || 'default'),
          shake: detail.shake ?? isError,
          isExiting: false
        });
      } else {
        setToastMessage({
          id: Date.now(),
          message: String(detail || ''),
          type: 'default',
          shake: false,
          isExiting: false
        });
      }
      const duration = (typeof detail === 'object' && detail?.duration) ? detail.duration : 5000;
      toastTimeoutRef.current = setTimeout(() => closeToast(), duration);
    };
    window.addEventListener('show-toast', handleShowToast);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('show-toast', handleShowToast);
    };
  }, [session]);

  useEffect(() => {
    if (activePage === '404') return;
    const validPages = ['dashboard', 'payments', 'payment-details', 'users', 'billing', 'audit', 'admin-panel', 'settings', 'privacy', 'authentication', 'signup', 'login', 'invoice-builder', 'idyll-invoicing', 'idyll invoicing', 'landing', 'profile', 'approval', 'account-verified', 'kyc', 'kyc-management', 'notifications-management', 'support', 'tutorial', 'compose'];
    if (activePage === 'idyll-invoicing' || activePage === 'idyll invoicing') {
      const currentDecoded = decodeURIComponent(window.location.pathname.replace(/^\/+/, ''));
      if (currentDecoded !== 'idyll-invoicing') {
        window.history.pushState(null, '', '/idyll-invoicing');
      }
    } else if (validPages.includes(activePage)) {
      if (window.location.pathname !== `/${activePage}`) {
        window.history.pushState(null, '', `/${activePage}`);
      }
    }
  }, [activePage]);

  useEffect(() => {
    const handlePopState = () => {
      const rawPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      const decodedPath = decodeURIComponent(rawPath);
      let path = decodedPath;
      if (path === 'invoice-builder' || path === 'idyll-invoicing' || path === 'idyll invoicing') {
        path = 'idyll-invoicing';
      }
      const validPages = ['dashboard', 'payments', 'payment-details', 'users', 'billing', 'audit', 'admin-panel', 'settings', 'privacy', 'authentication', 'signup', 'login', 'invoice-builder', 'idyll-invoicing', 'idyll invoicing', 'landing', 'profile', 'approval', 'account-verified', 'kyc', 'kyc-management', 'notifications-management', 'support', 'tutorial', 'compose'];
      
      const target = (validPages.includes(path) || path === '') ? (path === '' ? 'dashboard' : path) : '404';
      if (activePage === 'settings' && unsavedSettingsHandlerRef.current?.isDirty()) {
        window.history.pushState(null, '', '/settings');
        setUnsavedPrompt({ targetPage: target });
        return;
      }

      if (session && (path === 'landing' || path === 'authentication')) {
        const isApproved = currentUser?.status === 'Approved';
        const targetPage = isApproved ? 'dashboard' : 'approval';
        setActivePage(targetPage);
        window.history.replaceState({}, '', `/${targetPage}`);
        return;
      }

      if (session && !isProfileComplete(session.user) && isPageLocked(path)) {
        setActivePage('dashboard');
        window.history.replaceState({}, '', '/dashboard');
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message: 'Please complete your profile settings (Display Name & Full Name) to access this page.',
            type: 'error',
            shake: true
          }
        }));
        return;
      }

      if (validPages.includes(path) || path === '') {
        if (path === 'login' || path === 'signup') {
          if (session) {
            setActivePage('dashboard');
            window.history.replaceState({}, '', '/dashboard');
          } else {
            setAuthMode(path as 'login' | 'signup');
            setShowAuth(true);
          }
        } else {
          setActivePage(path === '' ? 'dashboard' : path);
        }
      } else {
        setActivePage('404');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activePage, session]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Verify against the backend if the user actually still exists
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          setIsAccountDeleted(true);
          setIsLoading(false);
          return;
        }
      }
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          setIsAccountDeleted(true);
          return;
        }
      }
      setSession(session);
      if (_event === 'PASSWORD_RECOVERY') {
        setShowResetPasswordModal(true);
      }
      if (_event === 'SIGNED_IN') {
        setShowAuth(false);
        const rawPath = window.location.pathname.replace(/^\/+/, '');
        const currentPath = decodeURIComponent(rawPath);
        const authOrLandingPages = ['login', 'signup', 'landing', 'authentication', ''];
        // Only redirect to dashboard if the user was on an auth or landing page
        if (authOrLandingPages.includes(currentPath)) {
          setActivePage('dashboard');
          window.history.replaceState({}, '', '/dashboard');
        }
      }
    });

    const handleHashCheck = () => {
      const hash = window.location.hash;
      if (hash.includes('type=recovery')) {
        setShowResetPasswordModal(true);
      }
      if (hash.includes('type=signup')) {
        setJustVerified(true);
      }
      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const errorDesc = params.get('error_description');
        const errorCode = params.get('error_code');
        if (errorDesc || errorCode) {
          const readableMsg = errorDesc 
            ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
            : 'The verification or authentication link is invalid or has expired.';
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: {
              message: readableMsg,
              type: 'error',
              shake: true
            }
          }));
          // Clean hash from URL so it doesn't linger
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };
    handleHashCheck();
    window.addEventListener('hashchange', handleHashCheck);

    const handleProfileUpdated = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSession(prev => prev ? { ...prev, user } : prev);
      }
    };
    window.addEventListener('profile-updated', handleProfileUpdated);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', handleHashCheck);
      window.removeEventListener('profile-updated', handleProfileUpdated);
    };
  }, []);

  // Fetch KYC status for active user
  useEffect(() => {
    if (session?.user?.id) {
      fetchUserKyc(session.user.id).then(({ record }) => {
        setUserKycStatus(record?.status || null);
      });
    } else {
      setUserKycStatus(null);
    }
  }, [session?.user?.id, activePage]);





  const checkAccess = (page: string) => {
    if (!session) return true;
    if (page === 'dashboard') return hasPermission(session.user.id, 'dashboard');
    if (page === 'admin-panel') return hasPermission(session.user.id, 'admin-panel'); 
    if (page === 'settings') return hasPermission(session.user.id, 'settings');
    if (page === 'kyc') return hasPermission(session.user.id, 'kyc');
    if (page === 'support') return hasPermission(session.user.id, 'support');
    if (page === 'tutorial') return hasPermission(session.user.id, 'tutorial');
    if (page === 'compose') return hasPermission(session.user.id, 'compose');
    if (page === 'client') return hasPermission(session.user.id, 'client');
    if (page === 'kyc-management') return hasPermission(session.user.id, 'kyc-management');
    if (page === 'notifications-management') return hasPermission(session.user.id, 'notifications');
    if (page === 'payments') return hasPermission(session.user.id, 'payments');
    if (page === 'payment-details') return hasPermission(session.user.id, 'payment-details');
    if (page === 'users') return hasPermission(session.user.id, 'users');
    if (page === 'billing') return hasPermission(session.user.id, 'billing');
    if (page === 'audit') return hasPermission(session.user.id, 'audit');
    if (page === 'idyll-invoicing' || page === 'idyll invoicing' || page === 'invoice-builder') {
      return hasPermission(session.user.id, 'payments');
    }
    return true;
  };

  const getFirstAccessiblePage = () => {
    const pageOrder: { page: string; perm: import('./contexts/RBACContext').Permission }[] = [
      { page: 'dashboard', perm: 'dashboard' },
      { page: 'payments', perm: 'payments' },
      { page: 'payment-details', perm: 'payment-details' },
      { page: 'users', perm: 'users' },
      { page: 'billing', perm: 'billing' },
      { page: 'audit', perm: 'audit' },
      { page: 'admin-panel', perm: 'admin-panel' },
      { page: 'kyc', perm: 'kyc' },
      { page: 'kyc-management', perm: 'kyc-management' },
      { page: 'notifications-management', perm: 'notifications' },
      { page: 'compose', perm: 'compose' },
      { page: 'client', perm: 'client' },
      { page: 'tutorial', perm: 'tutorial' },
      { page: 'support', perm: 'support' },
      { page: 'settings', perm: 'settings' },
    ];
    const uid = session?.user?.id;
    const first = pageOrder.find(p => hasPermission(uid, p.perm));
    return first ? first.page : 'dashboard';
  };

  // Sync state to URL & handle redirects
  useEffect(() => {
    if (isLoading) return;
    if (activePage === '404') return;
    
    if (!session) {
      if (unverifiedEmail) {
        window.history.replaceState({}, '', '/authentication');
      } else if (!showAuth && window.location.pathname !== '/privacy') {
        window.history.replaceState({}, '', '/landing');
      }
    } else {
      // Wait for the backend user_roles to load before redirecting or running auto-add logic
      if (!isUsersLoaded) return;

      const isProfileSetupCompleted = session.user.user_metadata?.profile_setup_completed === true;
      const rbacUser = currentUser || users.find(u => u.id === session.user.id);
      let status = rbacUser?.status;
      
      const isAvatarRemoved = isAvatarExplicitlyRemoved(session.user);
      const isGoogle = session.user.app_metadata?.provider === 'google' || session.user.identities?.some((i: any) => i.provider === 'google');
      const googlePfp = isAvatarRemoved ? '' : getGoogleAvatarUrl(session.user);
      
      // If user signed up with Google, cache google_avatar_url in metadata permanently
      if (isGoogle && googlePfp && !session.user.user_metadata?.google_avatar_url) {
        supabase.auth.updateUser({
          data: { google_avatar_url: googlePfp }
        }).catch(console.error);
      }

      // If user signed up with Google, apply Google PFP if not explicitly removed and avatar_url is empty
      if (isGoogle && googlePfp && !isAvatarRemoved && !session.user.user_metadata?.avatar_url) {
        supabase.auth.updateUser({
          data: { avatar_url: googlePfp, google_avatar_url: googlePfp }
        }).catch(console.error);
        if (rbacUser && !rbacUser.avatarUrl) {
          updateUser(session.user.id, { avatarUrl: googlePfp }).catch(console.error);
        }
      }

      // If user exists in auth session but is missing from RBAC/user_roles,
      // register them as Client/Pending (or CEO/Approved if root account) so Admin sees them immediately!
      if (!rbacUser) {
        const isRootAdmin = session.user.email?.trim().toLowerCase() === 'harshidyllproductions@gmail.com';
        const defaultRole = isRootAdmin ? 'CEO' : 'Editor';
        const defaultStatus = isRootAdmin ? 'Approved' : 'Pending';
        addUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email || 'User',
          displayName: session.user.user_metadata?.full_name,
          fullName: session.user.user_metadata?.legal_full_name || session.user.user_metadata?.full_name,
          email: session.user.email || '',
          role: defaultRole,
          status: defaultStatus,
          overrides: {},
          avatarUrl: session.user.user_metadata?.avatar_url || (isGoogle && googlePfp ? googlePfp : undefined),
          requestDate: new Date().toISOString()
        });
        status = defaultStatus;
      }
      
      // 1. Approval Check FIRST: If user is not yet approved, they must wait at /approval (No dashboard visible!)
      if (status !== 'Approved') {
        setActivePage('approval');
        window.history.replaceState({}, '', '/approval');
      } 
      // 2. Profile Setup Check SECOND: Once approved, if they haven't finished onboarding, show /profile
      else if (!isProfileSetupCompleted) {
        if (activePage === 'account-verified') {
          window.history.replaceState({}, '', '/authentication');
        } else {
          setActivePage('profile');
          window.history.replaceState({}, '', '/profile');
        }
      } else {
        // User is Approved: ensure first page / landing page is always accessible
        const currentPath = window.location.pathname.replace(/^\/+/, '');
        const authOrApprovalPages = ['login', 'signup', 'landing', 'authentication', 'approval', 'profile', 'account-verified', ''];
        
        if (authOrApprovalPages.includes(activePage) || authOrApprovalPages.includes(currentPath)) {
          const target = getFirstAccessiblePage();
          setActivePage(target);
          window.history.replaceState({}, '', `/${target}`);
        } else if (!isProfileComplete(session.user) && isPageLocked(activePage)) {
          const target = getFirstAccessiblePage();
          setActivePage(target);
          window.history.replaceState({}, '', `/${target}`);
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: {
              message: 'Please complete your profile settings (Display Name & Full Name) to access this page.',
              type: 'error',
              shake: true
            }
          }));
        } else if (!checkAccess(activePage)) {
          if (activePage === 'dashboard') {
            const target = getFirstAccessiblePage();
            if (target !== 'dashboard') {
              setActivePage(target);
              window.history.replaceState({}, '', `/${target}`);
            }
          }
        }
      }
    }
  }, [showAuth, session, activePage, isLoading, unverifiedEmail, currentUser?.status, currentUser?.role, isUsersLoaded]);

  const handleAddInvoice = () => {
    setEditingInvoiceId(null);
    setActivePage('idyll-invoicing');
  };

  const handleEditInvoice = (id: string) => {
    setEditingInvoiceId(id);
    setActivePage('idyll-invoicing');
  };

  const renderContent = () => {
    if (justVerified) {
      return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <img src="/email_verified_icon.png" alt="Email Verified" style={{ height: '120px', marginBottom: '32px' }} />
          <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '16px', color: '#111827', fontFamily: "'Nohemi', sans-serif" }}>
            Email Verified
          </h2>
          <p style={{ fontSize: '16px', color: '#4B5563', lineHeight: '1.6', marginBottom: '32px' }}>
            Your email has been successfully verified. You can now return back to the workspace.
          </p>
          <button 
            onClick={() => {
              setJustVerified(false);
              localStorage.removeItem('unverified_signup_email');
              // Clean up the hash to prevent re-triggering on refresh
              window.history.replaceState(null, '', window.location.pathname);
            }}
            style={{ backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 32px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111827'}
          >
            Next
          </button>
        </div>
      );
    }

    if (isMobile) {
      return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#111827', fontFamily: "'Nohemi', sans-serif" }}>Mobile View Not Supported</h2>
          <p style={{ fontSize: '15px', color: '#4B5563', lineHeight: '1.6', maxWidth: '400px' }}>
            This website is not designed for mobile. The mobile UI is a little difficult to use and is currently under process. 
            Please access this system using a desktop or PC. We also do not recommend using your browser's "Desktop Mode" on your phone, as it will still be messy.
          </p>
        </div>
      );
    }

    if (activePage === 'privacy') {
      return <PrivacyPolicy onBack={() => {
        window.scrollTo(0, 0);
        if (!session) {
          setActivePage('landing');
          window.history.pushState({}, '', '/landing');
        } else {
          setActivePage('dashboard');
          window.history.pushState({}, '', '/dashboard');
        }
      }} />;
    }

    if (isAccountDeleted) {
      return <AccountDeleted />;
    }

    if (isLoading || (session && !isUsersLoaded)) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-[#F9FAFB]">
          <DancingDotsLoader size={8} color="#000000" gap={6} borderRadius="2px" />
        </div>
      );
    }

    if (activePage === '404') {
      const handleBackToHome = () => {
        if (session) {
          setActivePage('dashboard');
          window.history.pushState({}, '', '/dashboard');
        } else {
          setActivePage('dashboard');
          window.history.pushState({}, '', '/landing');
        }
      };

      return (
        <NotFound
          onBackToHome={handleBackToHome}
          onGoBack={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              handleBackToHome();
            }
          }}
        />
      );
    }

    if (showResetPasswordModal) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-white">
          <ResetPasswordModal
            isOpen={showResetPasswordModal}
            onSuccess={() => {
              setShowResetPasswordModal(false);
              setActivePage('dashboard');
              window.history.replaceState({}, '', '/dashboard');
            }}
            onBackToLogin={async () => {
              setShowResetPasswordModal(false);
              await supabase.auth.signOut();
              setAuthMode('login');
              setShowAuth(true);
              setActivePage('dashboard');
              window.history.replaceState({}, '', '/login');
            }}
            onClose={() => {
              setShowResetPasswordModal(false);
              if (window.history.replaceState) {
                window.history.replaceState(null, '', window.location.pathname);
              }
            }}
          />
        </div>
      );
    }

    if (!session) {
      if (unverifiedEmail) {
        return (
          <AuthenticationView 
            isVerified={false} 
            email={unverifiedEmail} 
            onNext={() => {}} 
            onBackToLogin={() => {
              setUnverifiedEmail(null);
              localStorage.removeItem('unverified_signup_email');
              setShowAuth(true);
              setAuthMode('login');
              window.history.replaceState({}, '', '/login');
            }}
          />
        );
      }
      if (showAuth) {
        return (
          <div className="relative">
            <AuthView 
              initialIsLogin={authMode === 'login'} 
              onBack={() => setShowAuth(false)} 
              onSignupSuccess={(email) => {
                localStorage.setItem('unverified_signup_email', email);
                setUnverifiedEmail(email);
              }}
              onLoginSuccess={() => {
                localStorage.removeItem('unverified_signup_email');
                setShowAuth(false);
                setActivePage('dashboard');
                window.history.replaceState({}, '', '/dashboard');
              }}
            />
          </div>
        );
      }
      return (
        <LandingPage 
          onLoginClick={() => {
            setAuthMode('login');
            setShowAuth(true);
            window.history.pushState({}, '', '/login');
          }} 
          onSignUpClick={() => {
            setAuthMode('signup');
            setShowAuth(true);
            window.history.pushState({}, '', '/signup');
          }}
          onPrivacyClick={() => {
            setActivePage('privacy');
            window.history.pushState({}, '', '/privacy');
          }}
        />
      );
    }

    const isProfileSetupCompleted = session.user.user_metadata?.profile_setup_completed === true;
    const rbacUser = currentUser || users.find(u => u.id === session.user.id);
    const status = rbacUser?.status;

    // 1. Approval Pending (Check FIRST: Unapproved users must never see the dashboard or onboarding)
    if (status !== 'Approved') {
      return (
        <ApprovalWaiting 
          isApproved={false} 
          onEnterWorkspace={() => {}} 
        />
      );
    }

    // 2. Profile Setup Incomplete (Check SECOND: Once approved, guide them through onboarding)
    if (!isProfileSetupCompleted) {
      // Allow them to see "Authentication Successful" if they just clicked the link
      if (activePage === 'account-verified') {
        return (
          <AuthenticationView 
            isVerified={true}
            onNext={() => setActivePage('profile')} 
          />
        );
      }

      return (
        <ProfileOnboarding 
          session={session} 
          onComplete={async () => {
            const { data } = await supabase.auth.refreshSession();
            if (data?.session) {
              setSession(data.session);
            }
            await refreshUsers();
            setActivePage('dashboard');
            window.history.replaceState({}, '', '/dashboard');
          }} 
        />
      );
    }

    // If approved and onboarding complete, transition directly to dashboard if on approval or profile
    if (activePage === 'approval' || activePage === 'profile') {
      setActivePage('dashboard');
      window.history.replaceState({}, '', '/dashboard');
    }

    if (session && !isProfileComplete(session.user) && isPageLocked(activePage)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center', padding: '32px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C', marginBottom: '20px' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Profile Setup Required
          </h2>
          <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: '1.5', marginBottom: '24px' }}>
            Please complete your Display Name and Full Name in Settings to access this page.
          </p>
          <button
            onClick={() => setActivePage('settings')}
            style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
          >
            Complete Profile Settings
          </button>
        </div>
      );
    }

    if (activePage === 'idyll-invoicing' || activePage === 'idyll invoicing' || activePage === 'invoice-builder') {
      const canAccess = hasPermission(session.user.id, 'payments');
      if (!canAccess) return renderAccessDenied();

      // KYC Verification Blocker: Only block if KYC was requested by an admin and is not yet Verified
      const isKycRequested = Boolean(userKycStatus && userKycStatus !== 'Not Requested');
      if (isKycRequested && userKycStatus !== 'Verified') {
        const isActionReq = userKycStatus === 'Action Required' || userKycStatus === 'Resubmission Required';
        const isRej = userKycStatus === 'Rejected';
        const isInProgress = userKycStatus === 'Submitted' || userKycStatus === 'Under Review' || userKycStatus === 'Verification in Progress';

        let kycTitle = 'KYC verification in progress';
        let kycDesc = 'You need to complete KYC verification before creating an invoice.';
        let kycActionBtn = 'View KYC Status';

        if (isActionReq) {
          kycTitle = 'Action Required on KYC Verification';
          kycDesc = 'Action is required on your identity verification. Please resolve the requested changes on your Identity Verification page before creating an invoice.';
          kycActionBtn = 'Resolve KYC';
        } else if (isRej) {
          kycTitle = 'KYC Verification Rejected';
          kycDesc = 'Your identity verification was rejected. Please review the feedback and resubmit your details before creating an invoice.';
          kycActionBtn = 'Resubmit KYC';
        } else if (!isInProgress) {
          kycTitle = 'KYC Verification Required';
          kycDesc = 'KYC verification is required before creating an invoice. Please complete your identity verification to proceed.';
          kycActionBtn = 'Complete KYC';
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%', padding: '40px', textAlign: 'center', backgroundColor: '#F9FAFB' }}>
            <div style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src="/locked-icon.png" alt="Locked" style={{ width: '96px', height: '96px', marginBottom: '28px' }} />
              <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#111827', margin: '0 0 16px 0' }}>
                {kycTitle}
              </h2>
              <p style={{ color: '#6B7280', fontSize: '16px', lineHeight: '1.6', margin: '0 0 32px 0' }}>
                {kycDesc}
              </p>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={() => setActivePage('payments')}
                  style={{ backgroundColor: 'white', color: '#374151', border: '1px solid #E5E7EB', padding: '12px 24px', borderRadius: '8px', fontWeight: '500', fontSize: '15px', cursor: 'pointer' }}
                >
                  Back to Payments
                </button>
                <button
                  onClick={() => setActivePage('kyc')}
                  style={{ backgroundColor: '#111827', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '500', fontSize: '15px', cursor: 'pointer' }}
                >
                  {kycActionBtn}
                </button>
              </div>
            </div>
          </div>
        );
      }
      
      const invoiceCheck = canCreateInvoices(session.user.id);
      
      const formatDisplayDate = (d?: string) => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return d;
      };

      if (!invoiceCheck.allowed) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%', padding: '40px', textAlign: 'center', backgroundColor: '#F9FAFB', position: 'relative' }}>
            <div style={{
              display: 'grid',
              gridTemplateRows: showWhyLocked ? '0fr' : '1fr',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: showWhyLocked ? 0 : 1,
              width: '100%',
              pointerEvents: showWhyLocked ? 'none' : 'auto'
            }}>
              <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src="/locked-icon.png" alt="Locked" style={{ width: '96px', height: '96px', marginBottom: '28px' }} />
                <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#111827', margin: '0 0 16px 0' }}>Invoice Creation Locked</h2>
                {invoiceCheck.reason === 'global_date_future' ? (
                  <p style={{ color: '#6B7280', fontSize: '17px', maxWidth: '480px', lineHeight: '1.6', margin: 0 }}>
                    You cannot create invoices right now. The designated invoice creation period starts on <strong style={{ color: '#D97706' }}>{formatDisplayDate(invoiceCheck.dateNeeded)}</strong> and ends on <strong style={{ color: '#D97706' }}>{formatDisplayDate(invoiceCheck.endDate)}</strong>. Please come back then.
                  </p>
                ) : invoiceCheck.reason === 'global_date_past' ? (
                  <p style={{ color: '#6B7280', fontSize: '17px', maxWidth: '480px', lineHeight: '1.6', margin: 0 }}>
                    The invoice creation period ended on <strong style={{ color: '#D97706' }}>{formatDisplayDate(invoiceCheck.endDate)}</strong>. You can no longer create invoices.
                  </p>
                ) : invoiceCheck.reason === 'no_global_period' ? (
                  <p style={{ color: '#6B7280', fontSize: '17px', maxWidth: '480px', lineHeight: '1.6', margin: 0 }}>
                    Invoice creation is currently locked globally. The finance team has not set an open period.
                  </p>
                ) : (
                  <p style={{ color: '#6B7280', fontSize: '17px', maxWidth: '480px', lineHeight: '1.6', margin: 0 }}>
                    You do not have permission to create invoices.
                  </p>
                )}
                
                <button 
                  onClick={() => setShowWhyLocked(true)}
                  style={{ marginTop: '24px', marginBottom: '24px', backgroundColor: 'transparent', color: '#D97706', border: 'none', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}
                >
                  <HelpCircle size={20} /> Why is Invoice Creation Locked?
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateRows: showWhyLocked ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '100%',
              maxWidth: '650px',
              marginTop: showWhyLocked ? '16px' : '0px'
            }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #E5E7EB', textAlign: 'left', position: 'relative', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
                  <button 
                    onClick={() => setShowWhyLocked(false)}
                    style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={24} color="#6B7280" />
                  </button>
                  <h3 style={{ marginTop: 0, fontSize: '20px', color: '#111827', marginBottom: '20px' }}>Why is Invoice Creation Locked?</h3>
                  <div style={{ fontSize: '16px', color: '#4B5563', display: 'flex', flexDirection: 'column', gap: '16px', lineHeight: '1.6' }}>
                    <p style={{ margin: 0 }}>Invoice creation is available only during specific dates to help us keep payments organized, accurate, and easy to track.</p>
                    <p style={{ margin: 0 }}>Many of our editors work with us on a retainer or ongoing basis. Because of this, payments are not processed separately every time a task or project is completed. Instead, we use a scheduled invoice period where editors can submit their invoices for the work completed during the previous payment cycle.</p>
                    <p style={{ margin: 0 }}>This gives our team enough time to review the work completed, verify the number of tasks or projects delivered, check the applicable rates, and make sure the invoice matches our records. It also helps us avoid duplicate invoices, incorrect amounts, or payments being missed.</p>
                    <p style={{ margin: 0 }}>The invoice creation system is therefore opened for a limited number of days. During this period, you can create and submit your invoice for the applicable work. Once the period ends, invoice creation is temporarily locked while we complete the payment and record-keeping process.</p>
                    <p style={{ margin: 0 }}>This system helps us process payments more consistently and ensures that both you and our team have a clear record of what was completed and what was paid.</p>
                    <p style={{ margin: 0, fontWeight: '500', color: '#111827' }}>Please check the dates shown on this page and return during the next available period to create your invoice.</p>
                  </div>
                </div>
              </div>
            </div>

            {!showWhyLocked && (
              <button 
                onClick={() => setActivePage('payments')}
                style={{ marginTop: '32px', backgroundColor: '#111827', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '500', fontSize: '16px', cursor: 'pointer' }}
              >
                Back to Payments
              </button>
            )}

            <div ref={helpRef} style={{ position: 'absolute', bottom: '32px', right: '32px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
              <div style={{ 
                backgroundColor: 'white', 
                padding: '16px 20px', 
                borderRadius: '12px', 
                border: '1px solid #E5E7EB', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                opacity: showHelp ? 1 : 0,
                visibility: showHelp ? 'visible' : 'hidden',
                transform: showHelp ? 'translateX(0)' : 'translateX(10px)',
                transition: 'all 0.2s ease',
                pointerEvents: showHelp ? 'auto' : 'none',
                maxWidth: '280px',
                textAlign: 'left'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151', fontWeight: '500' }}>For help you can mail to Aarav:</p>
                <a href="mailto:aaravidyllproductions@gmail.com" style={{ color: '#D97706', fontSize: '14px', textDecoration: 'none', fontWeight: '600', wordBreak: 'break-all' }}>
                  aaravidyllproductions@gmail.com
                </a>
              </div>

              <button
                onClick={() => setShowHelp(!showHelp)}
                style={{ 
                  backgroundColor: 'white', 
                  color: '#111827', 
                  padding: '12px 24px', 
                  borderRadius: '8px', 
                  fontWeight: '500', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  border: '1px solid #E5E7EB', 
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  boxShadow: 'none'
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; }}
              >
                <HelpCircle size={18} /> Need Help?
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="h-screen w-full">
          <ErrorBoundary onReset={() => { setActivePage('payments'); setEditingInvoiceId(null); }}>
            <InvoiceBuilder 
              onBack={() => {
                setActivePage('payments');
                setEditingInvoiceId(null);
              }} 
              onInvoiceCreated={() => {
                setActivePage('payments');
                setEditingInvoiceId(null);
              }}
              isAdmin={currentUser?.role === 'CEO' || currentUser?.role === 'CFO' || currentUser?.role === 'Manager'}
              creatorName={currentUser?.name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0]}
              users={users}
              invoiceId={editingInvoiceId}
            />
          </ErrorBoundary>
        </div>
      );
    }

    const hasAccess = checkAccess(activePage);

    return (
      <AppLayout activePage={activePage} onPageChange={handlePageChange}>
        {!hasAccess ? renderAccessDenied() : (
          <>
            {(activePage === 'dashboard' || activePage === 'approval') && <Dashboard onPageChange={handlePageChange} />}
            {activePage === 'payments' && (
              <InvoiceTable 
                onAddInvoice={handleAddInvoice} 
                onEditInvoice={handleEditInvoice}
              />
            )}
            {activePage === 'payment-details' && <PaymentDetailsView />}
            {activePage === 'users' && <UsersView />}
            {activePage === 'billing' && <BillingView />}
            {activePage === 'audit' && <AuditView />}
            {activePage === 'admin-panel' && <AdminPanelView />}
            {activePage === 'settings' && (
              <SettingsView 
                onRegisterUnsavedCheck={(handlers) => {
                  unsavedSettingsHandlerRef.current = handlers;
                }}
              />
            )}
            {activePage === 'kyc' && <Kyc />}
            {activePage === 'kyc-management' && <KycManagementView />}
            {activePage === 'notifications-management' && <NotificationManagementView />}
            {activePage === 'support' && <SupportView />}
            {activePage === 'tutorial' && <TutorialView onNavigate={handlePageChange} />}
            {activePage === 'compose' && <ComposeView />}
            {activePage === 'client' && <ClientView />}
          </>
        )}
      </AppLayout>
    );
  };

  const renderAccessDenied = () => {
    const targetHome = getFirstAccessiblePage();
    const targetLabel = targetHome === 'dashboard' 
      ? 'Go to Dashboard' 
      : `Go to ${targetHome === 'payment-details' ? 'Payment Details' : targetHome === 'notifications-management' ? 'Notifications' : targetHome === 'kyc-management' ? 'KYC Management' : targetHome.charAt(0).toUpperCase() + targetHome.slice(1)}`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-main)' }}>
        <div style={{ backgroundColor: 'var(--md-sys-color-error-container)', padding: '16px', borderRadius: '50%', marginBottom: '24px' }}>
          <Lock size={32} color="var(--md-sys-color-error)" />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '400px', marginBottom: '20px' }}>
          You do not have permission to view this page. If you believe this is a mistake, please contact your workspace finance team.
        </p>
        <button
          onClick={() => handlePageChange(targetHome)}
          style={{
            backgroundColor: '#111827',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111827'}
        >
          {targetLabel}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {renderContent()}
      
      {/* Global Toast */}
      {toastMessage && (
        <div 
          key={toastMessage.id}
          role="alert"
          style={{
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            backgroundColor: toastMessage.type === 'error' ? '#DC2626' : '#18181B',
            color: '#FFFFFF',
            padding: '16px 56px 16px 24px',
            textAlign: 'center',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.15)',
            fontSize: '15px',
            fontWeight: '600',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            animation: toastMessage.isExiting
              ? 'slideOutToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              : (toastMessage.shake 
                  ? 'slideInAndShake 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards' 
                  : 'slideInToast 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'),
            border: 'none',
            outline: 'none'
          }}
        >
          {toastMessage.type === 'error' && (
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertCircle size={16} color="#FFFFFF" />
            </div>
          )}
          <span>{toastMessage.message}</span>
          <button
            type="button"
            onClick={closeToast}
            aria-label="Close notification"
            style={{
              position: 'absolute',
              right: '18px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              outline: 'none',
              boxShadow: 'none'
            }}
          >
            <X size={20} color="#000000" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Global Animation Keyframes for Toasts */}
      <style>{`
        @keyframes slideInToast {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes slideOutToast {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(100%);
            opacity: 0;
          }
        }
        @keyframes slideInAndShake {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          30% {
            transform: translateY(0);
            opacity: 1;
          }
          45% { transform: translateY(0) translateX(-12px); }
          60% { transform: translateY(0) translateX(12px); }
          75% { transform: translateY(0) translateX(-6px); }
          88% { transform: translateY(0) translateX(6px); }
          100% { transform: translateY(0) translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Red Toast Notification for Unsaved Changes in Settings (Full-width bottom bar, no shadow, no glow) */}
      {unsavedPrompt && (
        <div 
          key={shakeTrigger}
          role="alert"
          style={{
            position: 'fixed',
            bottom: '0',
            left: '-24px',
            right: '-24px',
            width: 'calc(100% + 48px)',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            borderRadius: '0',
            padding: '14px 24px',
            boxShadow: 'none',
            zIndex: 99999,
            animation: shakeTrigger > 1
              ? 'errorShake 0.42s cubic-bezier(0.22, 1, 0.36, 1)'
              : 'slideUpAndShake 0.48s cubic-bezier(0.22, 1, 0.36, 1)',
            border: 'none',
            outline: 'none'
          }}
        >
          <div style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertCircle size={20} color="#FFFFFF" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#FFFFFF', letterSpacing: '-0.1px' }}>
                  Unsaved Changes:
                </span>
                <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.95)', fontWeight: '400' }}>
                  You have unsaved changes in Settings. Do you want to save them?
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <button
                type="button"
                disabled={isSavingFromPrompt}
                onClick={async () => {
                  if (isSavingFromPrompt) return;
                  setIsSavingFromPrompt(true);
                  const success = await unsavedSettingsHandlerRef.current?.save();
                  setIsSavingFromPrompt(false);
                  if (success) {
                    const target = unsavedPrompt.targetPage;
                    setUnsavedPrompt(null);
                    setShakeTrigger(0);
                    setActivePage(target);
                  }
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#DC2626',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isSavingFromPrompt ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: 'none',
                  outline: 'none',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => { if (!isSavingFromPrompt) e.currentTarget.style.backgroundColor = '#FEE2E2'; }}
                onMouseLeave={(e) => { if (!isSavingFromPrompt) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                {isSavingFromPrompt ? (
                  <>
                    <div style={{ width: 12, height: 12, border: '2px solid #DC2626', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Saving...
                  </>
                ) : (
                  'Yes, Save'
                )}
              </button>

              <button
                type="button"
                disabled={isSavingFromPrompt}
                onClick={() => {
                  if (isSavingFromPrompt) return;
                  unsavedSettingsHandlerRef.current?.discard();
                  const target = unsavedPrompt.targetPage;
                  setUnsavedPrompt(null);
                  setShakeTrigger(0);
                  setActivePage(target);
                }}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  boxShadow: 'none',
                  outline: 'none',
                  cursor: isSavingFromPrompt ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => { if (!isSavingFromPrompt) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'; }}
                onMouseLeave={(e) => { if (!isSavingFromPrompt) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'; }}
              >
                No, Discard
              </button>
            </div>
          </div>
          <style>{`
            @keyframes slideUpAndShake {
              0% { transform: translateY(100%) translateX(0); }
              15% { transform: translateY(60%) translateX(-12px); }
              30% { transform: translateY(30%) translateX(12px); }
              45% { transform: translateY(12%) translateX(-10px); }
              60% { transform: translateY(3%) translateX(10px); }
              72% { transform: translateY(0) translateX(-6px); }
              82% { transform: translateY(0) translateX(6px); }
              90% { transform: translateY(0) translateX(-3px); }
              96% { transform: translateY(0) translateX(3px); }
              100% { transform: translateY(0) translateX(0); }
            }
            @keyframes errorShake {
              0% { transform: translateX(0); }
              15% { transform: translateX(-12px); }
              30% { transform: translateX(12px); }
              45% { transform: translateX(-10px); }
              60% { transform: translateX(10px); }
              75% { transform: translateX(-6px); }
              85% { transform: translateX(6px); }
              92% { transform: translateX(-3px); }
              97% { transform: translateX(3px); }
              100% { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default App;
