import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LayoutDashboard, FileText, Receipt, Users, CreditCard, BarChart3, Settings, ChevronUp, AppWindow, LogOut, Moon, X, ShieldCheck, FileBadge, UserCheck, Bell, LifeBuoy, PenSquare, Lock, Video } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useRBAC } from '../../contexts/RBACContext';
import styles from './Sidebar.module.css';
import idyllLogoApp from '../../assets/IdyllTrackLogoApp.svg';
import { getFirstLetterOfFirstName, getGoogleAvatarUrl, isAvatarExplicitlyRemoved } from '../../utils/avatarHelper';
import { fetchUserKyc } from '../../utils/kycService';

interface SidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, onPageChange }) => {
  const sidebarRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isPdfAvatar, setIsPdfAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isKycRequested, setIsKycRequested] = useState(false);
  const [kycStatusText, setKycStatusText] = useState<string>('');
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const { hasPermission, users, currentUser } = useRBAC();

  const activeName = currentUser?.name || userName;
  const activeAvatar = (currentUser?.avatarUrl !== undefined && currentUser?.avatarUrl !== '') 
    ? currentUser.avatarUrl 
    : avatarUrl;
  const activeEmail = currentUser?.email || userEmail;
  const activeUserId = currentUser?.id || userId;

  const pendingUsersCount = users.filter(u => u.status === 'Pending').length;

  const checkUserKycStatus = async (uid: string) => {
    if (!uid) return;
    try {
      const { record } = await fetchUserKyc(uid);
      const requested = record?.status === 'Requested' || record?.status === 'Action Required' || record?.status === 'Resubmission Required';
      setIsKycRequested(Boolean(requested));
      setKycStatusText(record?.status || '');
    } catch (err) {
      console.warn('[Sidebar] Error fetching KYC status:', err);
    }
  };

  useEffect(() => {
    let currentUid: string | null = null;

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentUid = user.id;
        setUserId(user.id);
        setUserEmail(user.email || '');
        checkUserKycStatus(user.id);
        // Default to a name derived from email if metadata name doesn't exist
        if (user.user_metadata && user.user_metadata.full_name) {
          setUserName(user.user_metadata.full_name);
        } else if (user.email) {
          const parts = user.email.split('@')[0].split(/[._-]/);
          const name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          setUserName(name);
        }

        const googleAvatar = getGoogleAvatarUrl(user);
        const isAvatarRemoved = isAvatarExplicitlyRemoved(user);
        const resolvedAvatar = isAvatarRemoved
          ? ''
          : ((user.user_metadata && typeof user.user_metadata.avatar_url === 'string' && user.user_metadata.avatar_url)
              ? user.user_metadata.avatar_url
              : googleAvatar);
        setAvatarUrl(resolvedAvatar || '');

        const isPdf = Boolean(
          user.user_metadata?.document_type?.includes('pdf') ||
          (user.user_metadata?.document_name && String(user.user_metadata.document_name).toLowerCase().endsWith('.pdf')) ||
          (typeof resolvedAvatar === 'string' && resolvedAvatar.split('?')[0].toLowerCase().endsWith('.pdf'))
        );
        setIsPdfAvatar(isPdf);
        setAvatarError(false);

        // Check if profile setup (Display Name & Full Name) is complete
        const meta = user.user_metadata || {};
        const hasDisplayName = Boolean(meta.full_name && meta.full_name.trim());
        const hasFullName = Boolean(meta.legal_full_name && meta.legal_full_name.trim());
        const complete = hasDisplayName && hasFullName;
        setIsProfileIncomplete(!complete);
      }
    };

    fetchUser();

    const handleKycStatusChange = () => {
      if (currentUid) {
        checkUserKycStatus(currentUid);
      } else {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            currentUid = user.id;
            checkUserKycStatus(user.id);
          }
        });
      }
    };

    window.addEventListener('profile-updated', fetchUser);
    window.addEventListener('kyc-status-updated', handleKycStatusChange);

    const kycChannel = supabase
      .channel('sidebar-kyc-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_records' }, () => {
        handleKycStatusChange();
      })
      .subscribe();

    return () => {
      window.removeEventListener('profile-updated', fetchUser);
      window.removeEventListener('kyc-status-updated', handleKycStatusChange);
      supabase.removeChannel(kycChannel);
    };
  }, []);

  useEffect(() => {
    const sidebarEl = sidebarRef.current;
    const navEl = navRef.current;
    if (!sidebarEl || !navEl) return;

    const handleWheel = (e: WheelEvent) => {
      // When cursor is inside the sidebar, scroll the sidebar's nav and prevent the outer page from scrolling
      if (navEl.scrollHeight > navEl.clientHeight) {
        navEl.scrollTop += e.deltaY;
        e.preventDefault();
      }
    };

    sidebarEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      sidebarEl.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    sessionStorage.setItem('toastMessage', 'Logged out successfully');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Sidebar] Sign out error:', err);
    }
    window.location.href = '/login';
  };

  const isPageLocked = (pageId: string) => {
    if (!isProfileIncomplete) return false;
    return !['dashboard', 'settings', 'support', 'tutorial'].includes(pageId);
  };

  const handleNavClick = (pageId: string) => {
    if (isPageLocked(pageId)) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: 'Please complete your profile settings (Display Name & Full Name) to access this page.',
          type: 'error',
          shake: true
        }
      }));
      return;
    }

    const permMap: Record<string, import('../../contexts/RBACContext').Permission> = {
      dashboard: 'dashboard',
      payments: 'payments',
      'payment-details': 'payment-details',
      users: 'users',
      billing: 'billing',
      audit: 'audit',
      'admin-panel': 'admin-panel',
      kyc: 'kyc',
      'kyc-management': 'kyc-management',
      'notifications-management': 'notifications',
      compose: 'compose',
      tutorial: 'tutorial',
      support: 'support',
      settings: 'settings',
    };

    const requiredPerm = permMap[pageId];
    if (requiredPerm && !hasPermission(activeUserId, requiredPerm)) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: 'You do not have permission to access this page.',
          type: 'error',
          shake: true
        }
      }));
      return;
    }

    onPageChange(pageId);
  };

  return (
    <aside ref={sidebarRef} className={styles.sidebar}>
      <div className={styles.logoContainer} style={{ position: 'relative' }}>
        <div className={styles.logo} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src={idyllLogoApp} alt="Logo" style={{ height: '44px' }} />
          <h2 style={{ fontFamily: "'Nohemi', sans-serif", fontSize: '1.15rem', fontWeight: '500', margin: 0, color: '#1a1a1a', lineHeight: 1.2 }}>Idyll Tracks<br />Payments</h2>
        </div>
      </div>

      <nav ref={navRef} className={styles.nav}>
        <ul className={styles.navList}>
          {hasPermission(activeUserId, 'dashboard') && (
            <li
              className={`${styles.navItem} ${activePage === 'dashboard' ? styles.active : ''}`}
              onClick={() => handleNavClick('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </li>
          )}
          {hasPermission(activeUserId, 'payments') && (
            <li
              className={`${styles.navItem} ${activePage === 'payments' ? styles.active : ''} ${isPageLocked('payments') ? styles.locked : ''}`}
              onClick={() => handleNavClick('payments')}
            >
              <FileText size={18} />
              <span style={{ flex: 1 }}>Invoices</span>
              {isPageLocked('payments') && <Lock size={14} className={styles.lockedIcon} />}
            </li>
          )}
          {hasPermission(activeUserId, 'payment-details') && (
            <li
              className={`${styles.navItem} ${activePage === 'payment-details' ? styles.active : ''} ${isPageLocked('payment-details') ? styles.locked : ''}`}
              onClick={() => handleNavClick('payment-details')}
            >
              <Receipt size={18} />
              <span style={{ flex: 1 }}>Payments details</span>
              {isPageLocked('payment-details') && <Lock size={14} className={styles.lockedIcon} />}
            </li>
          )}
          {hasPermission(activeUserId, 'users') && (
            <li
              className={`${styles.navItem} ${activePage === 'users' ? styles.active : ''} ${isPageLocked('users') ? styles.locked : ''}`}
              onClick={() => handleNavClick('users')}
            >
              <Users size={18} />
              <span style={{ flex: 1 }}>Users</span>
              {isPageLocked('users') ? (
                <Lock size={14} className={styles.lockedIcon} />
              ) : (
                pendingUsersCount > 0 && (
                  <span
                    className={styles.blackBadge}
                    title={`${pendingUsersCount} pending approval${pendingUsersCount > 1 ? 's' : ''}`}
                  >
                    {pendingUsersCount}
                  </span>
                )
              )}
            </li>
          )}
          {hasPermission(activeUserId, 'billing') && (
            <li
              className={`${styles.navItem} ${activePage === 'billing' ? styles.active : ''} ${isPageLocked('billing') ? styles.locked : ''}`}
              onClick={() => handleNavClick('billing')}
            >
              <CreditCard size={18} />
              <span style={{ flex: 1 }}>Billing</span>
              {isPageLocked('billing') && <Lock size={14} className={styles.lockedIcon} />}
            </li>
          )}
          {hasPermission(activeUserId, 'audit') && (
            <li
              className={`${styles.navItem} ${activePage === 'audit' ? styles.active : ''} ${isPageLocked('audit') ? styles.locked : ''}`}
              onClick={() => handleNavClick('audit')}
            >
              <BarChart3 size={18} />
              <span style={{ flex: 1 }}>Reports (Audit)</span>
              {isPageLocked('audit') && <Lock size={14} className={styles.lockedIcon} />}
            </li>
          )}
          {hasPermission(activeUserId, 'admin-panel') && (
            <li
              className={`${styles.navItem} ${activePage === 'admin-panel' ? styles.active : ''} ${isPageLocked('admin-panel') ? styles.locked : ''}`}
              onClick={() => handleNavClick('admin-panel')}
            >
              <ShieldCheck size={18} />
              <span style={{ flex: 1 }}>Admin Panel</span>
              {isPageLocked('admin-panel') && <Lock size={14} className={styles.lockedIcon} />}
            </li>
          )}
          {hasPermission(activeUserId, 'kyc') && (
            <li
              className={`${styles.navItem} ${activePage === 'kyc' ? styles.active : ''} ${isKycRequested && !isPageLocked('kyc') ? styles.kycRequested : ''} ${isPageLocked('kyc') ? styles.locked : ''}`}
              onClick={() => handleNavClick('kyc')}
              title={isPageLocked('kyc') ? 'Complete profile settings to access KYC' : (isKycRequested ? 'KYC Verification Requested by Finance Team' : 'KYC')}
            >
              <FileBadge size={18} />
              <span style={{ flex: 1 }}>KYC</span>
              {isPageLocked('kyc') ? (
                <Lock size={14} className={styles.lockedIcon} />
              ) : (
                isKycRequested && (
                  <span className={styles.kycRequestedBadge}>
                    {kycStatusText === 'Action Required' ? 'Action Req.' : kycStatusText === 'Resubmission Required' ? 'Resubmit' : 'Requested'}
                  </span>
                )
              )}
            </li>
          )}
          {hasPermission(activeUserId, 'kyc-management') && (
            <li
              className={`${styles.navItem} ${activePage === 'kyc-management' ? styles.active : ''} ${isPageLocked('kyc-management') ? styles.locked : ''}`}
              onClick={() => handleNavClick('kyc-management')}
            >
              <UserCheck size={18} />
              <span style={{ flex: 1 }}>KYC Management</span>
              {isPageLocked('kyc-management') && <Lock size={14} className={styles.lockedIcon} />}
            </li>
          )}
          {hasPermission(activeUserId, 'notifications') && (
            <li
              className={`${styles.navItem} ${activePage === 'notifications-management' ? styles.active : ''} ${isPageLocked('notifications-management') ? styles.locked : ''}`}
              onClick={() => handleNavClick('notifications-management')}
            >
              <Bell size={18} />
              <span style={{ flex: 1 }}>Notifications</span>
              {isPageLocked('notifications-management') && <Lock size={14} className={styles.lockedIcon} />}
            </li>
          )}
          {hasPermission(activeUserId, 'compose') && (
            <li
              className={`${styles.navItem} ${activePage === 'compose' ? styles.active : ''} ${isPageLocked('compose') ? styles.locked : ''}`}
              onClick={() => handleNavClick('compose')}
            >
              <PenSquare size={18} />
              <span style={{ flex: 1 }}>Compose</span>
              {isPageLocked('compose') && <Lock size={14} className={styles.lockedIcon} />}
            </li>
          )}
        </ul>
      </nav>

      <div className={styles.bottomSection}>
        <ul className={styles.navList}>
          {hasPermission(activeUserId, 'tutorial') && (
            <li
              className={`${styles.navItem} ${activePage === 'tutorial' ? styles.active : ''}`}
              onClick={() => handleNavClick('tutorial')}
            >
              <Video size={18} />
              <span>Tutorial</span>
            </li>
          )}
          {hasPermission(activeUserId, 'support') && (
            <li
              className={`${styles.navItem} ${activePage === 'support' ? styles.active : ''}`}
              onClick={() => handleNavClick('support')}
            >
              <LifeBuoy size={18} />
              <span>Support</span>
            </li>
          )}
          {hasPermission(activeUserId, 'settings') && (
            <li
              className={`${styles.navItem} ${activePage === 'settings' ? styles.active : ''} ${isProfileIncomplete ? styles.settingsPending : ''}`}
              onClick={() => handleNavClick('settings')}
            >
              <Settings size={18} />
              <span>Settings</span>
            </li>
          )}
          <li
            className={styles.navItem}
            onClick={handleLogoutClick}
            style={{ cursor: 'pointer' }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </li>

        </ul>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '20px 0 16px 0' }} />

        <div
          className={styles.userProfile}
          onClick={() => {
            if (hasPermission(activeUserId, 'settings')) {
              onPageChange('settings');
            } else {
              window.dispatchEvent(new CustomEvent('show-toast', {
                detail: {
                  message: 'You do not have permission to access Settings.',
                  type: 'error',
                  shake: true
                }
              }));
            }
          }}
          title={hasPermission(activeUserId, 'settings') ? "Account Settings" : "User Profile"}
          role="button"
          tabIndex={0}
        >
          <div className={styles.avatar} style={{ flexShrink: 0, backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border-default)', fontWeight: 'bold', overflow: 'hidden' }}>
            {activeAvatar && isPdfAvatar ? (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={20} color="#DC2626" />
              </div>
            ) : activeAvatar && !avatarError ? (
              <img
                src={activeAvatar}
                alt="Avatar"
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              activeName.charAt(0)
            )}
          </div>
          <div className={styles.userInfo} style={{ overflow: 'hidden', minWidth: 0 }}>
            <span className={styles.userName} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
              {activeName}
            </span>
            <span className={styles.userEmail} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>{activeEmail}</span>
          </div>
        </div>
      </div>

      {showLogoutConfirm && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={() => setShowLogoutConfirm(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '24px', borderRadius: '8px', width: '340px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogOut size={18} color="#DC2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Logout</h3>
            </div>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to log out of your account?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: 'white', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
};

export default Sidebar;
