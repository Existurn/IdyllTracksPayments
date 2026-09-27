import React from 'react';
import { ExternalLink, Shield } from 'lucide-react';
import landingHero from '../../assets/landing-hero.png';
import AppComingSoonCard from './AppComingSoonCard';

interface LandingPageProps {
  onLoginClick: () => void;
  onSignUpClick: () => void;
  onPrivacyClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSignUpClick, onPrivacyClick }) => {
  return (
    <div style={{ height: '100vh', width: '100%', backgroundColor: '#FCFAF6', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      
      {/* Navbar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 80px', width: '100%', flexShrink: 0 }}>

        {/* Left Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo-5.png" alt="Idyll Tracks Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
          <div style={{ fontFamily: "'Nohemi', sans-serif", fontSize: '24px', fontWeight: '400', color: '#111827', letterSpacing: '-0.02em', lineHeight: '1.1', textAlign: 'left' }}>
            Idyll Tracks<br />Payments
          </div>
        </div>


        {/* Right Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a href="https://idyllproductions.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', color: '#111827', border: 'none', padding: '10px 16px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#374151'} onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}>
            <ExternalLink size={16} />
            Visit Main Site
          </a>
          <a href="https://idyllproductions.work/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', color: '#111827', border: 'none', padding: '10px 16px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#374151'} onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}>
            <ExternalLink size={16} />
            Go to Workspace
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '12vh', width: '100%', minHeight: 0 }}>
        <h1 style={{ fontFamily: "'AnthropicSerif', 'Anthropic Serif', serif", fontSize: 'clamp(56px, 5vw, 72px)', fontWeight: '400', color: '#111827', textAlign: 'center', lineHeight: '1.1', letterSpacing: '-0.02em', maxWidth: '800px', marginBottom: '30px' }}>
          Everything About<br />Your Payments
        </h1>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '40px', flexShrink: 0 }}>
          <button onClick={onSignUpClick} style={{ backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '10px', padding: '14px 28px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F2937'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111827'}>
            Create New Account
          </button>
          <button onClick={onLoginClick} style={{ backgroundColor: 'white', color: '#111827', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '14px 28px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
            Log In
          </button>
        </div>

        {/* Big Bottom Image */}
        <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', minHeight: 0 }}>
          <img 
            src={landingHero} 
            alt="Hero Graphic" 
            style={{ maxWidth: '1600px', width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom', display: 'block', transform: 'translateY(15%)' }} 
          />
        </div>
      </main>
      
      {/* Privacy Policy Button */}
      <div style={{ position: 'absolute', bottom: '40px', right: '40px', zIndex: 10 }}>
        <button 
          onClick={onPrivacyClick}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            backgroundColor: 'transparent', 
            color: '#000000', 
            border: 'none', 
            fontSize: '13px', 
            fontWeight: '600', 
            cursor: 'pointer', 
            transition: 'opacity 0.2s', 
            padding: '8px',
            opacity: 1
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Shield size={14} color="#000000" />
          <span>Privacy Policy</span>
        </button>
      </div>

      {/* Application Coming Soon Card (Left Bottom) */}
      <AppComingSoonCard />
      
    </div>
  );
};

export default LandingPage;
