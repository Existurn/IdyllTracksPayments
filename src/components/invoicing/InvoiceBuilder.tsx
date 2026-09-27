import React, { useState, useEffect, useRef, useCallback } from 'react';
import Invoice from './Invoice';
import CurrencyConverter from './CurrencyConverter';
import Calculator from './Calculator';
import PercentageCalculator from './PercentageCalculator';
import { Download, Send, CheckCircle2, RefreshCw, ArrowLeft, Save, Calculator as CalculatorIcon, X, Check, FileText, Clock } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import idyllTrackLogo from '../../assets/IdyllTrackLogo.svg';
import './invoicing.css';
import { supabase } from "../../lib/supabaseClient";
import { logAction } from "../../utils/auditLogger";
import { sendInvoiceCreatedEmail, sendInvoiceAdminAlertEmail, sendInvoiceSubmittedUserEmail, isUserEmailNotificationsEnabled } from "../../utils/emailService";

interface InvoiceBuilderProps {
  onBack: () => void;
  onInvoiceCreated: () => void;
  isAdmin?: boolean;
  users?: { id: string; name: string; role?: string; avatarUrl?: string }[];
  defaultOwnerId?: string;
  creatorName?: string;
  userRole?: string;
  nextInvoiceNumber?: string;
  canCreateStaffInvoice?: boolean;
  canCreateEditorInvoice?: boolean;
  invoiceId?: string | null;
}



