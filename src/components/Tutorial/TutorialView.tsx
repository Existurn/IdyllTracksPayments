import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown,
  Plus, 
  FileText, 
  Send, 
  Check, 
  Info, 
  Clock, 
  ArrowRight,
  Upload,
  Sparkles,
  Wallet,
  Lock,
  Users,
  ShieldCheck
} from 'lucide-react';
import styles from './TutorialView.module.css';

interface TutorialViewProps {
  onNavigate?: (page: string) => void;
}

interface TutorialItem {
  id: string;
  title: string;
  videoUrl?: string;
  isAvailable: boolean;
  renderGuide?: (onNavigate?: (page: string) => void) => React.ReactNode;
}

interface StaffTutorialItem {
  id: string;
  title: string;
}

const TutorialView: React.FC<TutorialViewProps> = ({ onNavigate }) => {
  // All items collapsed by default on page load
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadedVideos, setLoadedVideos] = useState<Record<string, boolean>>({});

  const toggleAccordion = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleRoleRestrictedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: {
        message: "You are not assigned with this role. Your role is different, so you can't access.",
        type: 'error',
        shake: true
      }
    }));
  };
  const handleStaffItemClick = handleRoleRestrictedClick;

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    let embed = url.replace('/play/', '/embed/');
    const separator = embed.includes('?') ? '&' : '?';
    if (!embed.includes('autoplay=')) {
      embed += `${separator}autoplay=false`;
    }
    return embed;
  };

  // Section 1: Editor Tutorials
  const editorTutorials: TutorialItem[] = [
    {
      id: 'save-payment-details',
      title: 'How to Save Payment Details in Idyll Tracks Payments (Editors)',
      videoUrl: 'https://player.mediadelivery.net/embed/644758/dc395b09-1fcf-4590-b6df-e7d600963017?autoplay=false',
      isAvailable: true,
      renderGuide: (nav) => (
        <div className={styles.guideSection}>
          <div className={styles.guideHeader}>
            <h3 className={styles.guideTitle}>
              <FileText size={18} color="var(--text-primary)" />
              Written Instructions
            </h3>
          </div>

          <div className={styles.welcomeBanner}>
            Follow this guide to save and manage your bank and UPI payment details for invoices.
          </div>

          <div className={styles.stepsList}>
            {/* Step 1 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Go to the Payment Method page.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Click on{' '}
                  <span className={styles.btnPill}>
                    <Plus size={13} strokeWidth={2.5} />
                    Add First Payment Method
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Or, click on{' '}
                  <span className={styles.btnPill}>
                    <Plus size={13} strokeWidth={2.5} />
                    Add New
                  </span>{' '}
                  in the top right.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>4</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  The same applies to the UPI section: Click on{' '}
                  <span className={styles.btnPill}>
                    <Plus size={13} strokeWidth={2.5} />
                    Add First Payment
                  </span>{' '}
                  or click on{' '}
                  <span className={styles.btnPill}>
                    <Plus size={13} strokeWidth={2.5} />
                    Add New
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>5</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  <strong>Let's first see how to save your bank payment details:</strong>
                </p>
                <ul className={styles.subStepsList}>
                  <li className={styles.subStepItem}>Enter the account holder name.</li>
                  <li className={styles.subStepItem}>Enter the account number.</li>
                  <li className={styles.subStepItem}>Enter the IFSC code.</li>
                  <li className={styles.subStepItem}>Enter the bank name.</li>
                  <li className={styles.subStepItem}>
                    Click on{' '}
                    <span className={styles.btnPill}>
                      <Check size={13} strokeWidth={2.5} />
                      Save
                    </span>
                    .
                  </li>
                </ul>
                <div className={styles.tipBox}>
                  <Info size={15} className={styles.tipIcon} />
                  <span>Your bank details are now saved.</span>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>6</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  <strong>Now let's see how to save your UPI payment details:</strong>
                </p>
                <ul className={styles.subStepsList}>
                  <li className={styles.subStepItem}>Enter the account holder name.</li>
                  <li className={styles.subStepItem}>
                    Enter a name that will be visible when someone searches for your UPI ID in their UPI app.
                  </li>
                  <li className={styles.subStepItem}>Enter your UPI ID.</li>
                  <li className={styles.subStepItem}>
                    <em>The QR code is optional. However, adding a QR code is easy and useful.</em>
                  </li>
                  <li className={styles.subStepItem}>
                    Click on{' '}
                    <span className={styles.btnPill}>
                      <Upload size={13} strokeWidth={2.5} />
                      Upload
                    </span>
                    .
                  </li>
                  <li className={styles.subStepItem}>Select your QR code image.</li>
                  <li className={styles.subStepItem}>Crop it to your liking.</li>
                  <li className={styles.subStepItem}>
                    Make sure the QR code is properly visible and clear.
                  </li>
                  <li className={styles.subStepItem}>
                    Click on{' '}
                    <span className={styles.btnPill}>
                      <Check size={13} strokeWidth={2.5} />
                      Crop and Save
                    </span>
                    .
                  </li>
                </ul>
                <div className={styles.tipBox}>
                  <Info size={15} className={styles.tipIcon} />
                  <span>Your payment details are now saved.</span>
                </div>
              </div>
            </div>

            {/* Step 7 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>7</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  You are ready to create invoices using the <strong>Use Payment Method</strong> feature.
                </p>
              </div>
            </div>
          </div>

          {/* Closing Note */}
          <div className={styles.closingNote}>
            <p className={styles.closingText}>Thank you for using Idyll Tracks Payments.</p>
            {nav && (
              <button 
                type="button" 
                onClick={() => nav('payment-details')}
                className={styles.goToInvoicesBtn}
              >
                <span>Go to Payment Details</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'auto-fill-invoice',
      title: 'How to Create Your Invoice With Auto Fill in Idyll Tracks Payments (Editors)',
      videoUrl: 'https://player.mediadelivery.net/embed/644758/5c7c3d7f-3788-4021-992e-0c5b8507c909?autoplay=false',
      isAvailable: true,
      renderGuide: (nav) => (
        <div className={styles.guideSection}>
          <div className={styles.guideHeader}>
            <h3 className={styles.guideTitle}>
              <FileText size={18} color="var(--text-primary)" />
              Written Instructions
            </h3>
          </div>

          <div className={styles.welcomeBanner}>
            Learn how to quickly generate invoices with one click using the Auto Fill feature.
          </div>

          <div className={styles.stepsList}>
            {/* Step 1 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Go to the Invoice page.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Click on{' '}
                  <span className={styles.btnPill}>
                    <Plus size={13} strokeWidth={2.5} />
                    Create New Invoice
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Click on{' '}
                  <span className={styles.btnPill}>
                    <Sparkles size={13} strokeWidth={2.5} />
                    Auto Fill
                  </span>
                  .
                </p>
                <div className={styles.tipBox}>
                  <Info size={15} className={styles.tipIcon} />
                  <span>
                    All the information you have saved will be fetched automatically. This includes your name, email, mobile number, today's date, and due date.
                  </span>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>4</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>You can now select any payment method you want.</p>
              </div>
            </div>

            {/* Step 5 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>5</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Enter your service name and what you did.</p>
              </div>
            </div>

            {/* Step 6 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>6</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Enter the quantity.</p>
              </div>
            </div>

            {/* Step 7 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>7</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Enter your rate.</p>
              </div>
            </div>

            {/* Step 8 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>8</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Click on{' '}
                  <span className={styles.btnPill}>
                    <Wallet size={13} strokeWidth={2.5} />
                    Use Saved Payment Method
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Step 9 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>9</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Select your saved payment method and click on{' '}
                  <span className={styles.btnPill}>
                    <Check size={13} strokeWidth={2.5} />
                    Select and Use
                  </span>
                  .
                </p>
                <div className={styles.tipBox}>
                  <Info size={15} className={styles.tipIcon} />
                  <span>
                    If you want to use a different payment method, go to Saved Payment Method again and select another payment method. Whichever payment method you choose will be applied to the invoice.
                  </span>
                </div>
              </div>
            </div>

            {/* Step 10 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>10</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Cross-check the entire invoice properly. If anything is missing, fill it in.
                </p>
              </div>
            </div>

            {/* Step 11 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>11</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Once everything is correct, click on{' '}
                  <span className={styles.btnPill}>
                    <Send size={13} strokeWidth={2.5} />
                    Submit
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Step 12 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>12</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Your invoice has been submitted.</p>
              </div>
            </div>
          </div>

          {/* Closing Note */}
          <div className={styles.closingNote}>
            <p className={styles.closingText}>Thank you for using Idyll Tracks Payments.</p>
            {nav && (
              <button 
                type="button" 
                onClick={() => nav('payments')}
                className={styles.goToInvoicesBtn}
              >
                <span>Go to Invoices</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'manual-invoice',
      title: 'How to Create an Invoice by Manually Filling in Your Details (Editors)',
      videoUrl: 'https://player.mediadelivery.net/embed/644758/24daa3e7-a429-404a-8831-31c115b12c36?autoplay=false',
      isAvailable: true,
      renderGuide: (nav) => (
        <div className={styles.guideSection}>
          <div className={styles.guideHeader}>
            <h3 className={styles.guideTitle}>
              <FileText size={18} color="var(--text-primary)" />
              Written Instructions
            </h3>
          </div>

          <div className={styles.welcomeBanner}>
            Welcome to the Idyll Tracks Payments tutorial.
          </div>

          <div className={styles.stepsList}>
            {/* Step 1 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  In the Invoice page, click on{' '}
                  <span className={styles.btnPill}>
                    <Plus size={13} strokeWidth={2.5} />
                    Create New Invoice
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Enter your full name.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Enter your email and number.</p>
                <div className={styles.tipBox}>
                  <Info size={15} className={styles.tipIcon} />
                  <span>Make sure your name, email, and number are proper and real.</span>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>4</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Select the date.</p>
              </div>
            </div>

            {/* Step 5 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>5</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Select the due date.</p>
                <div className={styles.tipBox}>
                  <Info size={15} className={styles.tipIcon} />
                  <span>Try to select the due date within six days from the selected invoice date.</span>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>6</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Write the service name and client name.</p>
              </div>
            </div>

            {/* Step 7 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>7</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Enter the quantity and rate.</p>
                <div className={styles.tipBox}>
                  <Info size={15} className={styles.tipIcon} />
                  <span>You can add up to 3 services in one invoice. If you have more services, you can create another invoice.</span>
                </div>
              </div>
            </div>

            {/* Step 8 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>8</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Based on the payment method you have selected, enter the required details in Payment Details and Notes.
                </p>
                <div className={styles.tipBox}>
                  <Info size={15} className={styles.tipIcon} />
                  <span>For example, if you have selected UPI, enter your UPI details.</span>
                </div>
              </div>
            </div>

            {/* Step 9 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>9</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  If you have selected UPI, you can also attach a QR code:
                </p>
                <ul className={styles.subStepsList}>
                  <li className={styles.subStepItem}>Select your clear QR code image.</li>
                  <li className={styles.subStepItem}>Crop the image and fit it into the proper square.</li>
                  <li className={styles.subStepItem}>
                    Click on{' '}
                    <span className={styles.btnPill}>
                      <Check size={13} strokeWidth={2.5} />
                      Crop & Save
                    </span>
                    .
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 10 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>10</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Once everything is done, check all the details and make sure everything has been filled in properly.
                </p>
              </div>
            </div>

            {/* Step 11 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>11</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>
                  Once you have checked everything, click on{' '}
                  <span className={styles.btnPill}>
                    <Send size={13} strokeWidth={2.5} />
                    Submit
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Step 12 */}
            <div className={styles.stepItem}>
              <div className={styles.stepNumber}>12</div>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>Your invoice will be submitted.</p>
              </div>
            </div>
          </div>

          {/* Closing Note */}
          <div className={styles.closingNote}>
            <p className={styles.closingText}>Thank you for using Idyll Tracks Payments.</p>
            {nav && (
              <button 
                type="button" 
                onClick={() => nav('payments')}
                className={styles.goToInvoicesBtn}
              >
                <span>Go to Invoices</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'kyc-verification',
      title: 'How to Complete KYC Verification & Document Upload (Editors)',
      isAvailable: false
    }
  ];

  // Section 2: Client Tutorials
  const clientTutorials: TutorialItem[] = [
    {
      id: 'client-access-invoices',
      title: 'How to Access Your Invoices in Idyll Tracks Payments',
      isAvailable: false
    },
    {
      id: 'client-pay-invoice',
      title: 'How to Pay an Invoice in Idyll Tracks Payments',
      isAvailable: false
    },
    {
      id: 'client-payment-history',
      title: 'How to View Your Payment History in Idyll Tracks Payments',
      isAvailable: false
    },
    {
      id: 'client-download-invoice',
      title: 'How to Download Your Invoice in Idyll Tracks Payments',
      isAvailable: false
    }
  ];

  // Section 3: Staff Tutorials (Restricted Role)
  const staffTutorials: StaffTutorialItem[] = [
    {
      id: 'staff-create-invoice-details',
      title: 'How to Create an Invoice by Filling in Your Details'
    },
    {
      id: 'staff-create-invoice-autofill',
      title: 'How to Create an Invoice With Auto Fill'
    },
    {
      id: 'staff-save-payment-methods',
      title: 'How to Save Your Payment Methods'
    },
    {
      id: 'staff-complete-kyc',
      title: 'How to Complete Aadhaar Card Verification (KYC)'
    }
  ];

  return (
    <div className={styles.tutorialContainer}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className={styles.title}>Tutorial</h1>
          </div>
          <span className={styles.badge}>Video Guides</span>
        </div>
        <p className={styles.subtitle}>
          Step-by-step video walkthroughs and written guides to help you make the most of Idyll Tracks Payments.
        </p>
      </div>

      {/* SECTION 1: Editor Tutorials */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <FileText size={20} color="var(--text-primary)" />
          Editor Tutorials
        </h2>
        <span className={styles.sectionBadge}>Editors</span>
      </div>

      <div className={styles.accordionList}>
        {editorTutorials.map((item) => {
          const isExpanded = expandedId === item.id;
          const isVideoLoading = !loadedVideos[item.id];

          return (
            <div 
              key={item.id} 
              className={`${styles.accordionCard} ${isExpanded ? styles.accordionCardExpanded : ''}`}
            >
              <button
                type="button"
                className={styles.accordionHeader}
                onClick={() => toggleAccordion(item.id)}
                aria-expanded={isExpanded}
              >
                <div className={styles.accordionTitleGroup}>
                  <h3 className={styles.accordionTitle}>{item.title}</h3>
                  {!item.isAvailable && (
                    <span className={styles.comingSoonPill}>Coming Soon</span>
                  )}
                </div>

                <motion.div 
                  className={`${styles.toggleIconCircle} ${isExpanded ? styles.toggleIconExpanded : styles.toggleIconCollapsed}`}
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ChevronDown size={18} strokeWidth={2.2} />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key={`accordion-content-${item.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ 
                      height: 'auto', 
                      opacity: 1,
                      transition: {
                        height: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.22, delay: 0.06 }
                      }
                    }}
                    exit={{ 
                      height: 0, 
                      opacity: 0,
                      transition: {
                        height: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.15 }
                      }
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className={styles.accordionBody}>
                      {item.isAvailable && item.videoUrl ? (
                        <>
                          {/* Video Player */}
                          <div className={styles.videoContainer}>
                            {isVideoLoading && (
                              <div className={styles.videoLoadingOverlay}>
                                <div className={styles.videoSpinner} />
                                <span className={styles.videoLoadingText}>Loading video...</span>
                              </div>
                            )}
                            <iframe
                              src={getEmbedUrl(item.videoUrl)}
                              loading="eager"
                              className={styles.videoIframe}
                              onLoad={() => setLoadedVideos(prev => ({ ...prev, [item.id]: true }))}
                              allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
                              allowFullScreen
                              title={item.title}
                            />
                          </div>

                          {/* Written Step-by-Step Guide with Button UI elements */}
                          {item.renderGuide && item.renderGuide(onNavigate)}
                        </>
                      ) : (
                        <div className={styles.comingSoonCard}>
                          <div className={styles.comingSoonIcon}>
                            <Clock size={24} />
                          </div>
                          <h4 className={styles.comingSoonTitle}>Video Coming Soon</h4>
                          <p className={styles.comingSoonDesc}>
                            We are currently recording this video tutorial. Once uploaded, the walkthrough and step-by-step instructions will appear right here.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* STRAIGHT LINE DIVIDER */}
      <hr className={styles.sectionDivider} />

      {/* SECTION 2: Client Tutorials (Restricted Role Notification) */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <Users size={20} color="var(--text-primary)" />
          Client Tutorials
        </h2>
        <span className={styles.lockedPill}>
          <Lock size={11} />
          Role Restricted
        </span>
      </div>

      <div className={styles.accordionList}>
        {clientTutorials.map((item) => (
          <div 
            key={item.id} 
            className={styles.accordionCard}
          >
            <button
              type="button"
              className={styles.accordionHeader}
              onClick={handleRoleRestrictedClick}
              title="Restricted: Click to check access"
            >
              <div className={styles.accordionTitleGroup}>
                <h3 className={styles.accordionTitle}>{item.title}</h3>
                <span className={styles.lockedPill}>
                  <Lock size={10} />
                  Client Only
                </span>
              </div>

              <div className={`${styles.toggleIconCircle} ${styles.toggleIconLocked}`}>
                <Lock size={15} />
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* STRAIGHT LINE DIVIDER */}
      <hr className={styles.sectionDivider} />

      {/* SECTION 3: Staff Tutorials (Restricted Role Notification) */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <ShieldCheck size={20} color="var(--text-primary)" />
          Staff Tutorials
        </h2>
        <span className={styles.lockedPill}>
          <Lock size={11} />
          Role Restricted
        </span>
      </div>

      <div className={styles.accordionList}>
        {staffTutorials.map((item) => (
          <div 
            key={item.id} 
            className={styles.accordionCard}
          >
            <button
              type="button"
              className={styles.accordionHeader}
              onClick={handleStaffItemClick}
              title="Restricted: Click to check access"
            >
              <div className={styles.accordionTitleGroup}>
                <h3 className={styles.accordionTitle}>{item.title}</h3>
                <span className={styles.lockedPill}>
                  <Lock size={10} />
                  Staff Only
                </span>
              </div>

              <div className={`${styles.toggleIconCircle} ${styles.toggleIconLocked}`}>
                <Lock size={15} />
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TutorialView;
