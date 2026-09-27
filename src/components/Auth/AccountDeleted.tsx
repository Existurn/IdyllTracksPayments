import React from 'react';
import { supabase } from '../../lib/supabaseClient';

const AccountDeleted: React.FC = () => {
  const handleReturnHome = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
        <img 
          src="/delete_icon.png" 
          alt="Account Deleted" 
          style={{ width: '120px', height: 'auto', marginBottom: '24px' }} 
        />
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '12px', fontFamily: "'Nohemi', sans-serif" }}>
          Account Deleted
        </h1>
        <p style={{ fontSize: '15px', color: '#4B5563', lineHeight: '1.6', marginBottom: '32px' }}>
          Your account has been deleted by the finance team and you no longer have access to this workspace.
        </p>
        <button 
          onClick={handleReturnHome}
          style={{
            backgroundColor: '#111827',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 32px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            width: '100%'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111827'}
        >
          Go to Homepage
        </button>
      </div>
      
      {/* Footer Branding */}
      <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, textAlign: 'center' }}>
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', color: '#9CA3AF', fontWeight: '500' }}>
          <img src="/idyll_productions_black.png" alt="Idyll Logo" style={{ height: '14px', opacity: 0.5 }} />
          A Finance System by Idyll Productions
        </p>
      </div>
    </div>
  );
};

export default AccountDeleted;
