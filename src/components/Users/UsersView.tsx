import React, { useState, useEffect } from 'react';
import { Trash2, Check, X, ChevronDown, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useRBAC } from '../../contexts/RBACContext';
import type { Role } from '../../contexts/RBACContext';
import styles from './UsersView.module.css';
import { getFirstLetterOfFirstName, getGoogleAvatarUrl, isAvatarExplicitlyRemoved } from '../../utils/avatarHelper';
import { sendUserAccountApprovedEmail, sendUserRoleUpdatedEmail } from '../../utils/emailService';

const LOCKED_USER_EMAIL = 'harshidyllproductions@gmail.com';
const isUserLocked = (email?: string | null) => 
  email?.trim().toLowerCase() === LOCKED_USER_EMAIL;

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
}
// Pending users will now be derived from RBACContext

const UsersView: React.FC = () => {
  const { users: rbacUsers, updateUser, addUser, removeUser } = useRBAC();
  const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Sync current user to RBAC just in case they are missing
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name || 'Current User';
        const isAvatarRemoved = isAvatarExplicitlyRemoved(user);
        const googleAvatar = isAvatarRemoved ? '' : getGoogleAvatarUrl(user);
        const avatarUrl = isAvatarRemoved
          ? ''
          : (user.user_metadata?.avatar_url || user.user_metadata?.picture || googleAvatar);
        const existingRbacUser = rbacUsers.find(u => u.id === user.id);
        
        if (!existingRbacUser) {
           addUser({ 
             id: user.id, 
             name, 
             email: user.email || '', 
             role: 'CEO', 
             overrides: {},
             status: 'Approved',
             avatarUrl: avatarUrl || undefined
           });
        } else {
           const currentName = existingRbacUser.name || '';
           const targetName = user.user_metadata?.full_name || '';
           const currentAvatar = existingRbacUser.avatarUrl || '';
           const targetAvatar = avatarUrl || '';
           const needsNameSync = targetName && targetName !== currentName;
           const needsAvatarSync = targetAvatar && targetAvatar !== currentAvatar;
           if (needsNameSync || needsAvatarSync) {
             const updates: any = {};
             if (needsNameSync) updates.name = targetName;
             if (needsAvatarSync) updates.avatarUrl = targetAvatar;
             updateUser(user.id, updates);
           }
        }
      }
      setIsLoading(false);
    };
    
    fetchUser();
  }, [rbacUsers, addUser, updateUser]);

  const [processingAction, setProcessingAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);

  const activeUsers = [...rbacUsers.filter(u => u.status === 'Approved')].sort((a, b) => {
    const dateA = a.createdAt || a.requestDate || '';
    const dateB = b.createdAt || b.requestDate || '';
    if (dateA && dateB && dateA !== dateB) return dateA.localeCompare(dateB);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.id.localeCompare(b.id);
  });

  const pendingUsers = [...rbacUsers.filter(u => u.status === 'Pending' || u.status === 'Rejected')].sort((a, b) => {
    const dateA = a.requestDate || a.createdAt || '';
    const dateB = b.requestDate || b.createdAt || '';
    if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.id.localeCompare(b.id);
  });

  const pendingCount = rbacUsers.filter(u => u.status === 'Pending').length;

  const handleRoleChange = async (userId: string, newRole: Role) => {
    const targetUser = rbacUsers.find(u => u.id === userId);
    if (isUserLocked(targetUser?.email)) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'This primary account is locked and its role cannot be modified.' }));
      return;
    }
    const res = await updateUser(userId, { role: newRole });
    if (res.success) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Role updated to ${newRole}` }));
      if (targetUser?.email) {
        sendUserRoleUpdatedEmail({
          to: targetUser.email,
          userName: targetUser.name || targetUser.email.split('@')[0],
          newRole
        }).catch(err => console.warn('[UsersView] Error sending role updated email:', err));
      }
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: res.error || 'Failed to update role' }));
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete || isDeleting) return;
    const targetUser = rbacUsers.find(u => u.id === userToDelete);
    if (isUserLocked(targetUser?.email)) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'This user ID is locked and cannot be removed from here. It should be removed only from the database.' }));
      setUserToDelete(null);
      return;
    }
    setIsDeleting(true);
    try {
      const res = await removeUser(userToDelete);
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'User permanently deleted from database' }));
        setUserToDelete(null);
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: res.error || 'Failed to delete user from database' }));
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: err?.message || 'Error deleting user' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const approveUser = async (id: string) => {
    if (processingAction) return;
    setProcessingAction({ id, action: 'approve' });
    try {
      const result = await updateUser(id, { status: 'Approved' });
      if (result && result.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'User approved successfully' }));
        const targetUser = rbacUsers.find(u => u.id === id);
        if (targetUser?.email) {
          sendUserAccountApprovedEmail({
            to: targetUser.email,
            userName: targetUser.name || targetUser.email.split('@')[0]
          }).catch(err => console.warn('[UsersView] Error sending user approved email:', err));
        }
      } else {
        const errorMsg = result?.error || 'Failed to approve user. Please try again.';
        window.dispatchEvent(new CustomEvent('show-toast', { detail: errorMsg }));
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: err?.message || 'An error occurred while approving user.' }));
    } finally {
      setProcessingAction(null);
    }
  };

  const rejectUser = async (id: string) => {
    if (processingAction) return;
    setProcessingAction({ id, action: 'reject' });
    try {
      const result = await updateUser(id, { status: 'Rejected' });
      if (result && result.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'User request rejected' }));
      } else {
        const errorMsg = result?.error || 'Failed to reject user request.';
        window.dispatchEvent(new CustomEvent('show-toast', { detail: errorMsg }));
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: err?.message || 'An error occurred while rejecting request.' }));
    } finally {
      setProcessingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <div style={{ width: '240px', height: '32px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            <div style={{ width: '360px', height: '20px', backgroundColor: '#F3F4F6', borderRadius: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
          </div>
        </div>

        <div className={styles.userList}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#F3F4F6' }} />
                <div>
                  <div style={{ width: '120px', height: '20px', backgroundColor: '#F3F4F6', borderRadius: '4px', marginBottom: '6px' }} />
                  <div style={{ width: '160px', height: '16px', backgroundColor: '#F3F4F6', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: '70px', height: '24px', backgroundColor: '#F3F4F6', borderRadius: '12px' }} />
                <div style={{ width: '24px', height: '24px', backgroundColor: '#F3F4F6', borderRadius: '6px' }} />
              </div>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
        `}</style>
      </div>
    );
  }


  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Workspace Users</h1>
          <p className={styles.pageSubtitle}>Manage access and roles for all members in your workspace.</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'active' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Users
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'pending' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <span>Pending Approvals</span>
          {pendingCount > 0 && <span className={styles.badge}>{pendingCount}</span>}
        </button>
      </div>

      {activeTab === 'active' && (
        <div className={styles.userList}>
          {activeUsers.map(user => {
            const isLocked = isUserLocked(user.email);
            return (
              <div key={user.id} className={styles.userCard}>
                <div className={styles.userInfo}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} referrerPolicy="no-referrer" className={styles.avatar} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#E5E7EB',
                      color: '#111827',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px',
                      fontWeight: '600',
                      border: '1px solid #D1D5DB',
                      flexShrink: 0
                    }}>
                      {getFirstLetterOfFirstName(user.name, user.email)}
                    </div>
                  )}
                  <div>
                    <div className={styles.userName}>{user.name}</div>
                    <div className={styles.userEmail}>{user.email}</div>
                  </div>
                </div>
                
                <div className={styles.actions}>
                  <div className={styles.roleDropdownContainer}>
                    {isLocked ? (
                      <div 
                        className={styles.roleBtn} 
                        style={{ cursor: 'default', opacity: 0.9 }}
                        title="Primary account role is locked"
                      >
                        <span>{user.role}</span>
                      </div>
                    ) : (
                      <button 
                        className={styles.roleBtn}
                        onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)}
                      >
                        <span>{user.role}</span>
                        <ChevronDown size={14} className={styles.roleChevron} />
                      </button>
                    )}
                    
                    {!isLocked && openDropdownId === user.id && (
                      <>
                        <div 
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} 
                          onClick={() => setOpenDropdownId(null)}
                        />
                        <div className={styles.roleMenu}>
                          {['CEO', 'CFO', 'Manager', 'Editor', 'Client'].map((roleOption) => (
                            <div 
                              key={roleOption}
                              onClick={() => {
                                handleRoleChange(user.id, roleOption as Role);
                                setOpenDropdownId(null);
                              }}
                              className={`${styles.roleMenuItem} ${user.role === roleOption ? styles.roleMenuItemActive : ''}`}
                            >
                              {roleOption}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {isLocked ? (
                    <div 
                      className={styles.lockedAction} 
                      title="This user ID is locked and cannot be removed from here. It should be removed only from the database."
                    >
                      <Lock size={13} />
                      <span>Locked</span>
                    </div>
                  ) : (
                    <button 
                      className={styles.deleteBtn} 
                      onClick={() => setUserToDelete(user.id)}
                      title="Remove User"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {activeUsers.length === 0 && (
            <div className={styles.emptyState}>
              No users left in this workspace.
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className={styles.userList}>
          {pendingUsers.map(user => {
            const isLocked = isUserLocked(user.email);
            return (
              <div key={user.id} className={styles.userCard}>
                <div className={styles.userInfo}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} referrerPolicy="no-referrer" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#E5E7EB',
                      color: '#111827',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: '600',
                      border: '1px solid #D1D5DB',
                      flexShrink: 0
                    }}>
                      {getFirstLetterOfFirstName(user.name, user.email)}
                    </div>
                  )}
                  <div>
                    <div className={styles.userName}>
                      {user.name} 
                      {user.status === 'Rejected' && (
                        <span style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: '#FEF2F2', color: '#EF4444', fontSize: '12px', borderRadius: '12px', fontWeight: '500' }}>Rejected</span>
                      )}
                    </div>
                    <div className={styles.userEmail}>{user.email} <span style={{ color: '#9CA3AF', fontSize: '13px', marginLeft: '8px' }}>• Requested {user.requestDate || 'recently'}</span></div>
                  </div>
                </div>
                
                <div className={styles.actions}>
                  {user.status !== 'Rejected' && !isLocked && (
                    <button 
                      className={styles.rejectBtn} 
                      onClick={() => rejectUser(user.id)}
                      disabled={processingAction?.id === user.id}
                      title="Reject Request"
                    >
                      {processingAction?.id === user.id && processingAction.action === 'reject' ? (
                        <>
                          <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <X size={16} /> Reject
                        </>
                      )}
                    </button>
                  )}
                  <button 
                    className={styles.approveBtn} 
                    onClick={() => approveUser(user.id)}
                    disabled={processingAction?.id === user.id}
                    title="Approve Request"
                  >
                    {processingAction?.id === user.id && processingAction.action === 'approve' ? (
                      <>
                        <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                        Approving...
                      </>
                    ) : (
                      <>
                        <Check size={16} /> Approve
                      </>
                    )}
                  </button>

                  {!isLocked && (
                    <button 
                      className={styles.deleteActionBtn} 
                      onClick={() => setUserToDelete(user.id)}
                      disabled={processingAction?.id === user.id}
                      title="Delete User"
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {pendingUsers.length === 0 && (
            <div className={styles.emptyState}>
              No pending approvals at the moment.
            </div>
          )}
        </div>
      )}

      {userToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '440px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>Remove User</h3>
            <p style={{ margin: '0 0 24px 0', color: '#4B5563', fontSize: '14px' }}>Are you sure you want to remove this user from your workspace? They will lose all access immediately.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', cursor: isDeleting ? 'not-allowed' : 'pointer', fontWeight: '500' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: 'white', cursor: isDeleting ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: isDeleting ? 0.7 : 1 }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersView;
