import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface AccountVerifiedProps {}

const AccountVerified: React.FC<AccountVerifiedProps> = () => {
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
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
              <img src="/smile.jpg" alt="Smile" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            </div>
            
            <h2 style={{ 
              fontFamily: "'Inter', sans-serif",
              fontSize: '24px', 
              fontWeight: '600', 
              color: '#111827', 
              marginBottom: '12px',
              lineHeight: '1.2'
            }}>
              Email Verified
            </h2>
            
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px', lineHeight: '1.5' }}>
              Your email has been successfully verified. You can now return back to the workspace.
            </p>
            
          </div>
        </div>
        
        {/* Footer Text */}
        <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <img src="/idyll_productions_black.png" alt="Idyll Productions" style={{ height: '28px', width: 'auto' }} />
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
            A Finance System by Idyll Productions
          </span>
        </div>
      </div>
    </div>
  );
};

export default AccountVerified;
