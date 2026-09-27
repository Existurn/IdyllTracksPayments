import React from 'react';
import type { Session } from '@supabase/supabase-js';
import WelcomeTourModal from '../Dashboard/WelcomeTourModal';
import AppLayout from '../Layout/AppLayout';
import Dashboard from '../Dashboard/Dashboard';

interface ProfileOnboardingProps {
  session: Session;
  onComplete: () => void;
}

const ProfileOnboarding: React.FC<ProfileOnboardingProps> = ({ onComplete }) => {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-surface, #FFFFFF)' }}>
      {/* Real Dashboard layout visible in low opacity in background all throughout onboarding */}
      <div 
        style={{ 
          position: 'absolute', 
          inset: 0, 
          opacity: 0.35, 
          pointerEvents: 'none', 
          userSelect: 'none'
        }} 
        aria-hidden="true"
      >
        <AppLayout activePage="dashboard" onPageChange={() => {}}>
          <Dashboard onPageChange={() => {}} />
        </AppLayout>
      </div>

      {/* Starting Welcome Modal in front */}
      <WelcomeTourModal isOpen={true} onClose={onComplete} />
    </div>
  );
};

export default ProfileOnboarding;
