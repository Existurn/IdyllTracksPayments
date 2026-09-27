import React from 'react';
import { Home } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden" style={{ backgroundColor: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Navbar */}
      <nav style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 80px', width: '100%', zIndex: 30 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/idyll_track_logo.svg" alt="Idyll Tracks Logo" style={{ height: '48px', width: 'auto' }} />
          <div style={{ fontFamily: "'Nohemi', sans-serif", fontSize: '24px', fontWeight: '400', color: '#111827', letterSpacing: '-0.02em', lineHeight: '1.1', textAlign: 'left' }}>
            Idyll Tracks<br />Payments
          </div>
        </div>

        {/* Right Button - Same as Login Page */}
        <button 
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', color: '#111827', border: 'none', padding: '10px 20px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'color 0.2s' }} 
          onMouseEnter={(e) => e.currentTarget.style.color = '#374151'} 
          onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
        >
          <Home size={16} />
          Back to Home
        </button>
      </nav>

      {/* Content Wrapper */}
      <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '160px', paddingBottom: '120px', paddingLeft: '40px', paddingRight: '40px' }}>
        
        <h1 style={{ fontFamily: "'Nohemi', sans-serif", fontSize: '48px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Privacy Policy</h1>
        <p style={{ fontSize: '15px', color: '#6B7280', marginBottom: '48px', fontWeight: '500' }}>Last Updated: August 15, 2026</p>

        <div style={{ fontSize: '16px', lineHeight: '1.8', color: '#374151' }}>
          <p style={{ marginBottom: '24px' }}>Welcome to the Idyll Tracks Payments Finance Management Workspace.</p>
          <p style={{ marginBottom: '24px' }}>This website is an internal finance management and payment management platform operated for authorized users of Idyll Productions. It is not a public-facing service, social network, or promotional website.</p>
          <p style={{ marginBottom: '40px' }}>We take the privacy and security of information handled through this workspace seriously. This Privacy Policy explains what information we collect, why we use it, how we protect it, and when it may be processed by third-party service providers.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>1. About This Workspace</h2>
          <p style={{ marginBottom: '16px' }}>Idyll Tracks Payments is an internal workspace used for financial management, payment management, invoices, approvals, and related business operations.</p>
          <p style={{ marginBottom: '16px' }}>Access to this workspace is restricted to authorized users.</p>
          <p style={{ marginBottom: '16px' }}>The website is not intended for public use, and access is granted only to users who have been authorized by Idyll Productions.</p>
          <p style={{ marginBottom: '40px' }}>We do not publicly promote this workspace or make its internal financial information available to the general public.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>2. Information We Collect</h2>
          <p style={{ marginBottom: '16px' }}>Depending on how you access the workspace, we may collect and process information such as:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Name or display name</li>
            <li>Email address</li>
            <li>Profile picture</li>
            <li>Account/User ID</li>
            <li>Login and authentication information</li>
            <li>Information associated with your Google account if you choose Google Sign-In</li>
            <li>Financial and payment-related information that you or an authorized user enters into the workspace</li>
            <li>Invoice and payment information</li>
            <li>Account permissions and approval status</li>
            <li>Information required to maintain account security</li>
            <li>Technical information required to operate and secure the website</li>
          </ul>
          <p style={{ marginBottom: '40px' }}>We only collect information that is reasonably necessary to operate the workspace and provide its intended functionality.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>3. How We Use Your Information</h2>
          <p style={{ marginBottom: '16px' }}>Information collected through the workspace may be used to:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Create and manage your account</li>
            <li>Authenticate your identity</li>
            <li>Verify your email address</li>
            <li>Allow you to securely sign in</li>
            <li>Manage your profile</li>
            <li>Process and manage invoices</li>
            <li>Manage payments and financial records</li>
            <li>Send necessary account and payment-related notifications</li>
            <li>Manage user permissions and approvals</li>
            <li>Maintain the security of the workspace</li>
            <li>Prevent unauthorized access</li>
            <li>Maintain, troubleshoot, and improve the reliability of the workspace</li>
            <li>Comply with applicable legal or regulatory obligations</li>
          </ul>
          <p style={{ marginBottom: '40px' }}>We do not use information collected through this internal workspace for unrelated advertising or promotional purposes.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>4. Your Financial Information</h2>
          <p style={{ marginBottom: '16px' }}>Financial, invoice, payment, and business information entered into the workspace is treated as confidential business information.</p>
          <p style={{ marginBottom: '16px' }}>Such information is used only for legitimate business and operational purposes related to the finance management functions of Idyll Productions.</p>
          <p style={{ marginBottom: '40px' }}>Users must not share financial information from the workspace with unauthorized individuals.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>5. We Do Not Sell Your Personal Information</h2>
          <p style={{ marginBottom: '16px' }}>We do not sell, rent, or trade your personal information.</p>
          <p style={{ marginBottom: '16px' }}>We do not use your personal information to build advertising profiles or sell targeted advertising.</p>
          <p style={{ marginBottom: '40px' }}>We do not provide your information to third parties for their independent marketing purposes.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>6. Limited Service Providers</h2>
          <p style={{ marginBottom: '16px' }}>To operate the workspace, certain trusted technology providers may process limited information on our behalf.</p>
          <p style={{ marginBottom: '16px' }}>For example, the system may use third-party services for:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Authentication</li>
            <li>Google Sign-In</li>
            <li>Email delivery</li>
            <li>Database and hosting infrastructure</li>
            <li>Security and system operations</li>
          </ul>
          <p style={{ marginBottom: '16px' }}>These providers receive only the information necessary for the service they provide and are used to support the operation and security of the workspace.</p>
          <p style={{ marginBottom: '16px' }}>For example, if you use Google Sign-In, Google may process information according to Google's own privacy practices. Similarly, email delivery providers may process your email address and related delivery information when sending authentication or workspace emails.</p>
          <p style={{ marginBottom: '40px' }}>We do not authorize these service providers to use your information for unrelated purposes on our behalf.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>7. Information Security</h2>
          <p style={{ marginBottom: '16px' }}>We take reasonable technical and organizational measures to protect information stored and processed through the workspace.</p>
          <p style={{ marginBottom: '16px' }}>These measures may include:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Authentication controls</li>
            <li>Access permissions</li>
            <li>Role-based access</li>
            <li>User approval controls</li>
            <li>Secure authentication mechanisms</li>
            <li>Protected database access</li>
            <li>Secure connections</li>
            <li>Monitoring and security controls</li>
            <li>Restricted access to financial information</li>
          </ul>
          <p style={{ marginBottom: '16px' }}>However, no website or internet-based system can guarantee absolute security.</p>
          <p style={{ marginBottom: '40px' }}>If we become aware of a security incident that requires notification under applicable law, we will take appropriate steps to investigate, mitigate, and notify affected parties where required.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>8. Access Control</h2>
          <p style={{ marginBottom: '16px' }}>Access to the Finance Management Workspace is restricted.</p>
          <p style={{ marginBottom: '16px' }}>Creating an account does not automatically provide access to financial information or the workspace.</p>
          <p style={{ marginBottom: '16px' }}>Depending on the account type and authentication method, users may be required to:</p>
          <ol style={{ listStyleType: 'decimal', paddingLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Authenticate their account</li>
            <li>Complete their profile</li>
            <li>Receive approval from the authorized finance team</li>
          </ol>
          <p style={{ marginBottom: '40px' }}>User permissions determine what information and functionality an individual can access.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>9. Internal Use Only</h2>
          <p style={{ marginBottom: '16px' }}>This website is an internal business workspace.</p>
          <p style={{ marginBottom: '16px' }}>Users must not:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Share their login credentials</li>
            <li>Share private workspace links with unauthorized individuals</li>
            <li>Provide unauthorized persons with access to the workspace</li>
            <li>Copy or distribute confidential financial information without authorization</li>
            <li>Attempt to bypass authentication or access controls</li>
            <li>Attempt to access information belonging to another user without authorization</li>
          </ul>
          <p style={{ marginBottom: '40px' }}>If you believe someone has gained unauthorized access to your account, report it to the Idyll Productions finance team immediately.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>10. Account Information</h2>
          <p style={{ marginBottom: '16px' }}>You may be able to update certain account information through your Profile page, such as:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Display name</li>
            <li>Profile picture</li>
          </ul>
          <p style={{ marginBottom: '40px' }}>Certain information, such as your account email address or system-generated User ID, may be restricted from modification because it is used to identify and secure your account.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>11. Data Retention</h2>
          <p style={{ marginBottom: '16px' }}>We retain information for as long as reasonably necessary to operate the workspace, maintain business records, satisfy legitimate business requirements, resolve disputes, maintain security, and comply with applicable legal obligations.</p>
          <p style={{ marginBottom: '40px' }}>When information is no longer required, it may be deleted, anonymized, or securely archived in accordance with applicable requirements and our internal retention practices.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>12. Your Privacy Rights</h2>
          <p style={{ marginBottom: '16px' }}>Subject to applicable law, you may have rights relating to your personal information, including the ability to request information about how your data is processed and to request correction or deletion where applicable.</p>
          <p style={{ marginBottom: '16px' }}>You may also have the right to withdraw consent where processing is based on consent, subject to legal and operational requirements.</p>
          <p style={{ marginBottom: '40px' }}>Requests relating to your personal information should be directed to the Idyll Productions finance team or privacy contact.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>13. Cookies and Technical Information</h2>
          <p style={{ marginBottom: '16px' }}>The workspace may use cookies, local storage, session identifiers, or similar technologies that are necessary to:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Keep you signed in</li>
            <li>Maintain authentication sessions</li>
            <li>Protect your account</li>
            <li>Remember necessary preferences</li>
            <li>Maintain security</li>
            <li>Operate the website correctly</li>
          </ul>
          <p style={{ marginBottom: '40px' }}>These technologies are primarily used for functionality and security rather than advertising.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>14. Children's Privacy</h2>
          <p style={{ marginBottom: '16px' }}>This workspace is intended for authorized business users and is not designed for children.</p>
          <p style={{ marginBottom: '40px' }}>We do not knowingly collect personal information from children for the purpose of providing this business workspace.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>15. Changes to This Privacy Policy</h2>
          <p style={{ marginBottom: '16px' }}>We may update this Privacy Policy when the workspace, our practices, technology, or applicable legal requirements change.</p>
          <p style={{ marginBottom: '16px' }}>When significant changes are made, we may provide an appropriate notice through the workspace or other available communication channels.</p>
          <p style={{ marginBottom: '40px' }}>The "Last Updated" date at the beginning of this policy indicates when the policy was most recently revised.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>16. Contact</h2>
          <p style={{ marginBottom: '40px' }}>If you have questions about this Privacy Policy, your personal information, or the handling of information within the workspace, please contact the Idyll Productions finance team or designated privacy contact.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginTop: '48px', marginBottom: '24px' }}>17. Internal Workspace Notice</h2>
          <p style={{ marginBottom: '16px' }}>This workspace is operated for authorized Idyll Productions users.</p>
          <p style={{ marginBottom: '16px' }}>It is not a public financial service and is not intended for general public access.</p>
          <p style={{ marginBottom: '40px' }}>Information contained within the workspace, including financial records, invoices, payment information, and internal business information, should be treated as confidential and accessed only for legitimate business purposes.</p>

          <p style={{ fontWeight: '600', marginTop: '80px', marginBottom: '80px', textAlign: 'center' }}>© 2026 Idyll Productions. All rights reserved.</p>
        </div>
      </div>
      
      {/* Footer Logo */}
      <div style={{ paddingBottom: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
        <img src="/idyll_productions_black.png" alt="Idyll Productions" style={{ height: '28px', width: 'auto' }} />
        <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
          A Finance System by Idyll Productions
        </span>
      </div>
      
    </div>
  );
};

export default PrivacyPolicy;
