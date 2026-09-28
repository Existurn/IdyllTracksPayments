import React, { useState } from 'react';
import { Settings, Users as UsersIcon, Shield, Search, X, Calendar, Mail, Info } from 'lucide-react';
import { useRBAC } from '../../contexts/RBACContext';
import type { Role, Permission, UserRBAC } from '../../contexts/RBACContext';
import styles from './AdminPanelView.module.css';
import { logAction } from '../../utils/auditLogger';
import { sendUserAccountApprovedEmail } from '../../utils/emailService';

const PERMISSIONS_LIST: { id: Permission, label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'payments', label: 'Invoices' },
  { id: 'payment-details', label: 'Payments details' },
  { id: 'users', label: 'Users' },
  { id: 'billing', label: 'Billing' },
  { id: 'audit', label: 'Reports (Audit)' },
  { id: 'admin-panel', label: 'Admin Panel' },
  { id: 'kyc', label: 'KYC' },
  { id: 'kyc-management', label: 'KYC Management' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'compose', label: 'Compose' },
  { id: 'client', label: 'Client' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'support', label: 'Support' },
  { id: 'settings', label: 'Settings' },
  { id: 'create-invoices', label: 'Create Invoices (Sub-permission)' },
];

const ROLES_LIST: Role[] = ['CEO', 'CFO', 'Manager', 'Editor', 'Client'];

const RectangularToggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    className={`${styles.rectToggle} ${checked ? styles.rectToggleOn : styles.rectToggleOff} ${disabled ? styles.rectToggleDisabled : ''}`}
    onClick={onChange}
  >
    <div className={`${styles.rectToggleThumb} ${checked ? styles.rectToggleThumbOn : styles.rectToggleThumbOff}`} />
  </button>
);

