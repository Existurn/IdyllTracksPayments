import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Eye, 
  EyeOff, 
  FileText, 
  Image as ImageIcon, 
  ExternalLink, 
  Download, 
  AlertTriangle,
  Clock,
  ChevronUp,
  Check
} from 'lucide-react';
import { 
  maskAadhaar, 
  getSignedDocumentUrl, 
  updateKycStatus, 
  fetchUserNotes,
  type KycRecord, 
  type KycStatus, 
  type KycNote 
} from '../../utils/kycService';
import { showToast } from '../../utils/notifications';
import aadhaarLogo from '../../assets/Aadhaar.svg';
import styles from './KycDetailsModal.module.css';

interface KycDetailsModalProps {
  record: KycRecord & { user_name?: string; user_email?: string };
  onClose: () => void;
  onUpdated: () => void;
}

export const KycDetailsModal: React.FC<KycDetailsModalProps> = ({
  record,
  onClose,
  onUpdated
}) => {
  const [selectedStatus, setSelectedStatus] = useState<KycStatus>(record.status);
  const [reasonNote, setReasonNote] = useState('');
  const [notesHistory, setNotesHistory] = useState<KycNote[]>([]);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUserNotes(record.user_id).then(setNotesHistory);
  }, [record.user_id]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isStatusDropdownOpen]);

  const requiresReason = 
    selectedStatus === 'Action Required' || 
    selectedStatus === 'Resubmission Required' || 
    selectedStatus === 'Rejected';

  const handleViewAadhaar = async () => {
    if (!record.document_url) {
      showToast('No document uploaded for this user.');
      return;
    }
    setLoadingDoc(true);
    try {
      const { signedUrl, error } = await getSignedDocumentUrl(record.document_url, 300);
      if (error || !signedUrl) {
        showToast(error || 'Failed to generate view link');
        return;
      }
      // Open in separate browser tab using native viewer
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      showToast(err.message || 'Error opening document');
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleDownloadAadhaar = async () => {
    if (!record.document_url) {
      showToast('No document uploaded for this user.');
      return;
    }
    setLoadingDoc(true);
    try {
      const { signedUrl, error } = await getSignedDocumentUrl(record.document_url, 300);
      if (error || !signedUrl) {
        showToast(error || 'Failed to generate download link');
        return;
      }
      
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = record.document_name || 'Aadhaar_Document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      showToast(err.message || 'Error downloading document');
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleSaveStatus = async () => {
    if (requiresReason && !reasonNote.trim()) {
      showToast(`Please provide a reason for marking status as ${selectedStatus}.`);
      return;
    }

    setSaving(true);
    try {
      const result = await updateKycStatus(
        record.user_id,
        selectedStatus,
        reasonNote.trim() || undefined
      );

      if (!result.success) {
        showToast(result.error || 'Failed to update status');
        return;
      }

      showToast(`Status successfully updated to ${selectedStatus}`);
      onUpdated();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const isPdf = record.document_type?.includes('pdf') || record.document_name?.toLowerCase().endsWith('.pdf');

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <h2 className={styles.modalTitle}>KYC Verification Details</h2>
            <div className={styles.viewingAsBadge}>
              Viewing as: <span className={styles.viewingAsName}>{record.user_name || record.account_holder_name}</span> ({record.user_email})
            </div>
          </div>

          <button type="button" className={styles.closeBtn} onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* User & Document Metadata Grid */}
          <div className={styles.infoGrid}>
            <div>
              <div className={styles.infoLabel}>Account Holder Name</div>
              <div className={styles.infoValue}>{record.account_holder_name || 'N/A'}</div>
            </div>

            <div>
              <div className={styles.infoLabel}>Legal Name</div>
              <div className={styles.infoValue}>{record.legal_name || record.account_holder_name || 'N/A'}</div>
            </div>

            <div>
              <div className={styles.infoLabel}>Aadhaar Number</div>
              <div className={styles.infoValue}>
                <div className={styles.maskedAadhaarRow}>
                  <span>
                    {showFullAadhaar 
                      ? (record.aadhar_number || 'N/A') 
                      : maskAadhaar(record.aadhar_number)}
                  </span>
                  {record.aadhar_number && (
                    <button
                      type="button"
                      className={styles.toggleMaskBtn}
                      onClick={() => setShowFullAadhaar(!showFullAadhaar)}
                      title={showFullAadhaar ? 'Mask Aadhaar' : 'Unmask Aadhaar'}
                    >
                      {showFullAadhaar ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className={styles.infoLabel}>Date of Birth</div>
              <div className={styles.infoValue}>{record.dob || 'N/A'}</div>
            </div>

            <div className={styles.infoItemFull}>
              <div className={styles.infoLabel}>Registered Address</div>
              <div className={styles.infoValue}>{record.address || 'N/A'}</div>
            </div>

            <div>
              <div className={styles.infoLabel}>Submitted At</div>
              <div className={styles.infoValue}>
                {record.submitted_at 
                  ? new Date(record.submitted_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                  : 'Not Submitted'}
              </div>
            </div>

            <div>
              <div className={styles.infoLabel}>Automated Progression</div>
              <div className={styles.infoValue}>
                {record.is_manual_override ? 'Manual Admin Decision (Frozen)' : 'Active Automation (1-hr Flow)'}
              </div>
            </div>
          </div>

          {/* Aadhaar Document Viewer Section */}
          <div className={styles.documentSection}>
            <h3 className={styles.sectionHeading}>Uploaded Aadhaar Document</h3>
            {record.document_url ? (
              <div className={styles.docRow}>
                <div className={styles.docDetails}>
                  <div className={styles.docIconWrapper}>
                    <img src={aadhaarLogo} alt="Aadhaar" className={styles.aadhaarLogo} />
                  </div>
                  <div className={styles.docInfo}>
                    <div className={styles.docName} title={record.document_name || 'Aadhaar_Document'}>
                      {record.document_name || 'Aadhaar_Document'}
                    </div>
                    <div className={styles.docMeta}>
                      {isPdf ? 'PDF Document' : 'Image File'}
                      {record.document_size ? ` • ${(record.document_size / 1024).toFixed(1)} KB` : ''}
                    </div>
                  </div>
                </div>

                <div className={styles.docActions}>
                  <button
                    type="button"
                    className={styles.docBtn}
                    onClick={handleViewAadhaar}
                    disabled={loadingDoc}
                    title="Open document in a separate browser tab"
                  >
                    <ExternalLink size={14} />
                    <span>View Aadhaar</span>
                  </button>
                  <button
                    type="button"
                    className={styles.docBtn}
                    onClick={handleDownloadAadhaar}
                    disabled={loadingDoc}
                    title="Download document file"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13.5px', color: '#9CA3AF', fontStyle: 'italic' }}>
                No document uploaded yet.
              </div>
            )}
          </div>

          {/* Status Override Box */}
          <div className={styles.statusChangeBox}>
            <h3 className={styles.sectionHeading}>Manage KYC Status</h3>
            <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#6B7280' }}>
              Setting a status manually permanently takes control of the workflow and halts automated transitions.
            </p>

            <div className={styles.statusRow}>
              <div className={styles.customSelectWrapper} ref={statusDropdownRef}>
                <button
                  type="button"
                  className={`${styles.customSelectTrigger} ${isStatusDropdownOpen ? styles.customSelectTriggerOpen : ''}`}
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  aria-expanded={isStatusDropdownOpen}
                >
                  <div className={styles.triggerSelectedValue}>
                    <span 
                      className={styles.statusColorDot}
                      style={{
                        backgroundColor: 
                          selectedStatus === 'Verified' ? '#059669' :
                          selectedStatus === 'Rejected' ? '#DC2626' :
                          selectedStatus === 'Action Required' ? '#EA580C' :
                          selectedStatus === 'Resubmission Required' ? '#D97706' :
                          selectedStatus === 'Under Review' || selectedStatus === 'Verification in Progress' ? '#EAB308' :
                          '#2563EB'
                      }}
                    />
                    <span>{selectedStatus === 'Verified' ? 'Verified (Approve)' : selectedStatus}</span>
                  </div>
                  <ChevronUp 
                    size={16} 
                    className={`${styles.chevronIcon} ${isStatusDropdownOpen ? '' : styles.chevronIconClosed}`} 
                  />
                </button>

                {isStatusDropdownOpen && (
                  <div className={styles.customSelectMenuUpside}>
                    {[
                      { value: 'Submitted' as KycStatus, label: 'Submitted', desc: 'User submitted KYC details', color: '#2563EB' },
                      { value: 'Under Review' as KycStatus, label: 'Under Review', desc: 'Under initial document review', color: '#EAB308' },
                      { value: 'Verification in Progress' as KycStatus, label: 'Verification in Progress', desc: 'Active compliance verification in progress', color: '#EAB308' },
                      { value: 'Verified' as KycStatus, label: 'Verified (Approve)', desc: 'Approve and verify user identity', color: '#059669' },
                      { value: 'Action Required' as KycStatus, label: 'Action Required', desc: 'User must correct information', color: '#EA580C' },
                      { value: 'Resubmission Required' as KycStatus, label: 'Resubmission Required', desc: 'User must upload clearer document', color: '#D97706' },
                      { value: 'Rejected' as KycStatus, label: 'Rejected', desc: 'Decline verification request', color: '#DC2626' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`${styles.customSelectOption} ${selectedStatus === opt.value ? styles.customSelectOptionActive : ''}`}
                        onClick={() => {
                          setSelectedStatus(opt.value);
                          setIsStatusDropdownOpen(false);
                        }}
                      >
                        <div className={styles.optionMain}>
                          <div className={styles.optionHeader}>
                            <span 
                              className={styles.statusColorDot}
                              style={{ backgroundColor: opt.color }}
                            />
                            <span>{opt.label}</span>
                          </div>
                          <span className={styles.optionDesc}>{opt.desc}</span>
                        </div>
                        {selectedStatus === opt.value && (
                          <Check size={16} className={styles.checkIcon} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reason Textarea (Required for Action Required / Resubmission / Rejected) */}
            <div className={styles.reasonInputGroup}>
              <div className={styles.labelWithBadge}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  {requiresReason ? 'Reason for Decision / External Note:' : 'Internal Audit Note:'}
                  {requiresReason && <span style={{ color: '#EF4444' }}> *</span>}
                </label>
                <span className={requiresReason ? styles.externalNoteBadge : styles.internalNoteBadge}>
                  {requiresReason ? 'External (Sent to Customer)' : 'Internal (Admin Only)'}
                </span>
              </div>
              <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#6B7280' }}>
                {requiresReason
                  ? 'This external note is emailed to the user and shown on their KYC status card so they know what to correct.'
                  : 'This note is saved to internal compliance logs for admin audit tracking and is not shown to the customer.'}
              </p>
              <textarea
                className={styles.reasonTextarea}
                placeholder={
                  requiresReason
                    ? 'e.g., Your Aadhaar document image was blurry. Please re-upload a clear copy showing all four corners.'
                    : 'Add an internal compliance or audit note...'
                }
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
              />
            </div>
          </div>

          {/* Internal Notes History (Admin only) */}
          {notesHistory.length > 0 && (
            <div className={styles.notesSection}>
              <h3 className={styles.sectionHeading}>Previous Notes & History ({notesHistory.length})</h3>
              <div className={styles.noteHistoryList}>
                {notesHistory.map((note) => (
                  <div key={note.id} className={styles.noteHistoryItem}>
                    <div className={styles.noteMeta}>
                      <span className={styles.noteContextBadge}>{note.status_context}</span>
                      <span>{new Date(note.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <div>{note.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSaveStatus}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Status Change'}
          </button>
        </div>
      </div>
    </div>
  );
};
