import React from 'react';
import { Briefcase } from 'lucide-react';
import styles from './ClientView.module.css';

interface ClientViewProps {
  onNavigate?: (page: string) => void;
}

const ClientView: React.FC<ClientViewProps> = () => {
  return (
    <div className={styles.clientContainer}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className={styles.title}>Client</h1>
          </div>
          <span className={styles.badge}>This page will be updated soon</span>
        </div>
        <p className={styles.subtitle}>
          Manage clients, client invoices, and portal settings.
        </p>
      </div>

      {/* Main Placeholder Card */}
      <div className={styles.placeholderCard}>
        <div className={styles.iconCircle}>
          <Briefcase size={36} color="#111827" />
        </div>
        <h2 className={styles.cardHeading}>Client Portal & Directory</h2>
        <p className={styles.cardText}>
          This section is currently under development. Tell us what features and data you would like to see here!
        </p>
      </div>
    </div>
  );
};

export default ClientView;