const AdminPanelView: React.FC = () => {
  const { globalInvoicePeriod, setGlobalInvoicePeriod, rolePermissions, setRolePermissions, users, updateUser, systemSettings, updateSystemSettings } = useRBAC();
  
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'settings'>('roles');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [globalStart, setGlobalStart] = useState(globalInvoicePeriod?.startDate || '');
  const [globalEnd, setGlobalEnd] = useState(globalInvoicePeriod?.endDate || '');

  React.useEffect(() => {
    if (globalInvoicePeriod) {
      setGlobalStart(globalInvoicePeriod.startDate);
      setGlobalEnd(globalInvoicePeriod.endDate);
    } else {
      setGlobalStart('');
      setGlobalEnd('');
    }
  }, [globalInvoicePeriod?.startDate, globalInvoicePeriod?.endDate]);
  
  const [selectedUser, setSelectedUser] = useState<UserRBAC | null>(null);
  
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);
  const [isSavedPeriod, setIsSavedPeriod] = useState(false);

  const handleSaveGlobalPeriod = async () => {
    setIsSavingPeriod(true);
    if (globalStart && globalEnd) {
      await setGlobalInvoicePeriod({ startDate: globalStart, endDate: globalEnd });
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Global Invoice Period Saved' }));
    } else {
      await setGlobalInvoicePeriod(null);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Global Invoice Period Cleared' }));
    }
    setIsSavingPeriod(false);
    setIsSavedPeriod(true);
    setTimeout(() => setIsSavedPeriod(false), 2000);
  };

  const toggleRolePermission = (role: Role, perm: Permission) => {
    if (role === 'CEO' && perm === 'admin-panel') {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'CEO must always maintain access to the Admin Panel.' }));
      return;
    }
    const current = !!rolePermissions[role]?.[perm];
    setRolePermissions({
      ...rolePermissions,
      [role]: { ...rolePermissions[role], [perm]: !current }
    });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Admin Panel</h1>
          <p className={styles.pageSubtitle}>System configuration, roles, and access control.</p>
        </div>
      </div>

      {/* Global Settings Section */}
      <div className={styles.globalSection}>
        <div className={styles.globalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className={styles.sectionTitle}>Global Invoice Creation Period</h2>
          </div>
          <p className={styles.sectionDesc}>Set the universal date range during which users with permission can create invoices.</p>
        </div>
        
        <div className={styles.datePickerContainer}>
          <div className={styles.dateField}>
            <label>Start Date</label>
            <input type="date" value={globalStart} onChange={e => setGlobalStart(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.dateField}>
            <label>End Date</label>
            <input type="date" value={globalEnd} onChange={e => setGlobalEnd(e.target.value)} className={styles.input} />
          </div>
          <button 
            className={styles.saveBtn} 
            onClick={handleSaveGlobalPeriod}
            disabled={isSavingPeriod}
            style={{ minWidth: '120px', transition: 'all 0.2s' }}
          >
            {isSavingPeriod ? 'Saving...' : isSavedPeriod ? 'Saved ✓' : 'Save Period'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tabBtn} ${activeTab === 'roles' ? styles.activeTab : ''}`} onClick={() => setActiveTab('roles')}>
          <Shield size={16} /> Roles & Permissions
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'users' ? styles.activeTab : ''}`} onClick={() => setActiveTab('users')}>
          <UsersIcon size={16} /> Individual User Overrides
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.activeTab : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={16} /> Settings
        </button>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className={styles.card}>
          <div className={styles.roleTableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Permission</th>
                  {ROLES_LIST.map(role => <th key={role} className={styles.centerAlign}>{role}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS_LIST.map(perm => (
                  <tr key={perm.id}>
                    <td>
                      <div className={styles.permLabel}>{perm.label}</div>
                    </td>
                    {ROLES_LIST.map(role => {
                      const isCeoAdminPanel = role === 'CEO' && perm.id === 'admin-panel';
                      const isChecked = isCeoAdminPanel ? true : !!rolePermissions[role]?.[perm.id];
                      return (
                        <td key={`${role}-${perm.id}`} className={styles.centerAlign}>
                          <RectangularToggle 
                            checked={isChecked} 
                            onChange={() => toggleRolePermission(role, perm.id)}
                            disabled={isCeoAdminPanel}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className={styles.card}>
          <div className={styles.searchBar}>
            <Search size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search users to set overrides..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.userList}>
            {filteredUsers.map(user => (
              <div key={user.id} className={styles.userListItem}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className={styles.userName}>{user.name}</div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: user.status === 'Approved' ? '#DEF7EC' : '#FEF08A',
                      color: user.status === 'Approved' ? '#03543F' : '#854D0E',
                    }}>
                      {user.status || 'Approved'}
                    </span>
                  </div>
                  <div className={styles.userEmail}>{user.email} • Role: {user.role}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {user.status === 'Pending' && (
                    <button 
                      className={styles.editBtn} 
                      style={{ backgroundColor: '#10B981', color: 'white', border: 'none' }}
                      onClick={async () => {
                        const result = await updateUser(user.id, { status: 'Approved' });
                        if (result.success) {
                          await logAction('User Approved', `Approved access for ${user.email}`);
                          window.dispatchEvent(new CustomEvent('show-toast', { detail: 'User approved successfully' }));
                          if (user.email) {
                            sendUserAccountApprovedEmail({
                              to: user.email,
                              userName: user.name || user.email.split('@')[0]
                            }).catch(err => console.warn('[AdminPanel] Error sending user approved email:', err));
                          }
                        } else {
                          window.dispatchEvent(new CustomEvent('show-toast', { detail: result.error || 'Failed to approve user' }));
                        }
                      }}
                    >
                      Approve
                    </button>
                  )}
                  <button className={styles.editBtn} onClick={() => setSelectedUser(user)}>
                    Edit Overrides
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className={styles.card}>
          <div className={styles.settingsHeader}>
            <h2 className={styles.settingsCardTitle}>System Feature Flags & Controls</h2>
            <p className={styles.settingsCardSubtitle}>
              Configure global platform services and operational toggles. Turn services on or off for development or testing.
            </p>
          </div>

          <div className={styles.settingsList}>
            {/* Toggle 1: Emails */}
            <div className={styles.settingItem}>
              <div className={styles.settingIconWrapper}>
                <Mail size={20} />
              </div>
              
              <div className={styles.settingContent}>
                <div className={styles.settingTitleRow}>
                  <span className={styles.settingLabel}>Emails</span>
                  <span className={systemSettings?.emailsEnabled !== false ? styles.statusBadgeActive : styles.statusBadgeMuted}>
                    {systemSettings?.emailsEnabled !== false ? 'Active' : 'Muted (Dev Mode)'}
                  </span>
                </div>
                
                <p className={styles.settingDescription}>
                  Controls automated transactional emails across the platform (such as account approval confirmations, KYC status notifications, invoice alerts, and payment reminders).
                </p>

                <div className={styles.settingNotice}>
                  <Info size={14} className={styles.noticeIcon} />
                  <span>
                    <strong>Note:</strong> When turned off during development, all automated notification emails are suppressed. Manual account creation and magic link confirmation emails sent via authentication remain active.
                  </span>
                </div>
              </div>

              <div className={styles.settingAction}>
                <RectangularToggle
                  checked={systemSettings?.emailsEnabled !== false}
                  onChange={async () => {
                    const currentEnabled = systemSettings?.emailsEnabled !== false;
                    const nextEnabled = !currentEnabled;
                    await updateSystemSettings({ emailsEnabled: nextEnabled });
                    window.dispatchEvent(new CustomEvent('show-toast', { 
                      detail: nextEnabled ? 'System emails enabled' : 'System emails muted (Dev Mode active)' 
                    }));
                  }}
                />
              </div>
            </div>

            {/* Additional toggles can easily be added here in the future */}
          </div>
        </div>
      )}

      {/* User Override Modal */}
      {selectedUser && (
        <UserOverrideModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  );
};

const UserOverrideModal: React.FC<{ user: UserRBAC, onClose: () => void }> = ({ user, onClose }) => {
  const { updateUser, rolePermissions } = useRBAC();
  const [overrides, setOverrides] = useState<Partial<Record<Permission, boolean>>>(user.overrides);
  
  const [tempStart, setTempStart] = useState(user.temporaryInvoiceOverride?.startDate || '');
  const [tempEnd, setTempEnd] = useState(user.temporaryInvoiceOverride?.endDate || '');
  const [tempEnabled, setTempEnabled] = useState(!!user.temporaryInvoiceOverride);

  const handleToggleOverride = (perm: Permission) => {
    if (user.role === 'CEO' && perm === 'admin-panel') {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'CEO must always maintain access to the Admin Panel.' }));
      return;
    }
    setOverrides(prev => {
      const currentVal = prev[perm] !== undefined ? prev[perm] : !!rolePermissions[user.role]?.[perm];
      return { ...prev, [perm]: !currentVal };
    });
  };

  const handleSave = async () => {
    let tempOverride = null;
    if (tempEnabled && tempStart && tempEnd) {
      tempOverride = { startDate: tempStart, endDate: tempEnd };
    }
    updateUser(user.id, { overrides, temporaryInvoiceOverride: tempOverride });
    await logAction('User Overrides Changed', `Changed overrides for ${user.email}`);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'User Overrides Saved' }));
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>User Overrides: {user.name}</h3>
            <p className={styles.modalSubtitle}>Base Role: {user.role}</p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        <div className={styles.modalBody}>
          <h4 className={styles.sectionSub}>General Permissions</h4>
          <div className={styles.overrideList}>
            {PERMISSIONS_LIST.map(perm => {
              const isOverridden = overrides[perm.id] !== undefined;
              const isCeoAdminPanel = user.role === 'CEO' && perm.id === 'admin-panel';
              const currentValue = isCeoAdminPanel ? true : (isOverridden ? overrides[perm.id] : !!rolePermissions[user.role]?.[perm.id]);
              return (
                <div key={perm.id} className={styles.overrideRow}>
                  <div>
                    <div className={styles.permLabel}>{perm.label}</div>
                    {isOverridden && <div className={styles.overrideBadge}>Overridden</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {isOverridden && !isCeoAdminPanel && (
                      <button 
                        className={styles.clearBtn} 
                        onClick={() => {
                          const newO = { ...overrides };
                          delete newO[perm.id];
                          setOverrides(newO);
                        }}
                      >
                        Reset to Role
                      </button>
                    )}
                    <RectangularToggle 
                      checked={!!currentValue} 
                      onChange={() => handleToggleOverride(perm.id)} 
                      disabled={isCeoAdminPanel}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.divider} />
          
          <h4 className={styles.sectionSub}>Temporary Invoice Override</h4>
          <div className={styles.tempOverrideBox}>
            <div className={styles.overrideRow}>
              <div>
                <div className={styles.permLabel}>Turn On Invoice Creation Temporarily</div>
                <div className={styles.sectionDesc}>Overrides normal permissions and global dates for this user.</div>
              </div>
              <RectangularToggle checked={tempEnabled} onChange={() => setTempEnabled(!tempEnabled)} />
            </div>
            
            {tempEnabled && (
              <div className={styles.datePickerContainer} style={{ marginTop: '16px' }}>
                <div className={styles.dateField}>
                  <label>Start Date</label>
                  <input type="date" value={tempStart} onChange={e => setTempStart(e.target.value)} className={styles.input} />
                </div>
                <div className={styles.dateField}>
                  <label>End Date</label>
                  <input type="date" value={tempEnd} onChange={e => setTempEnd(e.target.value)} className={styles.input} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save Overrides</button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanelView;
