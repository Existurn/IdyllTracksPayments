import React, { useState } from 'react';
import { 
  Check, 
  Clock, 
  Hourglass, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  Info 
} from 'lucide-react';
import type { KycStatus, KycNote } from '../../utils/kycService';
import styles from './KycStepper.module.css';

interface KycStepperProps {
  status: KycStatus;
  latestNote?: KycNote | null;
}

export const KycStepper: React.FC<KycStepperProps> = ({ status, latestNote }) => {
  const [showNoteDetails, setShowNoteDetails] = useState(true);

  // Status mapping and configuration
  const getStatusConfig = () => {
    switch (status) {
      case 'Submitted':
        return {
          pillClass: styles.statusSubmitted,
          label: 'Submitted',
          icon: <Clock size={14} />,
          stepIdx: 0,
          color: 'Blue'
        };
      case 'Under Review':
        return {
          pillClass: styles.statusUnderReview,
          label: 'Under Review',
          icon: <Hourglass size={14} />,
          stepIdx: 1,
          color: 'Yellow'
        };
      case 'Verification in Progress':
        return {
          pillClass: styles.statusVerificationInProgress,
          label: 'Verification in Progress',
          icon: <Hourglass size={14} />,
          stepIdx: 2,
          color: 'Yellow'
        };
      case 'Verified':
        return {
          pillClass: styles.statusVerified,
          label: 'Verified',
          icon: <CheckCircle2 size={14} />,
          stepIdx: 3,
          color: 'Green'
        };
      case 'Action Required':
        return {
          pillClass: styles.statusActionRequired,
          label: 'Action Required',
          icon: <AlertTriangle size={14} />,
          stepIdx: 1,
          isAlert: true,
          color: 'Orange'
        };
      case 'Resubmission Required':
        return {
          pillClass: styles.statusResubmissionRequired,
          label: 'Resubmission Required',
          icon: <AlertCircle size={14} />,
          stepIdx: 1,
          isAlert: true,
          color: 'Yellow'
        };
      case 'Rejected':
        return {
          pillClass: styles.statusRejected,
          label: 'Rejected',
          icon: <XCircle size={14} />,
          stepIdx: 1,
          isAlert: true,
          color: 'Red'
        };
      case 'Not Requested':
        return {
          pillClass: styles.statusSubmitted,
          label: 'Not Requested',
          icon: <Clock size={14} />,
          stepIdx: -1,
          color: 'Gray'
        };
      case 'Requested':
      default:
        return {
          pillClass: styles.statusSubmitted,
          label: 'KYC Requested',
          icon: <Clock size={14} />,
          stepIdx: -1,
          color: 'Blue'
        };
    }
  };

  const currentConfig = getStatusConfig();

  // Define steps
  const steps = [
    { title: 'Submitted', key: 'Submitted' },
    { 
      title: status === 'Action Required' 
        ? 'Action Required' 
        : status === 'Resubmission Required' 
        ? 'Resubmission' 
        : status === 'Rejected' 
        ? 'Rejected' 
        : 'Under Review', 
      key: 'Review' 
    },
    { title: 'Verification in Progress', key: 'InProgress' },
    { title: 'Verified', key: 'Verified' }
  ];

  return (
    <div className={styles.stepperContainer}>
      {/* Top Status Header */}
      <div className={styles.topRow}>
        <div className={styles.statusHeader}>
          <span className={styles.statusLabel}>Current Verification Status:</span>
          <span className={`${styles.statusPill} ${currentConfig.pillClass}`}>
            {currentConfig.icon}
            {currentConfig.label}
          </span>
        </div>

        {latestNote && (
          <button 
            type="button" 
            className={styles.noteInfoBtn}
            onClick={() => setShowNoteDetails(!showNoteDetails)}
            title="Toggle Reason / Compliance Note"
          >
            <Info size={16} />
            <span style={{ fontSize: '12px', fontWeight: 500, marginLeft: '4px' }}>
              {showNoteDetails ? 'Hide Note' : 'View Note'}
            </span>
          </button>
        )}
      </div>

      {/* Stepper Track */}
      <div className={styles.stepperTrack}>
        {/* Connecting Lines */}
        <div 
          className={`${styles.stepConnector} ${currentConfig.stepIdx >= 1 ? styles.stepConnectorActive : ''}`}
          style={{ left: '12.5%', width: '25%' }}
        />
        <div 
          className={`${styles.stepConnector} ${currentConfig.stepIdx >= 2 ? styles.stepConnectorActive : ''}`}
          style={{ left: '37.5%', width: '25%' }}
        />
        <div 
          className={`${styles.stepConnector} ${currentConfig.stepIdx >= 3 ? styles.stepConnectorActive : ''}`}
          style={{ left: '62.5%', width: '25%' }}
        />

        {/* Step Items */}
        {steps.map((step, idx) => {
          let isCompleted = currentConfig.stepIdx > idx && !currentConfig.isAlert;
          let isActive = currentConfig.stepIdx === idx;

          let activeClass = '';
          if (isActive) {
            if (status === 'Submitted') activeClass = styles.stepActiveBlue;
            else if (status === 'Under Review') activeClass = styles.stepActiveYellow;
            else if (status === 'Verification in Progress') activeClass = styles.stepActiveYellow;
            else if (status === 'Verified') activeClass = styles.stepActiveGreen;
            else if (status === 'Action Required') activeClass = styles.stepActiveOrange;
            else if (status === 'Resubmission Required') activeClass = styles.stepActiveYellow;
            else if (status === 'Rejected') activeClass = styles.stepActiveRed;
          }

          return (
            <div 
              key={step.key} 
              className={`${styles.stepItem} ${isCompleted ? styles.stepCompleted : ''} ${activeClass}`}
            >
              <div className={styles.stepIconWrapper}>
                {isCompleted ? (
                  <Check size={18} strokeWidth={2.5} />
                ) : isActive ? (
                  status === 'Verified' ? (
                    <Check size={18} strokeWidth={2.5} />
                  ) : status === 'Action Required' || status === 'Resubmission Required' ? (
                    <AlertTriangle size={17} strokeWidth={2.2} />
                  ) : status === 'Rejected' ? (
                    <XCircle size={17} strokeWidth={2.2} />
                  ) : (
                    <Clock size={17} strokeWidth={2.2} />
                  )
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ''}`}>
                {step.title}
                {isActive && latestNote && (
                  <Info size={13} style={{ color: '#D97706', display: 'inline' }} />
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Latest Reason Note Popover / Banner */}
      {latestNote && showNoteDetails && (
        <div 
          className={`${styles.noteContainer} ${
            status === 'Rejected' 
              ? styles.noteContainerRed 
              : status === 'Action Required' 
              ? styles.noteContainerOrange 
              : ''
          }`}
        >
          {status === 'Rejected' ? (
            <AlertCircle size={18} className={styles.noteIcon} />
          ) : (
            <AlertTriangle size={18} className={styles.noteIcon} />
          )}
          <div className={styles.noteContent}>
            <div className={styles.noteTitle}>
              {status === 'Rejected' 
                ? 'Rejection Reason:' 
                : status === 'Action Required'
                ? 'Action Required from Compliance Team:'
                : status === 'Resubmission Required'
                ? 'Resubmission Details:'
                : 'Compliance Note:'}
            </div>
            <p className={styles.noteText}>{latestNote.note}</p>
          </div>
        </div>
      )}
    </div>
  );
};
