import React, { useState, useEffect } from 'react';
import { Home } from 'lucide-react';
import { Lottie } from 'lottie-react';
import appStoreBadge from '../../assets/Appstore.webp';
import playStoreBadge from '../../assets/PlayStore.png';
import meetingAnimation from '../../assets/business-group-meeting.json';

interface AppComingSoonCardProps {
  delayMs?: number;
}

const AppComingSoonCard: React.FC<AppComingSoonCardProps> = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  return (
    <>
      {/* 2 PNG Store Badges (Left Bottom, One Above the Other, immediately visible) */}
      <div
        style={{
          position: 'fixed',
          bottom: '32px',
          left: '32px',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '10px',
        }}
      >
        {/* Apple App Store Badge */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title="Apple App Store - Click to view status"
          aria-label="View Apple App Store details"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: 'none',
            outline: 'none',
            display: 'block',
            transition: 'transform 0.2s ease, opacity 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.opacity = '0.92';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.opacity = '1';
          }}
        >
          <img
            src={appStoreBadge}
            alt="Download on Apple App Store"
            style={{
              height: '46px',
              width: 'auto',
              display: 'block',
              borderRadius: '8px',
              boxShadow: 'none',
            }}
          />
        </button>

        {/* Google Play Store Badge */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title="Google Play Store - Click to view status"
          aria-label="View Google Play Store details"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: 'none',
            outline: 'none',
            display: 'block',
            transition: 'transform 0.2s ease, opacity 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.opacity = '0.92';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.opacity = '1';
          }}
        >
          <img
            src={playStoreBadge}
            alt="Get it on Google Play"
            style={{
              height: '46px',
              width: 'auto',
              display: 'block',
              borderRadius: '8px',
              boxShadow: 'none',
            }}
          />
        </button>
      </div>

      {/* Full Screen Modal / Page */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Application Coming Soon Details"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            backgroundColor: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            fontFamily: "'Inter', sans-serif",
            color: '#111827',
            padding: 0,
            boxShadow: 'none',
          }}
        >
          {/* Top Navbar in Full Screen Modal */}
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              padding: '40px 80px',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/logo-5.png" alt="Idyll Tracks Logo" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
              <div
                style={{
                  fontFamily: "'Nohemi', sans-serif",
                  fontSize: '20px',
                  fontWeight: '400',
                  color: '#111827',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.15',
                  textAlign: 'left',
                }}
              >
                Idyll Tracks<br />Payments
              </div>
            </div>

            {/* Back to Home Button in Right Top */}
            <button
              onClick={() => setIsModalOpen(false)}
              aria-label="Back to Home"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'transparent',
                color: '#111827',
                border: 'none',
                padding: '10px 16px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#111827';
              }}
            >
              <Home size={16} />
              <span>Back to Home</span>
            </button>
          </header>

          {/* Center Main Content */}
          <main
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '780px',
              width: '100%',
              margin: 'auto',
              textAlign: 'center',
              padding: '16px 0 32px 0',
            }}
          >
            {/* Lottie Animation - No Card, Much Bigger */}
            <div
              style={{
                width: '480px',
                height: '480px',
                maxWidth: '92vw',
                maxHeight: '50vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <Lottie
                src={meetingAnimation}
                autoplay
                loop
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                }}
              />
            </div>

            {/* Title */}
            <h1
              style={{
                fontFamily: "'Nohemi', sans-serif",
                fontSize: 'clamp(28px, 4.5vw, 40px)',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.025em',
                lineHeight: '1.15',
                margin: '0 0 16px 0',
              }}
            >
              Application Coming Soon
            </h1>

            {/* Body Content */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                maxWidth: '560px',
                fontSize: '15px',
                lineHeight: '1.6',
                color: '#4B5563',
                margin: '0 0 20px 0',
              }}
            >
              <p style={{ margin: 0 }}>
                We are currently working on the application for the{' '}
                <strong style={{ color: '#111827', fontWeight: '600' }}>Apple App Store</strong> and{' '}
                <strong style={{ color: '#111827', fontWeight: '600' }}>Google Play Store</strong>.
              </p>

              <p style={{ margin: 0 }}>
                Once development is complete and everything is properly set up, we will officially launch the application and make it available for download.
              </p>

              {/* Staff Notice Box - Flat, 8px Rounded, No Shadow */}
              <div
                style={{
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  color: '#374151',
                  textAlign: 'left',
                  boxShadow: 'none',
                  margin: '6px 0',
                }}
              >
                <strong style={{ color: '#111827', fontWeight: '600' }}>Staff Notice: </strong>
                If you are a staff member of the company, you can continue using the existing application, which is fully updated and operational.
              </div>

              <p style={{ margin: 0, color: '#6B7280', fontSize: '14px', fontStyle: 'italic' }}>
                Thank you for your patience and support.
              </p>
            </div>
          </main>
        </div>
      )}
    </>
  );
};

export default AppComingSoonCard;
