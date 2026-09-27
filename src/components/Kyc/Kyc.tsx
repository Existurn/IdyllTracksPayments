import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Lock, Eye, EyeOff, ShieldAlert, FileCheck, XCircle, ShieldCheck, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { 
  fetchUserKyc, 
  submitUserKyc, 
  maskAadhaar,
  type KycRecord, 
  type KycNote 
} from '../../utils/kycService';
import { showToast } from '../../utils/notifications';
import { KycStepper } from './KycStepper';
import { AadhaarUpload } from './AadhaarUpload';
import aadhaarLogo from '../../assets/Aadhaar.svg';
import styles from './Kyc.module.css';

interface KycProps {
  onCancel?: () => void;
}

const Kyc: React.FC<KycProps> = ({ onCancel }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [kycRecord, setKycRecord] = useState<KycRecord | null>(null);
  const [latestNote, setLatestNote] = useState<KycNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    aadharNumber: '',
    dob: '',
    address: ''
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showAadhaarNumber, setShowAadhaarNumber] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Locked fields warning state
  const [lockedClickCount, setLockedClickCount] = useState(0);
  const [showLockedNotification, setShowLockedNotification] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playPopSound = () => {
    try {
      const audio = new Audio('/macos-sound-fx-pop.wav');
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.warn('Audio play prevented or error:', err);
      });
    } catch (e) {
      console.warn('Audio init error:', e);
    }
  };

  const triggerLockedNotification = () => {
    setShowLockedNotification(true);
    setShakeTrigger(prev => prev + 1);
    playPopSound();

    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    autoDismissTimerRef.current = setTimeout(() => {
      setShowLockedNotification(false);
    }, 4000);
  };

  const handleLockedFieldClickCapture = () => {
    if (!isLocked) return;

    if (clickResetTimerRef.current) {
      clearTimeout(clickResetTimerRef.current);
    }
    clickResetTimerRef.current = setTimeout(() => {
      setLockedClickCount(0);
    }, 3000);

    setLockedClickCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        triggerLockedNotification();
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      if (clickResetTimerRef.current) clearTimeout(clickResetTimerRef.current);
    };
  }, []);

  const loadKyc = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { record, latestNote: note } = await fetchUserKyc(user.id);
      setKycRecord(record);
      setLatestNote(note);

      if (record) {
        setFormData({
          fullName: record.account_holder_name || '',
          aadharNumber: record.aadhar_number || '',
          dob: record.dob || '',
          address: record.address || ''
        });
      } else if (user.user_metadata?.full_name) {
        setFormData(prev => ({ ...prev, fullName: user.user_metadata.full_name }));
      }
    } catch (err) {
      console.error('[KYC] Error loading KYC:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const status = kycRecord?.status || null;

  // In-progress statuses where fields are locked
  const isLocked = status === 'Submitted' || status === 'Under Review' || status === 'Verification in Progress';
  const isVerified = status === 'Verified';
  const isActionRequired = status === 'Action Required' || status === 'Resubmission Required';
  const isRejected = status === 'Rejected';

  // Can the user submit or edit?
  const canEdit = !isLocked;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isLocked) return;
    const { name, value } = e.target;
    if (name === 'aadharNumber') {
      const cleaned = value.replace(/\D/g, '').slice(0, 12);
      setFormData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    if (onCancel) {
      onCancel();
    } else {
      loadKyc();
    }
  };

  const executeSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const existingDoc = kycRecord?.document_url ? {
        url: kycRecord.document_url,
        name: kycRecord.document_name || 'Aadhaar_Document',
        type: kycRecord.document_type || 'application/pdf',
        size: Number(kycRecord.document_size) || 0
      } : undefined;

      const result = await submitUserKyc(
        userId,
        {
          accountHolderName: formData.fullName,
          aadharNumber: formData.aadharNumber,
          dob: formData.dob,
          address: formData.address
        },
        uploadedFile || undefined,
        uploadedFile ? undefined : existingDoc
      );

      if (!result.success) {
        showToast(result.error || 'Failed to submit KYC details.');
        return;
      }

      showToast('KYC details submitted successfully. Verification cycle started.');
      setShowResetConfirmModal(false);
      await loadKyc();
    } catch (err: any) {
      showToast(err.message || 'Submission error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    // Aadhaar number validation
    const aadharClean = formData.aadharNumber.replace(/\D/g, '');
    if (aadharClean.length !== 12) {
      showToast('Please enter a valid 12-digit Aadhaar number.');
      return;
    }

    // Document validation
    if (!uploadedFile && !kycRecord?.document_url) {
      showToast('Please upload a copy of your Aadhaar card (PDF, JPG, or PNG).');
      return;
    }

    // If currently Verified, warn that modifying restarts verification cycle
    if (isVerified) {
      setShowResetConfirmModal(true);
      return;
    }

    executeSave();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div style={{ height: '32px', width: '240px', background: '#F3F4F6', borderRadius: '6px', marginBottom: '8px' }} />
          <div style={{ height: '18px', width: '400px', background: '#F3F4F6', borderRadius: '6px' }} />
        </div>
      </div>
    );
  }

  // If KYC has never been requested and no submission exists
  if (!kycRecord || kycRecord.status === 'Not Requested') {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTextGroup}>
            <h1 className={styles.title}>Identity Verification</h1>
            <p className={styles.subtitle}>
              Official identity verification for regulatory compliance and invoice processing.
            </p>
          </div>
          <div className={styles.headerAadhaarLogoWrapper}>
            <img src={aadhaarLogo} alt="Aadhaar" className={styles.headerAadhaarLogo} />
          </div>
        </div>

        <div className={styles.unrequestedContainer}>
          <div className={styles.unrequestedIconWrapper}>
            <FileCheck size={32} />
          </div>
          <h2 className={styles.unrequestedTitle}>Identity Verification Not Requested</h2>
          <p className={styles.unrequestedText}>
            Identity verification has not been requested for your account yet. KYC is initiated by the finance team when required. You will be notified via email and dashboard notification once requested.
          </p>
        </div>

        {/* Bottom Notice */}
        <div className={styles.notice}>
          <AlertCircle size={16} className={styles.noticeIcon} />
          <p className={styles.noticeText}>
            <span className={styles.noticeStrong}>Notice:</span> This verification method is intended for Indian residents. Non-Indian members should use alternative verification options.
          </p>
        </div>
      </div>
    );
  }

  // If KYC is verified, show simple "You're All Set" screen
  if (isVerified) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTextGroup}>
            <h1 className={styles.title}>Identity Verification</h1>
            <p className={styles.subtitle}>
              Official identity verification for regulatory compliance and invoice processing.
            </p>
          </div>
          <div className={styles.headerAadhaarLogoWrapper}>
            <img src={aadhaarLogo} alt="Aadhaar" className={styles.headerAadhaarLogo} />
          </div>
        </div>

        <div className={styles.verifiedContainer}>
          <div className={styles.verifiedIconWrapper}>
            <ShieldCheck size={56} className={styles.verifiedIcon} strokeWidth={2.2} />
          </div>

          <h2 className={styles.verifiedTitle}>You're All Set!</h2>
          <p className={styles.verifiedSubtitle}>Your KYC has been verified</p>

          <div className={styles.verifiedCard}>
            <p className={styles.verifiedMessageText}>
              Your identity verification (KYC) has been successfully verified and approved. Your account is fully active with complete access to invoice generation and payment tracking.
            </p>

            <div className={styles.verifiedNoticeBanner}>
              <AlertCircle size={18} className={styles.verifiedNoticeIcon} />
              <div className={styles.verifiedNoticeContent}>
                <span className={styles.verifiedNoticeTitle}>Future Re-verification Notice</span>
                <p className={styles.verifiedNoticeParagraph}>
                  Sometimes our finance team may send you another KYC verification request in the future if updated documentation or periodic regulatory compliance is required. No further action is required from you at this time.
                </p>
              </div>
            </div>

            <div className={styles.verifiedDetailsGrid}>
              <div className={styles.verifiedDetailItem}>
                <span className={styles.verifiedDetailLabel}>Account Holder Name</span>
                <span className={styles.verifiedDetailValue}>
                  {formData.fullName || kycRecord?.account_holder_name || 'Verified User'}
                </span>
              </div>

              <div className={styles.verifiedDetailItem}>
                <span className={styles.verifiedDetailLabel}>Aadhaar Number</span>
                <span className={styles.verifiedDetailValue}>
                  {maskAadhaar(formData.aadharNumber || kycRecord?.aadhar_number)}
                </span>
              </div>

              <div className={styles.verifiedDetailItem}>
                <span className={styles.verifiedDetailLabel}>Verification Status</span>
                <span className={styles.verifiedStatusPill}>
                  <Check size={13} strokeWidth={2.5} />
                  Verified
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Notice */}
        <div className={styles.notice}>
          <AlertCircle size={16} className={styles.noticeIcon} />
          <p className={styles.noticeText}>
            <span className={styles.noticeStrong}>Notice:</span> This verification method is intended for Indian residents. Non-Indian members should use alternative verification options.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.headerTextGroup}>
          <h1 className={styles.title}>Identity Verification</h1>
          <p className={styles.subtitle}>
            Provide your official identification details below. All data is encrypted and securely stored for regulatory compliance.
          </p>
        </div>
        <div className={styles.headerAadhaarLogoWrapper}>
          <img src={aadhaarLogo} alt="Aadhaar" className={styles.headerAadhaarLogo} />
        </div>
      </div>

      {/* KYC Stepper with color states and latest note */}
      <KycStepper status={kycRecord.status} latestNote={latestNote} />

      {/* In-Progress Locked Notice */}
      {isLocked && (
        <div className={styles.lockedBanner}>
          <Lock size={18} className={styles.lockedBannerIcon} />
          <div>
            <strong>KYC Verification in Progress:</strong> Your identity verification details are currently under active review. All fields are locked while review is underway.
          </div>
        </div>
      )}

      {/* Main Form & Visual Reference Layout */}
      <div className={styles.layout}>
        {/* Form Area */}
        <div 
          className={`${styles.formArea} ${isLocked ? styles.formAreaLocked : ''}`}
          onClickCapture={handleLockedFieldClickCapture}
        >
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Account Holder Name */}
            <div className={styles.fieldGroup}>
              <label htmlFor="fullName">
                Account Holder Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                required
                disabled={isLocked}
                value={formData.fullName}
                onChange={handleChange}
                className={styles.input}
                placeholder="As it appears on your document"
              />
            </div>

            {/* Aadhaar Number & Date of Birth */}
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="aadharNumber">
                  Aadhaar Number <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <input
                    type={showAadhaarNumber || !isLocked ? 'text' : 'password'}
                    id="aadharNumber"
                    name="aadharNumber"
                    required
                    disabled={isLocked}
                    value={
                      isLocked && !showAadhaarNumber
                        ? maskAadhaar(formData.aadharNumber)
                        : formData.aadharNumber
                    }
                    onChange={handleChange}
                    pattern="\d{12}"
                    maxLength={12}
                    className={`${styles.input} ${styles.monoInput}`}
                    placeholder="1234 5678 9012"
                  />
                  {isLocked && (
                    <button
                      type="button"
                      className={styles.maskToggleBtn}
                      onClick={() => setShowAadhaarNumber(!showAadhaarNumber)}
                      title={showAadhaarNumber ? 'Hide Aadhaar' : 'Show Aadhaar'}
                    >
                      {showAadhaarNumber ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="dob">
                  Date of Birth <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  id="dob"
                  name="dob"
                  required
                  disabled={isLocked}
                  value={formData.dob}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>
            </div>

            {/* Registered Address */}
            <div className={styles.fieldGroup}>
              <label htmlFor="address">
                Registered Address <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                id="address"
                name="address"
                required
                disabled={isLocked}
                rows={3}
                value={formData.address}
                onChange={handleChange}
                className={styles.textarea}
                placeholder="Full residential address matching the document"
              />
            </div>

            {/* Mandatory Aadhaar Card Upload Field */}
            <AadhaarUpload
              file={uploadedFile}
              existingDocument={
                kycRecord.document_name
                  ? {
                      name: kycRecord.document_name,
                      type: kycRecord.document_type || 'application/pdf',
                      size: Number(kycRecord.document_size) || 0,
                      url: kycRecord.document_url
                    }
                  : null
              }
              onFileChange={setUploadedFile}
              disabled={isLocked}
            />

            {/* Consent & Form Actions */}
            {canEdit && (
              <div className={styles.formFooter}>
                <p className={styles.consentText}>
                  By saving, you confirm these details are accurate and agree to identity verification.
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={handleReset}
                    className={styles.cancelBtn}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.saveBtn}
                    disabled={saving}
                  >
                    {saving ? 'Saving Details...' : isVerified ? 'Save & Resubmit' : isActionRequired || isRejected ? 'Resubmit Verification' : 'Save Details'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Subtle Visual Reference Sidebar */}
        <aside className={styles.referenceSidebar} aria-label="Visual Reference">
          <div className={styles.referenceContent}>
            <div className={styles.cardImageWrapper}>
              <img
                src="/Aadharcard_cropped.png"
                alt="Aadhaar Document Reference"
                className={styles.cardImage}
              />
            </div>
            <h3 className={styles.referenceTitle}>Visual Reference</h3>
            <p className={styles.referenceText}>
              Match the name, number, and date of birth format shown on your physical ID.
            </p>
          </div>
        </aside>
      </div>

      {/* Integrated Bottom Notice */}
      <div className={styles.notice}>
        <AlertCircle size={16} className={styles.noticeIcon} />
        <p className={styles.noticeText}>
          <span className={styles.noticeStrong}>Notice:</span> This verification method is intended for Indian residents. Non-Indian members should use alternative verification options.
        </p>
      </div>

      {/* Confirmation Modal when a Verified user modifies their details */}
      {showResetConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#D97706', marginBottom: '12px' }}>
              <ShieldAlert size={24} />
              <h3 className={styles.modalTitle} style={{ margin: 0 }}>Reset Identity Verification?</h3>
            </div>
            <p className={styles.modalText}>
              Your account is currently <strong>Verified</strong>. Updating your details or Aadhaar document will restart the verification cycle from <em>Submitted</em> and lock your invoice creation until re-verified by the finance team.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowResetConfirmModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={executeSave}
                disabled={saving}
                style={{ backgroundColor: '#D97706' }}
              >
                {saving ? 'Saving...' : 'Yes, Update & Resubmit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Red Bottom Bar Notification for Locked Fields (Exact match with Settings unsaved changes bar) */}
      {showLockedNotification && (
        <div 
          key={shakeTrigger}
          role="alert"
          className={styles.lockedNotificationBar}
          style={{
            animation: shakeTrigger > 1
              ? `${styles.errorShake} 0.42s cubic-bezier(0.22, 1, 0.36, 1)`
              : `${styles.slideUpAndShake} 0.48s cubic-bezier(0.22, 1, 0.36, 1)`
          }}
        >
          <div className={styles.lockedNotificationContent}>
            <div className={styles.lockedNotificationLeft}>
              <div className={styles.lockedNotificationIconWrapper}>
                <XCircle size={20} color="#FFFFFF" />
              </div>
              <div className={styles.lockedNotificationTextGroup}>
                <span className={styles.lockedNotificationTitle}>
                  Fields Locked for Review:
                </span>
                <span className={styles.lockedNotificationMessage}>
                  Your identity verification is currently in progress. All fields are securely locked and cannot be edited until the review is complete.
                </span>
              </div>
            </div>

            <div className={styles.lockedNotificationRight}>
              <button
                type="button"
                className={styles.lockedNotificationBtn}
                onClick={() => setShowLockedNotification(false)}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Kyc;
