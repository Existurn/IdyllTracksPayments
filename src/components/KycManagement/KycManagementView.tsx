import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  FolderOpen, 
  Trash2, 
  Send,
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  CheckCircle2,
  X
} from 'lucide-react';
import { 
  fetchAllKycRecords, 
  sendKycRequest, 
  cancelKycRequest,
  deleteUserKyc, 
  type KycRecord, 
  type KycStatus 
} from '../../utils/kycService';
import { showToast } from '../../utils/notifications';
import { KycDetailsModal } from './KycDetailsModal';
import styles from './KycManagementView.module.css';

type TabType = 
  | 'All' 
  | 'Not Requested'
  | 'Requested' 
  | 'In Progress' 
  | 'Action Required' 
  | 'Resubmission Required' 
  | 'Verified' 
  | 'Rejected';

export const KycManagementView: React.FC = () => {
  const [records, setRecords] = useState<(KycRecord & { user_name?: string; user_email?: string; user_role?: string; latest_note?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Three dot menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modals & Action state
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState<(KycRecord & { user_name?: string; user_email?: string }) | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<{ id: string; name: string } | null>(null);
  const [recordToCancel, setRecordToCancel] = useState<{ userId: string; name: string } | null>(null);
  const [cancellingUserId, setCancellingUserId] = useState<string | null>(null);
  const [showSendRequestModal, setShowSendRequestModal] = useState(false);
  const [selectedUserIdForRequest, setSelectedUserIdForRequest] = useState<string>('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const [deletingKyc, setDeletingKyc] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { records: data } = await fetchAllKycRecords();
      setRecords(data);
    } catch (err) {
      console.error('[KYC Management] Error loading records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close three-dot menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter records based on tab and search query
  const filteredRecords = records.filter(r => {
    // 1. Search Query Filter
    const searchTarget = `${r.account_holder_name || ''} ${r.user_name || ''} ${r.user_email || ''} ${r.user_role || ''}`.toLowerCase();
    const matchesSearch = searchTarget.includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Tab Filter
    if (activeTab === 'All') return true;
    if (activeTab === 'Not Requested') return r.status === 'Not Requested';
    if (activeTab === 'Requested') return r.status === 'Requested';
    if (activeTab === 'In Progress') {
      return ['Submitted', 'Under Review', 'Verification in Progress'].includes(r.status);
    }
    if (activeTab === 'Action Required') return r.status === 'Action Required';
    if (activeTab === 'Resubmission Required') return r.status === 'Resubmission Required';
    if (activeTab === 'Verified') return r.status === 'Verified';
    if (activeTab === 'Rejected') return r.status === 'Rejected';

    return true;
  });

  // Tab count calculation
  const getTabCount = (tab: TabType) => {
    if (tab === 'All') return records.length;
    if (tab === 'Not Requested') return records.filter(r => r.status === 'Not Requested').length;
    if (tab === 'Requested') return records.filter(r => r.status === 'Requested').length;
    if (tab === 'In Progress') {
      return records.filter(r => ['Submitted', 'Under Review', 'Verification in Progress'].includes(r.status)).length;
    }
    return records.filter(r => r.status === tab).length;
  };

  // Status Badge Helper
  const renderStatusBadge = (status: KycStatus) => {
    switch (status) {
      case 'Not Requested':
        return <span className={`${styles.statusBadge} ${styles.badgeNotRequested}`}><Clock size={12} /> Not Requested</span>;
      case 'Submitted':
        return <span className={`${styles.statusBadge} ${styles.badgeSubmitted}`}><Clock size={12} /> Submitted</span>;
      case 'Under Review':
        return <span className={`${styles.statusBadge} ${styles.badgeUnderReview}`}><Clock size={12} /> Under Review</span>;
      case 'Verification in Progress':
        return <span className={`${styles.statusBadge} ${styles.badgeVerificationInProgress}`}><Clock size={12} /> In Progress</span>;
      case 'Verified':
        return <span className={`${styles.statusBadge} ${styles.badgeVerified}`}><CheckCircle2 size={12} /> Verified</span>;
      case 'Action Required':
        return <span className={`${styles.statusBadge} ${styles.badgeActionRequired}`}><AlertTriangle size={12} /> Action Req.</span>;
      case 'Resubmission Required':
        return <span className={`${styles.statusBadge} ${styles.badgeResubmissionRequired}`}><AlertCircle size={12} /> Resubmission</span>;
      case 'Rejected':
        return <span className={`${styles.statusBadge} ${styles.badgeRejected}`}><XCircle size={12} /> Rejected</span>;
      case 'Requested':
      default:
        return <span className={`${styles.statusBadge} ${styles.badgeRequested}`}><Clock size={12} /> Requested</span>;
    }
  };

  // Handle Direct Inline "Send KYC" Request
  const handleDirectSendRequest = async (record: KycRecord & { user_name?: string; user_email?: string }) => {
    const targetName = record.user_name || record.account_holder_name || 'User';
    const targetEmail = record.user_email || '';
    setSendingUserId(record.user_id);
    try {
      const result = await sendKycRequest(record.user_id, targetName, targetEmail);
      if (!result.success) {
        showToast(result.error || 'Failed to send KYC request.');
        return;
      }
      showToast(`KYC Verification request sent to ${targetName}.`);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error sending KYC request.');
    } finally {
      setSendingUserId(null);
    }
  };

  // Handle Modal Send KYC Request Submit
  const handleSendRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserIdForRequest) {
      showToast('Please select a user to request KYC verification.');
      return;
    }

    const targetRecord = records.find(r => r.user_id === selectedUserIdForRequest);
    if (!targetRecord) return;

    setSendingRequest(true);
    try {
      const result = await sendKycRequest(
        targetRecord.user_id,
        targetRecord.user_name || targetRecord.account_holder_name,
        targetRecord.user_email || ''
      );
      if (!result.success) {
        showToast(result.error || 'Failed to send KYC request.');
        return;
      }

      showToast(`KYC Verification request sent to ${targetRecord.user_name || targetRecord.account_holder_name}.`);
      setShowSendRequestModal(false);
      setSelectedUserIdForRequest('');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error sending request');
    } finally {
      setSendingRequest(false);
    }
  };

  // Handle Delete / Reset Confirmation
  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    setDeletingKyc(true);
    try {
      const result = await deleteUserKyc(recordToDelete.id);
      if (!result.success) {
        showToast(result.error || 'Failed to delete KYC record');
        return;
      }
      showToast(`KYC record reset for ${recordToDelete.name}.`);
      setRecordToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting KYC');
    } finally {
      setDeletingKyc(false);
    }
  };

  // Handle Cancel KYC Request Confirmation
  const handleCancelRequestConfirm = async () => {
    if (!recordToCancel) return;
    setCancellingUserId(recordToCancel.userId);
    try {
      const result = await cancelKycRequest(recordToCancel.userId);
      if (!result.success) {
        showToast(result.error || 'Failed to cancel KYC request.');
        return;
      }
      showToast(`KYC request for ${recordToCancel.name} cancelled. Status reverted to Not Requested.`);
      setRecordToCancel(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error cancelling request');
    } finally {
      setCancellingUserId(null);
    }
  };

  // Users eligible for sending a new KYC verification request (Not Requested or Rejected)
  const eligibleUsers = records.filter(r => r.status === 'Not Requested' || r.status === 'Rejected');

  const tabs: TabType[] = [
    'All',
    'Not Requested',
    'Requested',
    'In Progress',
    'Action Required',
    'Resubmission Required',
    'Verified',
    'Rejected'
  ];

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>KYC Management</h1>
          <p className={styles.subtitle}>
            Review, verify, and manage account holder identity submissions.
          </p>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className={styles.controlsBar}>
        <div className={styles.tabsList}>
          {tabs.map((tab) => {
            const count = getTabCount(tab);
            return (
              <button
                key={tab}
                type="button"
                className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <span>{tab}</span>
                <span className={styles.tabBadge}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* KYC Records Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
            Loading KYC records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No KYC submissions found</div>
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {searchQuery ? 'No records match your search criteria.' : 'There are no records in this view.'}
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Account Holder Name</th>
                <th className={`${styles.th} ${styles.centerCol}`}>KYC Status</th>
                <th className={`${styles.th} ${styles.centerCol}`}>Last Updated</th>
                <th className={`${styles.th} ${styles.rightCol}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className={styles.tr}>
                  {/* Name, Role & Email */}
                  <td className={styles.td}>
                    <div className={styles.accountNameCell}>
                      <span>{record.account_holder_name || record.user_name || 'Account Holder'}</span>
                      {record.user_role && (
                        <span className={styles.userRoleTag}>{record.user_role}</span>
                      )}
                    </div>
                    <div className={styles.emailSubtext}>
                      {record.user_email || 'No email provided'}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className={`${styles.td} ${styles.centerCol}`}>
                    {renderStatusBadge(record.status)}
                  </td>

                  {/* Date */}
                  <td className={`${styles.td} ${styles.centerCol}`} style={{ color: '#6B7280' }}>
                    {record.status_updated_at || record.submitted_at || record.requested_at
                      ? new Date(record.status_updated_at || record.submitted_at || record.requested_at!).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : '—'}
                  </td>

                  {/* Actions column */}
                  <td className={`${styles.td} ${styles.rightCol}`}>
                    <div className={styles.actionGroup}>
                      {/* Direct Inline Action for Not Requested */}
                      {record.status === 'Not Requested' && (
                        <button
                          type="button"
                          className={styles.sendKycRowBtn}
                          onClick={() => handleDirectSendRequest(record)}
                          disabled={sendingUserId === record.user_id}
                          title={`Send KYC Verification Request to ${record.user_name || record.account_holder_name}`}
                        >
                          <Send size={13} />
                          {sendingUserId === record.user_id ? 'Sending...' : 'Send KYC'}
                        </button>
                      )}

                      {/* Direct Inline Action for Requested */}
                      {record.status === 'Requested' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className={styles.sendKycRowBtn}
                            style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
                            onClick={() => handleDirectSendRequest(record)}
                            disabled={sendingUserId === record.user_id || cancellingUserId === record.user_id}
                            title="Resend KYC Verification Request"
                          >
                            <Send size={13} />
                            {sendingUserId === record.user_id ? 'Sending...' : 'Resend'}
                          </button>
                          <button
                            type="button"
                            className={styles.cancelKycRowBtn}
                            onClick={() => setRecordToCancel({
                              userId: record.user_id,
                              name: record.account_holder_name || record.user_name || 'Account Holder'
                            })}
                            disabled={sendingUserId === record.user_id || cancellingUserId === record.user_id}
                            title="Cancel KYC Request"
                          >
                            <X size={13} />
                            {cancellingUserId === record.user_id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </div>
                      )}

                      {/* View Details for all other statuses */}
                      {record.status !== 'Not Requested' && record.status !== 'Requested' && (
                        <button
                          type="button"
                          className={styles.sendKycRowBtn}
                          onClick={() => setSelectedRecordForDetails(record)}
                          title="View KYC Submission Details"
                        >
                          <FolderOpen size={13} />
                          View Details
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* User KYC Details Modal */}
      {selectedRecordForDetails && (
        <KycDetailsModal
          record={selectedRecordForDetails}
          onClose={() => setSelectedRecordForDetails(null)}
          onUpdated={loadData}
        />
      )}

      {/* Cancel KYC Request Confirmation Modal */}
      {recordToCancel && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Cancel KYC Request?</h3>
            <p className={styles.modalText}>
              Are you sure you want to cancel the identity verification request for <strong>{recordToCancel.name}</strong>?
            </p>
            <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: '#4B5563', lineHeight: '1.6' }}>
              <div>• Their account will remain completely normal as it was.</div>
              <div>• The KYC verification banner and notifications will be removed.</div>
              <div>• Their KYC status will revert back to <strong>Not Requested</strong> with the option to Send KYC again.</div>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setRecordToCancel(null)}
                disabled={Boolean(cancellingUserId)}
              >
                No, Keep Request
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                style={{ backgroundColor: '#DC2626' }}
                onClick={handleCancelRequestConfirm}
                disabled={Boolean(cancellingUserId)}
              >
                {cancellingUserId ? 'Cancelling...' : 'Yes, Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Reset KYC Confirmation Modal */}
      {recordToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Reset KYC verification?</h3>
            <p className={styles.modalText}>
              This will remove the user's current KYC information and uploaded documents. Their status will revert to "Not Requested".
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setRecordToDelete(null)}
                disabled={deletingKyc}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={handleDeleteConfirm}
                disabled={deletingKyc}
              >
                {deletingKyc ? 'Resetting...' : 'Reset KYC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send KYC Verification Modal */}
      {showSendRequestModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 className={styles.modalTitle} style={{ margin: 0 }}>Send KYC Verification</h3>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setShowSendRequestModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p className={styles.modalText}>
              Select a registered account holder to send an official KYC verification request. The user will receive an email and a dashboard notification.
            </p>

            <form onSubmit={handleSendRequestSubmit}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                Select User:
              </label>
              <select
                className={styles.selectUserDropdown}
                value={selectedUserIdForRequest}
                onChange={(e) => setSelectedUserIdForRequest(e.target.value)}
                required
              >
                <option value="">-- Choose Account Holder --</option>
                {eligibleUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.user_name || u.account_holder_name} ({u.user_email || 'No email'}) — Role: {u.user_role || 'User'}
                  </option>
                ))}
              </select>

              {eligibleUsers.length === 0 && (
                <div style={{ fontSize: '13px', color: '#D97706', marginBottom: '16px' }}>
                  All current users already have an active KYC verification process.
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowSendRequestModal(false)}
                  disabled={sendingRequest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={sendingRequest || eligibleUsers.length === 0}
                >
                  {sendingRequest ? 'Sending...' : 'Send KYC Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KycManagementView;
