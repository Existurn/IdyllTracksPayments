import React from 'react';
import { 
  Settings as SettingsIcon, 
  FileText, 
  ShieldCheck, 
  HelpCircle
} from 'lucide-react';
import styles from './TutorialView.module.css';

const BUNNY_CDN_EMBED_URL = 'https://player.mediadelivery.net/play/644758/71b0d8a0-c6ea-46ee-944b-f3b5382f1ec7';

interface TutorialViewProps {
  onNavigate?: (page: string) => void;
}

const TutorialView: React.FC<TutorialViewProps> = ({ onNavigate }) => {
  return (
    <div className={styles.tutorialContainer}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className={styles.title}>Tutorial</h1>
          </div>
          <span className={styles.badge}>This page will be updated soon</span>
        </div>
        <p className={styles.subtitle}>
          Watch the overview video below to get started with Idyll Tracks Payments.
        </p>
      </div>

      {/* Main Video Card */}
      <div className={styles.videoCard}>
        <div className={styles.videoWrapper}>
          <iframe
            src={BUNNY_CDN_EMBED_URL}
            loading="lazy"
            style={{ 
              border: 'none', 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%' 
            }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            title="Idyll Tracks Payments Tutorial"
          />
        </div>

        <div className={styles.videoCardFooter}>
          <div className={styles.videoMeta}>
            <span className={styles.videoMetaTitle}>
              Idyll Tracks Payments Walkthrough
            </span>
          </div>
        </div>
      </div>

      {/* Quick Start Tips */}
      <div className={styles.card} style={{ marginTop: '24px' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Getting Started Checklist</h2>
        </div>

        <div className={styles.tipsList}>
          <div className={styles.tipItem}>
            <div className={styles.tipIcon}>
              <SettingsIcon size={16} />
            </div>
            <div>
              <div className={styles.tipContentTitle}>1. Set Up Your Profile</div>
              <p className={styles.tipContentDesc}>
                Enter both your Display Name and Legal Full Name in{' '}
                <button 
                  type="button"
                  onClick={() => onNavigate?.('settings')}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#EA580C', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Settings
                </button>{' '}
                to unlock all features.
              </p>
            </div>
          </div>

          <div className={styles.tipItem}>
            <div className={styles.tipIcon}>
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className={styles.tipContentTitle}>2. Complete Identity Verification</div>
              <p className={styles.tipContentDesc}>
                Submit your required documents in KYC to get approved for invoice creation and withdrawals.
              </p>
            </div>
          </div>

          <div className={styles.tipItem}>
            <div className={styles.tipIcon}>
              <FileText size={16} />
            </div>
            <div>
              <div className={styles.tipContentTitle}>3. Create and Submit Invoices</div>
              <p className={styles.tipContentDesc}>
                Generate invoices during scheduled invoice periods and track real-time payment states directly from your dashboard.
              </p>
            </div>
          </div>

          <div className={styles.tipItem}>
            <div className={styles.tipIcon}>
              <HelpCircle size={16} />
            </div>
            <div>
              <div className={styles.tipContentTitle}>4. Need Assistance?</div>
              <p className={styles.tipContentDesc}>
                Reach out to the team via the{' '}
                <button 
                  type="button"
                  onClick={() => onNavigate?.('support')}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#EA580C', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Support
                </button>{' '}
                desk anytime you have questions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialView;
