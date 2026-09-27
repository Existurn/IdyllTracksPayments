import React from 'react';
import styles from './NotFound.module.css';
import logo5 from '../../assets/logo-5.png';

interface NotFoundProps {
  onBackToHome: () => void;
  onGoBack?: () => void;
}

const TAPE_ITEMS = [
  '404 Not Found',
  '404 Not Found',
  '404 Not Found',
  '404 Not Found',
  '404 Not Found',
  '404 Not Found',
  '404 Not Found',
  '404 Not Found',
  '404 Not Found',
  '404 Not Found',
];

export const NotFound: React.FC<NotFoundProps> = ({ onBackToHome }) => {
  return (
    <div
      className={styles.notFoundContainer}
      role="main"
      aria-label="404 Page Not Found"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {/* Top minimal branding with 5.png */}
      <button
        type="button"
        className={styles.topNav}
        onClick={onBackToHome}
        aria-label="Idyll Track Payments - Go to Home"
        style={{
          position: 'absolute',
          top: '28px',
          left: '32px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <img
          src={logo5}
          alt="Idyll Track Payments"
          style={{ height: '42px', width: 'auto', objectFit: 'contain' }}
        />
        <span
          style={{
            fontFamily: "'Nohemi', 'Inter', sans-serif",
            fontSize: '17px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: '#111827',
            textAlign: 'left',
          }}
        >
          Idyll Tracks<br />Payments
        </span>
      </button>

      {/* Giant Watermark positioned in the center of the viewport behind the content */}
      <div
        className={styles.watermark404}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: 0,
          zIndex: 1,
        }}
      >
        404
      </div>

      {/* Center 404 Content - Dead Center Directly Over 404 Watermark */}
      <div
        className={styles.contentBox}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: 0,
          zIndex: 10,
        }}
      >
        {/* Heading */}
        <h1 className={styles.title}>Page Not Found!</h1>

        {/* Subtitle */}
        <p className={styles.subtitle}>
          The page you’re looking for doesn’t exist or may have been moved.
        </p>

        {/* Single Action Button: Back to Home, 8px radius, no shadow, no arrow */}
        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={styles.homeButton}
            onClick={onBackToHome}
            aria-label="Back to Home"
          >
            Back to Home
          </button>
        </div>
      </div>

      {/* Bottom Angled Ribbon Tapes */}
      <div className={styles.tapesContainer} aria-hidden="true">
        {/* Red Tape (angled ~3.4 deg) */}
        <div className={styles.redTape}>
          <div className={styles.tickerTrackRight}>
            <div className={styles.tickerContent}>
              {TAPE_ITEMS.map((item, idx) => (
                <React.Fragment key={`red-1-${idx}`}>
                  <span>{item}</span>
                  <span className={styles.asterisk}>✱</span>
                </React.Fragment>
              ))}
            </div>
            <div className={styles.tickerContent}>
              {TAPE_ITEMS.map((item, idx) => (
                <React.Fragment key={`red-2-${idx}`}>
                  <span>{item}</span>
                  <span className={styles.asterisk}>✱</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Dark Slate Tape (angled ~ -2.8 deg) */}
        <div className={styles.darkTape}>
          <div className={styles.tickerTrackLeft}>
            <div className={styles.tickerContent}>
              {TAPE_ITEMS.map((item, idx) => (
                <React.Fragment key={`dark-1-${idx}`}>
                  <span>{item}</span>
                  <span className={styles.asterisk}>✱</span>
                </React.Fragment>
              ))}
            </div>
            <div className={styles.tickerContent}>
              {TAPE_ITEMS.map((item, idx) => (
                <React.Fragment key={`dark-2-${idx}`}>
                  <span>{item}</span>
                  <span className={styles.asterisk}>✱</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
