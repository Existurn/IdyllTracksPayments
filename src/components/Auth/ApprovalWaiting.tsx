import React from 'react';
import { Clock, CheckCircle2, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface ApprovalWaitingProps {
  isApproved: boolean;
  onEnterWorkspace: () => void;
}

const ApprovalWaiting: React.FC<ApprovalWaitingProps> = ({ isApproved, onEnterWorkspace }) => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Navbar */}
      <nav style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 80px', width: '100%', zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/idyll_track_logo.svg" alt="Idyll Tracks Logo" style={{ height: '48px', width: 'auto' }} />
          <div style={{ fontFamily: "'Nohemi', sans-serif", fontSize: '24px', fontWeight: '400', color: '#111827', letterSpacing: '-0.02em', lineHeight: '1.1', textAlign: 'left' }}>
            Idyll Tracks<br />Payments
          </div>
        </div>
      </nav>

      {/* Center Wrapper */}
      <div className="relative flex justify-center items-center w-full max-w-[1200px] h-screen px-4">
        
        {/* Center Card */}
        <div className="bg-white relative z-20 w-full max-w-[460px]" style={{ padding: '48px 40px' }}>
          
          {isApproved ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: '80px', height: '80px', backgroundColor: '#ECFCCB', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
              }}>
                <CheckCircle2 size={40} color="#65A30D" strokeWidth={2} />
              </div>
              
              <h2 style={{ 
                fontFamily: "'Nohemi', sans-serif",
                fontSize: '32px', 
                fontWeight: '700', 
                color: '#111827', 
                marginBottom: '12px',
                lineHeight: '1.2'
              }}>
                Approval Successful
              </h2>
              
              <p style={{ color: '#6B7280', fontSize: '15px', marginBottom: '32px', lineHeight: '1.5' }}>
                Your account has been approved. You can now enter the Finance System.
              </p>
              
              <button
                type="button"
                onClick={onEnterWorkspace}
                style={{
                  backgroundColor: '#FF6600',
                  color: 'white',
                  padding: '16px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  width: '100%',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E55C00'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FF6600'}
              >
                Enter Finance System
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: '80px', height: '80px', backgroundColor: '#FEF3C7', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
              }}>
                <Clock size={40} color="#D97706" strokeWidth={2} />
              </div>
              
              <h2 style={{ 
                fontFamily: "'Nohemi', sans-serif",
                fontSize: '32px', 
                fontWeight: '700', 
                color: '#111827', 
                marginBottom: '12px',
                lineHeight: '1.2'
              }}>
                Waiting for Approval
              </h2>
              
              <p style={{ color: '#6B7280', fontSize: '15px', marginBottom: '32px', lineHeight: '1.5' }}>
                Your account is currently waiting for approval from our team. Once your account has been approved, you'll be able to enter the Finance System.
              </p>
              
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/landing';
                }}
                style={{
                  backgroundColor: 'white',
                  color: '#4B5563',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  border: '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = '#4B5563';
                }}
              >
                <LogOut size={16} /> Return to Home
              </button>
            </div>
          )}

        </div>
        
        {/* Footer Text */}
        <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
          <img src="/idyll_productions_black.png" alt="Idyll Productions" style={{ height: '14px', width: 'auto' }} />
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
            A Finance System by Idyll Productions
          </span>
        </div>
      </div>
    </div>
  );
};

export default ApprovalWaiting;