export default function InvoiceBuilder({ onBack, onInvoiceCreated, isAdmin = false, users: _users = [], defaultOwnerId, creatorName, userRole = 'team_member', nextInvoiceNumber = '1', canCreateStaffInvoice = false, canCreateEditorInvoice = false, invoiceId }: InvoiceBuilderProps) {
  const isDarkTheme = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const role = userRole === 'editor' ? 'editor' : 'team_member';
  const [invoiceType, setInvoiceType] = useState<'staff' | 'editor'>('staff');
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(defaultOwnerId || "");
  // Always use rupees
  const currency = '₹';
  
  const [invoiceData, setInvoiceData] = useState<any>({});
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'preparing' | 'downloaded'>('idle');
  const [submissionStage, setSubmissionStage] = useState<'idle' | 'sending' | 'success'>('idle');
  
  const [isLoading, setIsLoading] = useState(!!invoiceId);
  const [initialData, setInitialData] = useState<any>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState<Blob | null>(null);

  const isReadOnly = !!invoiceId;
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarToast, setSidebarToast] = useState<string | null>(null);
  const sidebarToastTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleModalState = (e: any) => {
      setIsModalOpen(Boolean(e.detail?.open));
    };
    window.addEventListener('modal-state-change', handleModalState);
    return () => window.removeEventListener('modal-state-change', handleModalState);
  }, []);

  const triggerSidebarToast = useCallback((msg = 'Copied') => {
    if (sidebarToastTimeoutRef.current) {
      clearTimeout(sidebarToastTimeoutRef.current);
    }
    setSidebarToast(msg);
    sidebarToastTimeoutRef.current = setTimeout(() => {
      setSidebarToast(null);
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarToastTimeoutRef.current) {
        clearTimeout(sidebarToastTimeoutRef.current);
      }
    };
  }, []);

  const [generatedInvoiceNo, setGeneratedInvoiceNo] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceId) return;
    
    const fetchNextInvoiceNo = async () => {
      try {
        let nameLetters = '';
        if (creatorName && creatorName.trim()) {
          nameLetters = creatorName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
        }

        if (!nameLetters) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const fullName = user.user_metadata?.legal_full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
              nameLetters = fullName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
            }
          } catch (e) {
            console.error("Error fetching user for invoice prefix", e);
          }
        }

        const prefix = nameLetters ? `IDY${nameLetters}` : 'IDY';

        const { data, error } = await supabase
          .from('invoices')
          .select('invoice_no')
          .neq('is_deleted', true);
        
        if (error) throw error;

        // Match either IDYROH-0001 or general IDY...-0001
        const prefixRegex = new RegExp(`^${prefix}-(\\d+)`, 'i');
        const numbers = (data || [])
          .map(d => {
            const match = d.invoice_no?.match(prefixRegex);
            return match ? parseInt(match[1], 10) : null;
          })
          .filter(n => n !== null) as number[];

        let nextNum = 1;
        while (numbers.includes(nextNum)) {
          nextNum++;
        }
        
        const paddedNum = nextNum.toString().padStart(4, '0');
        setGeneratedInvoiceNo(`${prefix}-${paddedNum}`);
      } catch (err) {
        console.error("Error fetching invoice numbers", err);
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        setGeneratedInvoiceNo(`IDY-${randomSuffix}`);
      }
    };
    
    fetchNextInvoiceNo();
  }, [invoiceId, creatorName]);

  useEffect(() => {
    if (defaultOwnerId) {
      setSelectedOwnerId(defaultOwnerId);
    }
  }, [defaultOwnerId]);

  // Fetch initial data if editing
  useEffect(() => {
    document.title = "Idyll Invoicing | Idyll Tracks Payments";
  }, []);

  useEffect(() => {
    if (!invoiceId && !selectedOwnerId) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setSelectedOwnerId(user.id);
        }
      });
    }
  }, [invoiceId, selectedOwnerId]);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!invoiceId) return;
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .single();
        if (error) throw error;
        
        if (data.invoice_data) {
          setInvoiceData(data.invoice_data);
          setInitialData(data.invoice_data);
        }
        if (data.owner_id) {
          setSelectedOwnerId(data.owner_id);
        } else if (data.creator_id) {
          setSelectedOwnerId(data.creator_id);
        }
      } catch (err) {
        console.error("Error fetching invoice", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoice();
  }, [invoiceId]);

  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [validationShakeKey, setValidationShakeKey] = useState(0);

  const clearFieldError = (key: string) => {
    setInvalidFields(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateInvoice = (): { isValid: boolean; errorMessage: string; invalid: Record<string, boolean> } => {
    const invalid: Record<string, boolean> = {};
    const missingLabels: string[] = [];

    // 1. Name (from)
    if (!invoiceData.from || !invoiceData.from.trim()) {
      invalid['from'] = true;
      missingLabels.push('Name');
    }

    // 2. Email / Phone (contactInfo)
    if (!invoiceData.contactInfo || !invoiceData.contactInfo.trim()) {
      invalid['contactInfo'] = true;
      missingLabels.push('Email / Phone');
    }

    // 3. Client Name (Bill To)
    if (!invoiceData.billTo || !invoiceData.billTo.trim()) {
      invalid['billTo'] = true;
      missingLabels.push('Client Name');
    }

    // 4. Date
    if (!invoiceData.date || !invoiceData.date.trim()) {
      invalid['date'] = true;
      missingLabels.push('Date');
    }

    // 5. Payment Type
    if (!invoiceData.paymentTerms || !invoiceData.paymentTerms.trim()) {
      invalid['paymentTerms'] = true;
      missingLabels.push('Payment Type');
    }

    // 6. Due Date
    if (!invoiceData.dueDate || !invoiceData.dueDate.trim()) {
      invalid['dueDate'] = true;
      missingLabels.push('Due Date');
    }

    // 7. Services / Items
    const isEditorInvoice = invoiceType === 'editor' || role === 'editor';
    if (isEditorInvoice) {
      if (!invoiceData.items || invoiceData.items.length === 0) {
        invalid['items'] = true;
        missingLabels.push('Items');
      } else {
        let hasItemDescError = false;
        let hasItemQtyError = false;
        let hasItemRateError = false;
        invoiceData.items.forEach((item: any) => {
          if (!item.description || !item.description.trim()) {
            invalid[`item_desc_${item.id}`] = true;
            hasItemDescError = true;
          }
          if (item.quantity === '' || item.quantity === null || item.quantity === undefined || Number(item.quantity) <= 0) {
            invalid[`item_qty_${item.id}`] = true;
            hasItemQtyError = true;
          }
          if (item.rate === '' || item.rate === null || item.rate === undefined || Number(item.rate) <= 0) {
            invalid[`item_rate_${item.id}`] = true;
            hasItemRateError = true;
          }
        });
        if (hasItemDescError) missingLabels.push('Item Description');
        if (hasItemQtyError) missingLabels.push('Item Quantity');
        if (hasItemRateError) missingLabels.push('Item Rate');
      }
    } else {
      if (!invoiceData.payroll || invoiceData.payroll.length === 0) {
        invalid['payroll'] = true;
        missingLabels.push('Services');
      } else {
        let hasServiceRoleError = false;
        let hasServiceQtyError = false;
        let hasServiceRateError = false;
        invoiceData.payroll.forEach((item: any) => {
          if (!item.role || !item.role.trim()) {
            invalid[`payroll_role_${item.id}`] = true;
            hasServiceRoleError = true;
          }
          if (item.quantity === '' || item.quantity === null || item.quantity === undefined || Number(item.quantity) <= 0) {
            invalid[`payroll_qty_${item.id}`] = true;
            hasServiceQtyError = true;
          }
          if (item.rate === '' || item.rate === null || item.rate === undefined || Number(item.rate) <= 0) {
            invalid[`payroll_rate_${item.id}`] = true;
            hasServiceRateError = true;
          }
        });
        if (hasServiceRoleError) missingLabels.push('Service Name');
        if (hasServiceQtyError) missingLabels.push('Service Quantity');
        if (hasServiceRateError) missingLabels.push('Service Rate');
      }
    }

    // Check subtotal / amount
    if (!invoiceData.amount || Number(invoiceData.amount) <= 0) {
      if (!missingLabels.some(l => l.includes('Rate') || l.includes('Quantity'))) {
        missingLabels.push('Total Amount (> ₹0)');
      }
    }

    // 8. Notes
    if (!invoiceData.notes || !invoiceData.notes.trim()) {
      invalid['notes'] = true;
      missingLabels.push('Notes (Payment Details)');
    }

    const isValid = Object.keys(invalid).length === 0 && missingLabels.length === 0;
    
    let errorMessage = '';
    if (!isValid) {
      if (missingLabels.length === 1 && (missingLabels[0].includes('Rate') || missingLabels[0].includes('Amount'))) {
        errorMessage = "Bro, are you running a charity? Rate can't be zero! Enter a real rate.";
      } else if (missingLabels.length === 1) {
        errorMessage = `Please fill in all fields: ${missingLabels[0]} is required.`;
      } else if (missingLabels.length === 2) {
        errorMessage = `Please fill in all fields: ${missingLabels[0]} and ${missingLabels[1]} are required.`;
      } else {
        errorMessage = `Please fill in all fields before sending the invoice: ${missingLabels.slice(0, 2).join(', ')}, and ${missingLabels.length - 2} more are missing.`;
      }
    }

    return { isValid, errorMessage, invalid };
  };

  const handleSaveAndDownload = async (): Promise<boolean> => {
    if (isSaving) return false;

    // VALIDATION: All fields must be filled before making or sending the invoice
    const validation = validateInvoice();
    if (!validation.isValid) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: validation.errorMessage,
          type: 'error',
          shake: true,
          duration: 6000
        }
      }));
      setInvalidFields(validation.invalid);
      setValidationShakeKey(prev => prev + 1);

      // Smooth scroll to the first invalid field
      setTimeout(() => {
        const firstInvalid = document.querySelector('.input-error, .date-error, .payment-dropdown-error');
        if (firstInvalid) {
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (firstInvalid.tagName === 'INPUT' || firstInvalid.tagName === 'TEXTAREA') {
            (firstInvalid as HTMLElement).focus();
          }
        }
      }, 50);

      return false;
    }

    setIsSaving(true);
    setSubmissionStage('sending');
    setIsExporting(true);
    setDownloadStatus('preparing');

    // Make sure we have an invoice no to save
    const finalInvoiceNo = invoiceData.invoiceNo || generatedInvoiceNo;
    const title = invoiceData.billTo || `Invoice #${finalInvoiceNo}`;
    
    // Pass final invoice no back to state just for PDF render if it's new
    if (!invoiceData.invoiceNo && generatedInvoiceNo) {
      setInvoiceData((prev: any) => ({...prev, invoiceNo: generatedInvoiceNo}));
    }
    
    // Give brief time for overlay to mount smoothly
    setTimeout(async () => {
      try {
        const element = document.getElementById('invoice-content');
        if (!element) throw new Error("Invoice content not found");
        
        element.classList.add('pdf-export');

        // Wait for all web fonts to load so html2canvas renders exact font metrics
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }

        // Options for clean professional exact A4 PDF export
        const opt = {
          margin:       0,
          filename:     `${finalInvoiceNo}.pdf`,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            width: 794,
            windowWidth: 794,
            scrollY: 0,
            scrollX: 0
          },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
          pagebreak:    { mode: ['css'] }
        };
        
        // Ensure all images (QR code, logos) in the live DOM element are completely loaded before capturing
        const imgElements = Array.from(element.querySelectorAll('img'));
        await Promise.all(imgElements.map(img => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 800);
          });
        }));

        // Create an isolated in-memory wrapper div
        const wrapper = document.createElement('div');
        wrapper.className = 'invoicing-wrapper pdf-export';
        wrapper.setAttribute('data-theme', 'light');
        wrapper.style.backgroundColor = '#FFFFFF';
        wrapper.style.color = '#111827';
        wrapper.style.border = 'none';
        wrapper.style.boxShadow = 'none';
        wrapper.style.padding = '0';
        wrapper.style.margin = '0';
        wrapper.style.outline = 'none';
        wrapper.style.width = '794px';
        wrapper.style.minWidth = '794px';
        wrapper.style.maxWidth = '794px';
        wrapper.style.fontFamily = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

        // Clone the element to avoid moving the actual DOM element
        const clone = element.cloneNode(true) as HTMLElement;
        clone.setAttribute('data-theme', 'light');
        clone.style.backgroundColor = '#FFFFFF';
        clone.style.color = '#111827';
        clone.style.border = 'none';
        clone.style.boxShadow = 'none';
        clone.style.padding = '0';
        clone.style.margin = '0';
        clone.style.outline = 'none';
        clone.style.width = '794px';
        clone.style.minWidth = '794px';
        clone.style.maxWidth = '794px';
        clone.style.fontFamily = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        wrapper.appendChild(clone);

        // Determine expected page count based on whether the QR page is actually in the rendered DOM
        const hasQrPage = Boolean(clone.querySelector('.invoice-qr-page'));

        const worker = html2pdf().set(opt).from(wrapper).toPdf().get('pdf').then((pdf: any) => {
          if (!hasQrPage) {
            // Strictly 1 page if QR code is not added: remove any spillover pages
            while (pdf.internal.getNumberOfPages() > 1) {
              pdf.deletePage(pdf.internal.getNumberOfPages());
            }
          } else {
            // Strictly 2 pages if QR code is added: Page 1 is Invoice, Page 2 is QR Code.
            // If html2pdf pushed QR page onto page 3 due to blank spillover on page 2, delete page 2.
            while (pdf.internal.getNumberOfPages() > 2) {
              if (pdf.internal.getNumberOfPages() === 3) {
                // Delete the middle blank page 2 so page 3 (QR code) becomes page 2
                pdf.deletePage(2);
              } else {
                pdf.deletePage(pdf.internal.getNumberOfPages());
              }
            }
          }
          return pdf.output('blob');
        });
        const pdfBlob = await worker;
        setGeneratedPdfBlob(pdfBlob);
        
        // Upload to Supabase Storage
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || 'anonymous';
        
        const timestamp = Date.now();
        const fileName = `${userId}/invoice-${timestamp}.pdf`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(fileName, pdfBlob, {
            contentType: 'application/pdf'
          });

        if (uploadError) {
          console.error("PDF upload error, continuing save anyway...", uploadError);
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('invoices')
          .getPublicUrl(fileName);
        
        const resolvedCreatorName = creatorName || 
          userData?.user?.user_metadata?.legal_full_name || 
          userData?.user?.user_metadata?.full_name || 
          userData?.user?.email?.split('@')[0] || 
          "User";

        const dbPayload = {
          title: title,
          client_name: invoiceData.billTo || '',
          pdf_url: publicUrl,
          creator_id: userId === 'anonymous' ? null : userId,
          creator_name: resolvedCreatorName,
          owner_id: (isAdmin && selectedOwnerId) ? selectedOwnerId : (userId === 'anonymous' ? null : userId),
          amount: invoiceData.amount || 0,
          due_date: invoiceData.dueDate || '',
          invoice_no: finalInvoiceNo,
          payment_method: invoiceData.paymentTerms || '',
          idyll_tracks_id: invoiceData.idyllTracksId || '',
          currency: currency,
          invoice_data: {
             ...invoiceData,
             currency,
             invoiceNo: finalInvoiceNo
          }
        };

        if (invoiceId) {
          // Update existing
          const { error: dbError } = await supabase
            .from('invoices')
            .update(dbPayload)
            .eq('id', invoiceId);
          if (dbError) throw new Error(`Database update failed: ${dbError.message}`);
          await logAction('Invoice Updated', `Updated invoice ${finalInvoiceNo} for ${invoiceData.clientName}`);
        } else {
          // Insert new
          const { error: dbError } = await supabase
            .from('invoices')
            .insert({
              ...dbPayload,
              status: "Pending" // New invoices start as Pending
            });
          if (dbError) throw new Error(`Database insert failed: ${dbError.message}`);
          await logAction('Invoice Created', `Created invoice ${finalInvoiceNo} for ${invoiceData.clientName}`);

          const creatorEmail = userData?.user?.email;
          const billedToName = invoiceData.billTo || invoiceData.clientName || 'Idyll Productions Pvt. Ltd.';
          const isUserEmailEnabled = isUserEmailNotificationsEnabled(
            userId !== 'anonymous' ? userId : undefined,
            userData?.user?.user_metadata
          );

          // 1. Notify the user that their invoice was successfully received & is under review (if opted in)
          if (creatorEmail && isUserEmailEnabled) {
            sendInvoiceSubmittedUserEmail({
              to: creatorEmail,
              userName: resolvedCreatorName,
              invoiceNumber: finalInvoiceNo,
              amount: invoiceData.amount || 0,
              clientName: billedToName,
              actionUrl: 'https://www.idylltrackspayments.online/payments',
              userId: userId !== 'anonymous' ? userId : undefined
            }).catch(e => console.warn('[InvoiceBuilder] Error sending creator invoice confirmation:', e));
          }

          // 2. Alert admin team of new invoice submission
          sendInvoiceAdminAlertEmail({
            invoiceNumber: finalInvoiceNo,
            creatorName: resolvedCreatorName,
            amount: invoiceData.amount || 0,
            clientName: billedToName
          }).catch(e => console.warn('[InvoiceBuilder] Error sending invoice admin alert:', e));

          // 3. If an external client email is provided (and different from creator), send client invoice
          if (invoiceData?.clientEmail && invoiceData.clientEmail !== creatorEmail) {
            sendInvoiceCreatedEmail({
              to: invoiceData.clientEmail,
              clientName: billedToName,
              invoiceNumber: finalInvoiceNo,
              amount: invoiceData.amount || 0,
              dueDate: invoiceData.dueDate || 'Upon Receipt',
              creatorName: resolvedCreatorName,
              actionUrl: publicUrl
            }).catch(e => console.warn('[InvoiceBuilder] Error sending client invoice email:', e));
          }
        }

        // Download locally using the SAME blob
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${finalInvoiceNo}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setDownloadStatus('downloaded');
        try {
          sessionStorage.removeItem('idyll_invoice_draft');
        } catch (e) {}

        // Sending completed! Smoothly transition to success on the same white page
        setTimeout(() => {
          setSubmissionStage('success');
          setIsSubmittedSuccess(true);
        }, 800);

      } catch (error: any) {
        console.error("Error saving invoice:", error);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: `Error: ${error.message || error}` }));
        setSubmissionStage('idle');
      } finally {
        const element = document.getElementById('invoice-content');
        if (element) {
          element.classList.remove('pdf-export');
        }
        setIsExporting(false);
        setIsSaving(false);
        setDownloadStatus('idle');
      }
    }, 250); 

    return true;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <RefreshCw size={24} className="spin-anim" /> Loading invoice...
      </div>
    );
  }

  return (
    <div className="invoicing-wrapper h-full overflow-y-auto w-full" style={{ backgroundColor: '#FFFFFF' }}>
      <div className="w-full" style={{ padding: '2rem 2.5rem 8rem 2.5rem', boxSizing: 'border-box' }}>
        
        {/* Global Header */}
        <div className="flex justify-between items-center no-print" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          {/* Brand Area */}
            <div className="flex items-center gap-3">
              <button 
                onClick={onBack}
                className="flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-neutral-100"
                title="Back to Payments"
                style={{ background: "transparent", color: "var(--theme-text)", fontWeight: 500, fontSize: '15px' }}
              >
                <ArrowLeft className="w-5 h-5" />
                Back to payments
              </button>
            </div>

            <div className="flex items-center gap-8 header-actions">
              {/* Invoice Type Toggle */}
              {(canCreateStaffInvoice || canCreateEditorInvoice) && !isAdmin && (
                <div className="flex rounded-lg p-1" style={{ background: "var(--theme-surface-secondary)", border: "1px solid var(--theme-border)" }}>
                  {canCreateStaffInvoice && (
                    <button
                      className="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                      onClick={() => setInvoiceType('staff')}
                      style={
                        invoiceType === 'staff'
                          ? { background: "var(--theme-surface)", color: "var(--theme-text)", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }
                          : { color: "var(--theme-text-muted)" }
                      }
                    >
                      Staff
                    </button>
                  )}
                  {canCreateEditorInvoice && (
                    <button
                      className="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                      onClick={() => setInvoiceType('editor')}
                      style={
                        invoiceType === 'editor'
                          ? { background: "var(--theme-surface)", color: "var(--theme-text)", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }
                          : { color: "var(--theme-text-muted)" }
                      }
                    >
                      Editor
                    </button>
                  )}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      const name = user.user_metadata?.legal_full_name || user.user_metadata?.full_name || '';
                      const email = user.email || '';
                      const mobile = user.user_metadata?.mobile_number || '';
                      let contactString = email;
                      if (mobile) {
                        contactString = `${email} | ${mobile}`;
                      }
                      let updatedInvoiceNo = invoiceData.invoiceNo || generatedInvoiceNo;
                      if (name && (!updatedInvoiceNo || updatedInvoiceNo.startsWith('IDY-'))) {
                        const nameLetters = name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
                        if (nameLetters) {
                          const numPart = updatedInvoiceNo?.match(/\d+$/)?.[0] || '0001';
                          updatedInvoiceNo = `IDY${nameLetters}-${numPart.padStart(4, '0')}`;
                          setGeneratedInvoiceNo(updatedInvoiceNo);
                        }
                      }

                      // Calculate today's date and due date (6 days from today)
                      const now = new Date();
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

                      const due = new Date(now);
                      due.setDate(due.getDate() + 6);
                      const dueStr = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;

                      setInitialData((prev: any) => ({
                        ...(prev || invoiceData),
                        from: name ? name.charAt(0).toUpperCase() + name.slice(1) : '',
                        contactInfo: contactString,
                        invoiceNo: updatedInvoiceNo,
                        date: todayStr,
                        dueDate: dueStr
                      }));
                      if (name) clearFieldError('from');
                      if (contactString) clearFieldError('contactInfo');
                      clearFieldError('date');
                      clearFieldError('dueDate');
                      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Autofilled with profile details and dates' }));
                    }
                  } catch (e) {
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Failed to autofill' }));
                  }
                }}
                style={{ 
                  flexShrink: 0,
                  backgroundColor: 'var(--black)',
                  color: 'var(--white)',
                  border: '1px solid var(--black)',
                  fontWeight: '600'
                }}
              >
                Autofill
              </button>

              {/* Single unified action button for everyone: Send & Download (or Update & Download / Download PDF) */}
              {!isReadOnly ? (
                <button 
                  className="btn btn-primary"
                  onClick={handleSaveAndDownload}
                  disabled={isSaving}
                  style={{
                    whiteSpace: 'nowrap', 
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    width: invoiceId ? '140px' : '130px',
                    padding: 0,
                    flexShrink: 0,
                    backgroundColor: 'var(--black)',
                    color: 'var(--white)'
                  }}
                >
                  <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      position: 'absolute',
                      top: 0, left: 0, right: 0,
                      transition: 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                      transform: downloadStatus === 'preparing' ? 'translateY(calc(-100% / 3))' : (downloadStatus === 'downloaded' ? 'translateY(calc(-200% / 3))' : 'translateY(0)')
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}>
                      <Send size={18} /> {invoiceId ? 'Update' : 'Submit'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}>
                      Saving...
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}>
                      <CheckCircle2 size={18} /> Saved!
                    </div>
                  </div>
                  <div style={{ visibility: 'hidden', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}>
                    <Send size={18} /> {invoiceId ? 'Update' : 'Submit'}
                  </div>
                </button>
              ) : (
                <button 
                  className="btn btn-primary"
                  onClick={handleSaveAndDownload}
                  disabled={isSaving}
                  style={{
                    whiteSpace: 'nowrap', 
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    width: '180px',
                    padding: 0,
                    flexShrink: 0,
                    backgroundColor: 'var(--black)',
                    color: 'var(--white)'
                  }}
                >
                  <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      position: 'absolute',
                      top: 0, left: 0, right: 0,
                      transition: 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                      transform: downloadStatus === 'preparing' ? 'translateY(calc(-100% / 3))' : (downloadStatus === 'downloaded' ? 'translateY(calc(-200% / 3))' : 'translateY(0)')
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem 1.5rem' }}>
                      <Download size={18} /> Download PDF
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem 1.5rem' }}>
                      Preparing...
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem 1.5rem' }}>
                      <CheckCircle2 size={18} /> Downloaded!
                    </div>
                  </div>
                  <div style={{ visibility: 'hidden', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.5rem' }}>
                    <Download size={18} /> Download PDF
                  </div>
                </button>
              )}

              <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .spin-anim { animation: spin 1s linear infinite; }
              `}</style>
            </div>
        </div>

        <div className="invoice-builder-main-container" style={{ width: '100%', maxWidth: '100%' }}>
          {isReadOnly && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg w-full no-print">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-amber-500" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-amber-700 font-medium">
                    This invoice has already been submitted and is in read-only mode.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div style={{ width: '100%', pointerEvents: isReadOnly ? 'none' : 'auto', opacity: isReadOnly ? 0.9 : 1 }}>
            <Invoice 
              role={role} 
              currency={currency} 
              isExporting={isExporting} 
              onDataChange={setInvoiceData} 
              nextInvoiceNumber={generatedInvoiceNo || nextInvoiceNumber}
              initialData={initialData}
              isNewInvoice={!invoiceId}
              isReadOnly={isReadOnly}
              targetUserId={selectedOwnerId || undefined}
              invalidFields={invalidFields}
              validationShakeKey={validationShakeKey}
              onClearError={clearFieldError}
            />
          </div>
        </div>

        {/* Floating Tools Trigger Button */}
        {!isModalOpen && (
          <button 
            type="button"
            onClick={() => setShowToolsDrawer(true)}
            className="no-print"
            title="Open Calculator & Percentage Tools"
            style={{
              position: 'fixed',
              bottom: '28px',
              right: '28px',
              zIndex: 90,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '8px',
              backgroundColor: 'var(--black, #111827)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <CalculatorIcon size={18} />
            <span>Calculator</span>
          </button>
        )}

        {/* Slide-out Drawer for Calculator & Percentage Tools */}
        {showToolsDrawer && (
          <div 
            className="no-print tools-drawer-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 100,
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(2px)'
            }}
            onClick={() => {
              setShowToolsDrawer(false);
              setSidebarToast(null);
            }}
          >
            <div 
              className="tools-drawer-panel"
              style={{
                width: '320px',
                maxWidth: '90vw',
                height: '100%',
                backgroundColor: '#FFFFFF',
                boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={e => e.stopPropagation()}
              onCopy={() => triggerSidebarToast('Copied')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem 0.75rem', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '1rem', color: '#111827' }}>
                  <CalculatorIcon size={18} />
                  <span>Tools & Calculator</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowToolsDrawer(false);
                    setSidebarToast(null);
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#6B7280' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem 3.5rem' }}>
                <div className="flex flex-col gap-5">
                  <Calculator onCopy={() => triggerSidebarToast('Copied')} />
                  <PercentageCalculator onCopy={() => triggerSidebarToast('Copied')} />
                </div>
              </div>

              {/* Bottom Connected Toast */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: '#111827',
                  color: '#FFFFFF',
                  padding: '13px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.15)',
                  transform: sidebarToast ? 'translateY(0)' : 'translateY(100%)',
                  transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                  zIndex: 50,
                  pointerEvents: sidebarToast ? 'auto' : 'none',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <Check size={17} style={{ color: '#10B981', flexShrink: 0 }} />
                <span>{sidebarToast || 'Copied'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Continuous Single White Page Submission Flow */}
        {submissionStage !== 'idle' && (
          <div className="invoice-fullscreen-white-flow">
            {submissionStage === 'sending' ? (
              <div className="invoice-flow-center-content">
                <div className="invoice-flow-spinner-wrap">
                  <div className="invoice-flow-spinner" />
                </div>

                <h2 className="invoice-flow-title">
                  Submitting Invoice...
                </h2>
                <p className="invoice-flow-subtitle">
                  Generating your PDF and submitting your invoice to the finance team.
                </p>

                <div className="invoice-flow-meta">
                  Invoice #{invoiceData.invoiceNo || generatedInvoiceNo}
                </div>
              </div>
            ) : (
              <div className="invoice-flow-center-content" style={{ maxWidth: '750px', width: '100%' }}>
                {/* Clean SVG Checkmark Circle matching screenshot with NO GLOW */}
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
                  <svg 
                    viewBox="0 0 100 100" 
                    width="130" 
                    height="130" 
                    style={{ display: 'block', overflow: 'visible' }}
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="5"
                      strokeLinecap="round"
                      className="success-tick-circle-noglow"
                    />
                    <path
                      d="M30 52 L43 65 L70 38"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="5.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="success-tick-check-noglow"
                    />
                  </svg>
                </div>

                <h2 className="text-3xl font-bold text-gray-900" style={{ marginBottom: '16px', textAlign: 'center' }}>
                  Thanks, your invoice has been submitted successfully.
                </h2>
                <p className="text-gray-600 text-center" style={{ fontSize: '20px', marginBottom: '32px', maxWidth: '650px', lineHeight: 1.5 }}>
                  We’ve received your invoice. Our Finance team will review it shortly.
                </p>
                <div className="flex items-center justify-center gap-6 flex-wrap" style={{ marginBottom: '12px' }}>
                  {invoiceData.idyllTracksId && (
                    <p className="font-semibold text-gray-800 text-center" style={{ fontSize: '18px', margin: 0 }}>
                      Invoice ID: {invoiceData.idyllTracksId}
                    </p>
                  )}
                  <p className="font-semibold text-gray-800 text-center" style={{ fontSize: '18px', margin: 0 }}>
                    Invoice Name: {invoiceData.invoiceNo || generatedInvoiceNo}
                  </p>
                </div>
                <p className="text-gray-500 text-center" style={{ fontSize: '18px', marginBottom: '40px', maxWidth: '450px', lineHeight: 1.5 }}>
                  A copy of your invoice has been saved for your records. You can also download it anytime.
                </p>

                <div className="flex flex-row justify-center gap-4 flex-wrap">
                  <button 
                    onClick={() => {
                      if (generatedPdfBlob) {
                        const url = URL.createObjectURL(generatedPdfBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${invoiceData.invoiceNo || generatedInvoiceNo}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }
                    }}
                    className="btn btn-outline"
                    style={{ width: 'auto', minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Download size={18} /> Download Invoice Again
                  </button>
                  
                  <button 
                    onClick={onInvoiceCreated}
                    className="btn btn-primary"
                    style={{ width: 'auto', minWidth: '220px' }}
                  >
                    Back to Payments
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
