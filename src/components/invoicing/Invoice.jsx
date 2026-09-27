import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, RefreshCw, Upload, Check, X, Crop, AlertCircle, Info, Wallet, QrCode, User, Building2, Calendar, CreditCard, FileText, Lock, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import logoImg from '../../assets/Idyll_Productions_Black.png';
import upiFooterImg from '../../assets/Idyll_X_Upi.png';
import CustomDropdown from "../ui/CustomDropdown";
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropImage';
import DatePicker from '../DatePicker/DatePicker';
import { format } from 'date-fns';

import paypalLogo from '../../assets/payment-methods/Paypal Logo.png';
import upiLogo from '../../assets/payment-methods/Upi Logo.png';
import wireTransferLogo from '../../assets/payment-methods/Wire Transfer Logo.png';
import wiseLogo from '../../assets/payment-methods/Wise Logo.png';

const PAYMENT_METHODS = [
  { value: 'Bank Transfer', label: 'Bank Transfer', logo: wireTransferLogo },
  { value: 'UPI', label: 'UPI', logo: upiLogo },
  { value: 'PayPal', label: 'PayPal', logo: paypalLogo },
  { value: 'Wise', label: 'Wise', logo: wiseLogo }
];

const formatAmount = (amount, currencySymbol = '₹') => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return '0.00';
  const num = Number(amount);
  const isIndianSystem = currencySymbol === '₹' || currencySymbol === 'Rs' || currencySymbol === 'INR' || !['$', '€', '£'].includes(currencySymbol);
  return num.toLocaleString(isIndianSystem ? 'en-IN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const numberToWords = (amount, currencySymbol = '₹') => {
  if (amount === undefined || amount === null || isNaN(amount)) return '';
  const num = Math.round(Number(amount) * 100) / 100;
  if (num === 0) {
    if (currencySymbol === '$') return 'Zero Dollars Only';
    if (currencySymbol === '€') return 'Zero Euros Only';
    if (currencySymbol === '£') return 'Zero Pounds Only';
    return 'Zero Rupees Only';
  }

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 
                'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 
                'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelowThousand = (n) => {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  };

  const parts = num.toFixed(2).split('.');
  let integerPart = parseInt(parts[0], 10);
  const decimalPart = parseInt(parts[1], 10);

  let words = '';
  const isIndianSystem = currencySymbol === '₹' || currencySymbol === 'Rs' || currencySymbol === 'INR' || !['$', '€', '£'].includes(currencySymbol);

  if (isIndianSystem) {
    const crore = Math.floor(integerPart / 10000000);
    integerPart %= 10000000;
    const lakh = Math.floor(integerPart / 100000);
    integerPart %= 100000;
    const thousand = Math.floor(integerPart / 1000);
    integerPart %= 1000;
    const remainder = integerPart;

    if (crore > 0) words += convertBelowThousand(crore) + ' Crore ';
    if (lakh > 0) words += convertBelowThousand(lakh) + ' Lakh ';
    if (thousand > 0) words += convertBelowThousand(thousand) + ' Thousand ';
    if (remainder > 0) words += convertBelowThousand(remainder) + ' ';
  } else {
    const billion = Math.floor(integerPart / 1000000000);
    integerPart %= 1000000000;
    const million = Math.floor(integerPart / 1000000);
    integerPart %= 1000000;
    const thousand = Math.floor(integerPart / 1000);
    integerPart %= 1000;
    const remainder = integerPart;

    if (billion > 0) words += convertBelowThousand(billion) + ' Billion ';
    if (million > 0) words += convertBelowThousand(million) + ' Million ';
    if (thousand > 0) words += convertBelowThousand(thousand) + ' Thousand ';
    if (remainder > 0) words += convertBelowThousand(remainder) + ' ';
  }

  words = words.trim();

  const isOne = parseInt(parts[0], 10) === 1;
  let currencyUnit = isOne ? 'Rupee' : 'Rupees';
  let subunit = decimalPart === 1 ? 'Paisa' : 'Paise';

  if (currencySymbol === '$') {
    currencyUnit = isOne ? 'Dollar' : 'Dollars';
    subunit = decimalPart === 1 ? 'Cent' : 'Cents';
  } else if (currencySymbol === '€') {
    currencyUnit = isOne ? 'Euro' : 'Euros';
    subunit = decimalPart === 1 ? 'Cent' : 'Cents';
  } else if (currencySymbol === '£') {
    currencyUnit = isOne ? 'Pound' : 'Pounds';
    subunit = decimalPart === 1 ? 'Penny' : 'Pence';
  }

  if (!words) {
    words = 'Zero';
  }

  let result = `${words} ${currencyUnit}`;
  if (decimalPart > 0) {
    result += ` and ${convertBelowThousand(decimalPart)} ${subunit}`;
  }
  result += ' Only';

  return result;
};

const PaymentDropdown = ({ value, onChange, isExporting, hasError = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selected = PAYMENT_METHODS.find(m => 
    m.value === value || 
    m.label === value ||
    (value && (value.toLowerCase().includes('bank') || value.toLowerCase().includes('wire')) && m.value === 'Bank Transfer')
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isExporting) {
    return (
      <div style={{ minHeight: '1.5rem', width: '100%', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        <span>{selected?.label || value}</span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ flex: 1, width: '100%', minWidth: '240px' }} ref={dropdownRef}>
      <div 
        className={`cursor-pointer ${hasError ? 'payment-dropdown-error' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.1rem', 
          backgroundColor: 'var(--bg-light)', 
          borderRadius: '6px', 
          border: '1px solid var(--gray-200, #E5E7EB)',
          fontSize: '15px',
          color: 'var(--theme-text)',
          height: '50px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 500, color: selected ? 'var(--theme-text, #111827)' : 'var(--gray-400)', lineHeight: 1.2 }}>
          {selected ? selected.label : 'Select Payment Type'}
        </span>
        <ChevronDown 
          size={16} 
          style={{ 
            color: 'var(--gray-500, #6B7280)', 
            transform: isOpen ? 'rotate(180deg)' : 'none', 
            transition: 'transform 0.2s ease', 
            flexShrink: 0 
          }} 
        />
      </div>

      {isOpen && (
        <div 
          className="absolute top-full left-0 min-w-full w-full mt-2 bg-white rounded-lg shadow-xl z-50 overflow-hidden"
          style={{ 
            border: '1px solid #E5E7EB', 
            boxShadow: '0 16px 32px -4px rgba(0, 0, 0, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.06)',
            padding: '6px',
            boxSizing: 'border-box'
          }}
        >
          {PAYMENT_METHODS.map((method) => {
            const isSelected = value === method.value;
            return (
              <div 
                key={method.value}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  backgroundColor: isSelected ? '#F3F4F6' : 'transparent',
                  transition: 'background-color 0.15s ease',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => {
                  onChange(method.value);
                  setIsOpen(false);
                }}
              >
                <span style={{ 
                  fontSize: '15px', 
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? '#111827' : '#374151',
                  lineHeight: 1.2,
                  display: 'block'
                }}>
                  {method.label}
                </span>
                {isSelected && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={18} strokeWidth={2.5} style={{ color: '#111827' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


const RenderField = ({ 
  isExporting, 
  value, 
  type = "text", 
  onChange, 
  onKeyDown,
  onBlur,
  min,
  step,
  placeholder, 
  style, 
  isTextarea, 
  maxLength, 
  className = '', 
  hideCounter = false,
  readOnly = false,
  disabled = false
}) => {
  if (isExporting) {
    const exportStyle = { ...style };
    delete exportStyle.backgroundColor;
    delete exportStyle.padding;
    return <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', minHeight: '1.5rem', ...exportStyle }}>{value}</div>;
  }
  const inputEl = isTextarea ? (
    <textarea 
      rows="3" 
      placeholder={placeholder} 
      value={value} 
      onChange={onChange} 
      maxLength={maxLength} 
      className={className} 
      style={style} 
      readOnly={readOnly}
      disabled={disabled}
      onInput={e => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
      }} 
    />
  ) : (
    <input 
      type={type} 
      placeholder={placeholder} 
      value={value} 
      onChange={onChange} 
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      min={min}
      step={step}
      maxLength={maxLength} 
      className={className} 
      style={style} 
      readOnly={readOnly}
      disabled={disabled}
    />
  );

  if (maxLength && type !== 'number' && type !== 'date' && !hideCounter) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: style?.width ? style.width : (style?.flex ? 'auto' : '100%'), flex: style?.flex }}>
        {inputEl}
        <span className="no-print" style={{ alignSelf: 'flex-end', fontSize: '0.65rem', color: 'var(--gray-400)', marginTop: '4px', lineHeight: '1' }}>
          {String(value || '').length} / {maxLength}
        </span>
      </div>
    );
  }

  return inputEl;
};

/**
 * @param {{
 *   role?: any;
 *   currency?: any;
 *   isExporting?: boolean;
 *   onDataChange?: (data: any) => void;
 *   nextInvoiceNumber?: string;
 *   initialData?: any;
 *   isNewInvoice?: boolean;
 *   isReadOnly?: boolean;
 *   targetUserId?: string | null | undefined;
 *   invalidFields?: any;
 *   validationShakeKey?: any;
 *   onClearError?: any;
 * }} props
 */
const Invoice = ({ 
  role, 
  currency, 
  isExporting, 
  onDataChange, 
  nextInvoiceNumber = '1', 
  initialData = null, 
  isNewInvoice = true, 
  isReadOnly = false, 
  targetUserId = null,
  invalidFields = {},
  validationShakeKey = 0,
  onClearError
}) => {
  const clearFieldError = (key) => {
    if (onClearError) {
      onClearError(key);
    }
  };

  const [items, setItems] = useState([{ id: 1, description: '', quantity: 1, rate: '' }]);
  const [notes, setNotes] = useState('');
  const [payroll, setPayroll] = useState([{ id: 1, role: '', quantity: 1, rate: '' }]);

  const lastRateToastRef = useRef(0);

  const triggerRateErrorToast = useCallback(() => {
    const now = Date.now();
    if (now - lastRateToastRef.current < 1200) return;
    lastRateToastRef.current = now;

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: {
        message: "Rate must be greater than 0.",
        type: 'error',
        shake: true,
        duration: 5000
      }
    }));
  }, []);

  const triggerSavageRateToast = triggerRateErrorToast;
  
  // UPI QR feature state
  const [showUpiQR, setShowUpiQR] = useState(false);
  const [upiImageSrc, setUpiImageSrc] = useState(null);
  const [upiCroppedImage, setUpiCroppedImage] = useState(null);

  const qrDisplaySrc = useMemo(() => {
    if (!upiCroppedImage) return null;
    if (typeof upiCroppedImage === 'string') return upiCroppedImage;
    if (upiCroppedImage instanceof Blob) {
      try {
        return URL.createObjectURL(upiCroppedImage);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [upiCroppedImage]);

  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null);
  
  const [savedMethods, setSavedMethods] = useState([]);
  const [showSavedPaymentsModal, setShowSavedPaymentsModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('wire');

  useEffect(() => {
    const isAnyModalOpen = showCropModal || showSavedPaymentsModal;
    window.dispatchEvent(new CustomEvent('modal-state-change', { detail: { open: isAnyModalOpen } }));
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showCropModal, showSavedPaymentsModal]);

  const formatMethodNotes = useCallback((method) => {
    if (!method || !method.details) return '';
    const d = method.details;

    if (method.type === 'wire') {
      const lines = ['Bank Transfer Details:'];
      if (d.accountName) lines.push(`Account Holder Name: ${d.accountName}`);
      if (d.accountNumber) lines.push(`Account Number: ${d.accountNumber}`);
      if (d.ifscCode) lines.push(`IFSC Code: ${d.ifscCode}`);
      if (d.bankName) lines.push(`Bank Name: ${d.bankName}`);
      return lines.join('\n');
    }

    if (method.type === 'upi') {
      const lines = ['UPI Payment Details:'];
      if (d.accountName) lines.push(`Account Holder Name: ${d.accountName}`);
      if (d.upiId) lines.push(`UPI ID: ${d.upiId}`);
      return lines.join('\n');
    }

    if (method.type === 'paypal') {
      const lines = ['PayPal Details:'];
      if (d.name) lines.push(`Full Name: ${d.name}`);
      if (d.email) lines.push(`PayPal Email: ${d.email}`);
      if (d.country) lines.push(`Country: ${d.country}`);
      if (d.currency) lines.push(`Currency: ${d.currency}`);
      return lines.join('\n');
    }

    if (method.type === 'wise') {
      const lines = ['Wise Details:'];
      if (d.accountName) lines.push(`Recipient Name: ${d.accountName}`);
      if (d.email) lines.push(`Wise Email: ${d.email}`);
      if (d.country) lines.push(`Country: ${d.country}`);
      if (d.currency) lines.push(`Currency: ${d.currency}`);
      if (d.accountNumber) lines.push(`Account Number / IBAN: ${d.accountNumber}`);
      if (d.bankName) lines.push(`Bank Name: ${d.bankName}`);
      if (d.swiftCode) lines.push(`Routing / Sort Code / SWIFT: ${d.swiftCode}`);
      return lines.join('\n');
    }

    return '';
  }, []);

  const applyMethodTerms = useCallback((method) => {
    if (method.type === 'wire') {
      setPaymentTerms('Bank Transfer');
      setUpiImageSrc(null);
      setUpiCroppedImage(null);
      setShowUpiQR(false);
    } else if (method.type === 'upi') {
      setPaymentTerms('UPI');
      if (method.details?.qrImage) {
        setUpiImageSrc(method.details.qrImage);
        setUpiCroppedImage(method.details.qrImage);
        setShowUpiQR(true);
      } else {
        setUpiImageSrc(null);
        setUpiCroppedImage(null);
        setShowUpiQR(false);
      }
    } else if (method.type === 'paypal') {
      setPaymentTerms('PayPal');
      setUpiImageSrc(null);
      setUpiCroppedImage(null);
      setShowUpiQR(false);
    } else if (method.type === 'wise') {
      setPaymentTerms('Wise');
      setUpiImageSrc(null);
      setUpiCroppedImage(null);
      setShowUpiQR(false);
    }
  }, []);

  const fetchMethods = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentAuthId = user?.id;
      const effectiveUserId = targetUserId || currentAuthId;
      if (!effectiveUserId) return;

      let methods = [];

      // Query database user_roles table for this specific user's saved payment methods
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('overrides')
        .eq('id', effectiveUserId)
        .maybeSingle();

      if (roleRow?.overrides?.payment_methods && Array.isArray(roleRow.overrides.payment_methods)) {
        methods = roleRow.overrides.payment_methods;
      } else if (user && user.id === effectiveUserId && user.user_metadata?.payment_methods) {
        methods = user.user_metadata.payment_methods;
      }

      // Filter only supported payout methods
      const validMethods = (methods || []).filter(m => 
        ['wire', 'upi', 'paypal', 'wise'].includes(m.type)
      );

      setSavedMethods(validMethods);
      return validMethods;
    } catch (err) {
      console.error('Error fetching saved payment methods for target user:', err);
      return [];
    }
  }, [targetUserId]);

  const handleUseSavedPaymentDetails = async () => {
    await fetchMethods();

    // If a payment method is already chosen in the dropdown, open that tab in the modal; otherwise default to wire
    if (paymentTerms) {
      const term = paymentTerms.toLowerCase();
      if (term.includes('wire') || term.includes('bank')) {
        setActiveModalTab('wire');
      } else if (term.includes('paypal')) {
        setActiveModalTab('paypal');
      } else if (term.includes('upi')) {
        setActiveModalTab('upi');
      } else if (term.includes('wise')) {
        setActiveModalTab('wise');
      }
    } else {
      setActiveModalTab('wire');
    }

    // Opening the modal MUST NOT automatically select or apply any payment method.
    // The user must manually choose a saved payment method and click "Select & Use".
    setShowSavedPaymentsModal(true);
  };

  useEffect(() => {
    fetchMethods();

    const handleUpdate = (e) => {
      if (!targetUserId || e.detail?.userId === targetUserId) {
        fetchMethods();
      }
    };
    window.addEventListener('payment-methods-updated', handleUpdate);
    return () => window.removeEventListener('payment-methods-updated', handleUpdate);
  }, [fetchMethods, targetUserId]);

  const handleOpenSavedPaymentsModal = () => {
    fetchMethods();
    if (paymentTerms) {
      const term = paymentTerms.toLowerCase();
      if (term.includes('wire') || term.includes('bank')) {
        setActiveModalTab('wire');
      } else if (term.includes('paypal')) {
        setActiveModalTab('paypal');
      } else if (term.includes('upi')) {
        setActiveModalTab('upi');
      } else if (term.includes('wise')) {
        setActiveModalTab('wise');
      }
    }
    setShowSavedPaymentsModal(true);
  };

  const renderModalPrimaryDetail = (method) => {
    if (!method.details) return method.type === 'wire' ? 'Bank Transfer' : method.type.toUpperCase();
    const d = method.details;
    if (method.type === 'paypal') {
      return d.email ? `${d.email}${d.name ? ` (${d.name})` : ''}` : d.name || 'PayPal Account';
    }
    if (method.type === 'upi') {
      return d.upiId ? `${d.upiId}${d.accountName ? ` (${d.accountName})` : ''}` : 'UPI ID';
    }
    if (method.type === 'wire') {
      const bank = d.bankName || 'Bank Transfer';
      const acc = d.accountNumber ? ` • A/C ${d.accountNumber}` : '';
      const holder = d.accountName ? ` (${d.accountName})` : '';
      return `${bank}${acc}${holder}`;
    }
    if (method.type === 'wise') {
      return d.accountName ? `${d.accountName}${d.email ? ` • ${d.email}` : ''}` : d.email || 'Wise Account';
    }
    return method.type;
  };

  const renderModalSecondaryDetail = (method) => {
    if (!method.details) return null;
    const d = method.details;

    if (method.type === 'upi') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {d.qrImage && (
            <span className="saved-payment-qr-badge">
              <Check size={12} strokeWidth={2.5} /> QR Code Available
            </span>
          )}
        </div>
      );
    }

    if (method.type === 'wire') {
      const parts = [];
      if (d.ifscCode) parts.push(`IFSC: ${d.ifscCode}`);
      return parts.length > 0 ? parts.join(' • ') : null;
    }

    if (method.type === 'paypal') {
      const parts = [];
      if (d.country) parts.push(d.country);
      if (d.currency) parts.push(d.currency);
      return parts.length > 0 ? parts.join(' • ') : null;
    }

    if (method.type === 'wise') {
      const parts = [];
      if (d.accountNumber) parts.push(`A/C: ${d.accountNumber}`);
      if (d.bankName) parts.push(`Bank: ${d.bankName}`);
      if (d.swiftCode) parts.push(`SWIFT: ${d.swiftCode}`);
      if (d.country) parts.push(d.country);
      return parts.length > 0 ? parts.join(' • ') : null;
    }

    return null;
  };

  const handleSelectSavedMethod = (method) => {
    setShowSavedPaymentsModal(false);
    const detailsText = formatMethodNotes(method);
    // Completely replace existing payment details with newly selected details (do not append)
    setNotes(detailsText);
    applyMethodTerms(method);
    clearFieldError('notes');
    clearFieldError('paymentTerms');
    const paymentLabel = method.type === 'wire' ? 'Bank Transfer' : method.type.toUpperCase();
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: `Applied saved ${paymentLabel} details.` 
    }));
  };

  const [idyllTracksId, setIdyllTracksId] = useState(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'IDY';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  });
  
  // Controlled states
  const [invoiceNo, setInvoiceNo] = useState(nextInvoiceNumber);
  const [from, setFrom] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [billTo] = useState('Idyll Productions Pvt. Ltd.');
  const [date, setDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invoiceType, setInvoiceType] = useState('100%');

  useEffect(() => {
    if (isNewInvoice && nextInvoiceNumber && !initialData) {
      setInvoiceNo(nextInvoiceNumber);
    }
  }, [nextInvoiceNumber, isNewInvoice, initialData]);

  const invoiceTypeOptions = [
    { value: "100%", label: "100%" },
    { value: "50%", label: "50%" },
    { value: "UPFRONT 100%", label: "UPFRONT 100%" },
    { value: "UPFRONT 50%", label: "UPFRONT 50%" }
  ];

  const isEditor = role === 'editor';

  const DRAFT_STORAGE_KEY = 'idyll_invoice_draft';

  // Restore draft if new invoice and no initialData provided
  useEffect(() => {
    if (isNewInvoice && !initialData) {
      try {
        const savedDraftStr = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraftStr) {
          const draft = JSON.parse(savedDraftStr);
          if (draft.items && draft.items.length > 0) {
            setItems(draft.items.map(i => ({ ...i, rate: (Number(i.rate) <= 0 || i.rate === 0) ? '' : i.rate })));
          }
          if (draft.payroll && draft.payroll.length > 0) {
            setPayroll(draft.payroll.map(p => ({ 
              ...p, 
              role: p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : '',
              rate: (Number(p.rate) <= 0 || p.rate === 0) ? '' : p.rate 
            })));
          }
          if (draft.from) setFrom(draft.from.charAt(0).toUpperCase() + draft.from.slice(1));
          if (draft.contactInfo) setContactInfo(draft.contactInfo);
          if (draft.date) setDate(draft.date);
          if (draft.dueDate) setDueDate(draft.dueDate);
          if (draft.invoiceType) setInvoiceType(draft.invoiceType);
          if (draft.idyllTracksId) setIdyllTracksId(draft.idyllTracksId);
        }
        // Payment Method and Payment Details & Notes MUST be completely blank by default when opening Create Invoice!
        setPaymentTerms('');
        setNotes('');
        setUpiImageSrc(null);
        setUpiCroppedImage(null);
        setShowUpiQR(false);
      } catch (e) {
        console.error('Error restoring invoice draft:', e);
      }
    }
  }, [isNewInvoice, initialData]);

  // Save draft whenever user makes changes to fields
  useEffect(() => {
    if (isNewInvoice && !initialData) {
      try {
        const draft = {
          items,
          payroll,
          notes,
          from,
          contactInfo,
          billTo,
          date,
          paymentTerms,
          dueDate,
          invoiceType,
          idyllTracksId,
          upiCroppedImage: typeof upiCroppedImage === 'string' ? upiCroppedImage : null
        };
        const hasContent = notes || from || contactInfo || date || dueDate || 
          (items && items.some(i => i.description || (i.rate && i.rate > 0))) || 
          (payroll && payroll.some(p => p.role || (p.rate && p.rate > 0)));
        if (hasContent) {
          sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        }
      } catch (e) {
        console.error('Error saving invoice draft:', e);
      }
    }
  }, [isNewInvoice, initialData, items, payroll, notes, from, contactInfo, billTo, date, paymentTerms, dueDate, invoiceType, idyllTracksId, upiCroppedImage]);

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      if (initialData.items) {
        setItems(initialData.items.map(i => ({ ...i, rate: (Number(i.rate) <= 0 || i.rate === 0) ? '' : i.rate })));
      }
      if (initialData.payroll) {
        setPayroll(initialData.payroll.map(p => ({ 
          ...p, 
          role: p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : '',
          rate: (Number(p.rate) <= 0 || p.rate === 0) ? '' : p.rate 
        })));
      }
      if (initialData.notes) setNotes(initialData.notes);
      if (initialData.invoiceNo) setInvoiceNo(initialData.invoiceNo);
      if (initialData.from) setFrom(initialData.from.charAt(0).toUpperCase() + initialData.from.slice(1));
      if (initialData.contactInfo) setContactInfo(initialData.contactInfo);
      if (initialData.date) setDate(initialData.date);
      if (initialData.paymentTerms) setPaymentTerms(initialData.paymentTerms);
      if (initialData.dueDate) setDueDate(initialData.dueDate);
      if (initialData.invoiceType) setInvoiceType(initialData.invoiceType);
      if (initialData.idyllTracksId) setIdyllTracksId(initialData.idyllTracksId);
      if (initialData.upiCroppedImage || initialData.qrImage) {
        const qr = initialData.upiCroppedImage || initialData.qrImage;
        setUpiCroppedImage(qr);
        setUpiImageSrc(qr);
        setShowUpiQR(true);
      }
    }
  }, [initialData]);

  const calculateSubtotal = () => {
    if (isEditor) {
      return items.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0), 0);
    } else {
      return payroll.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0), 0);
    }
  };

  const subtotal = calculateSubtotal();

  // Pass data up to InvoiceBuilder for Firebase/Supabase save
  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        invoiceNo,
        dueDate,
        amount: subtotal,
        idyllTracksId,
        from: from ? from.charAt(0).toUpperCase() + from.slice(1) : '',
        contactInfo,
        billTo,
        date,
        paymentTerms,
        invoiceType,
        items,
        payroll: payroll.map(p => ({
          ...p,
          role: p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : ''
        })),
        notes,
        upiCroppedImage: typeof upiCroppedImage === 'string' ? upiCroppedImage : qrDisplaySrc
      });
    }
  }, [invoiceNo, dueDate, subtotal, idyllTracksId, from, contactInfo, billTo, date, paymentTerms, invoiceType, items, payroll, notes, upiCroppedImage, qrDisplaySrc, onDataChange]);

  const addItem = () => setItems([...items, { id: Date.now(), description: '', quantity: 1, rate: '' }]);
  const removeItem = (id) => {
    if (items.length <= 1) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'You cannot delete this service. At least one service is required.' }));
      return;
    }
    setItems(items.filter(i => i.id !== id));
  };
  const updateItem = (id, field, value) => {
    if (field === 'rate') {
      if (value !== '' && (Number(value) <= 0 || isNaN(Number(value)) || String(value).trim().startsWith('-'))) {
        triggerSavageRateToast();
        setItems(items.map(item => item.id === id ? { ...item, rate: '' } : item));
        return;
      }
    }
    if (field === 'quantity') {
      if (value !== '' && (Number(value) <= 0 || isNaN(Number(value)) || String(value).trim().startsWith('-'))) {
        setItems(items.map(item => item.id === id ? { ...item, quantity: 1 } : item));
        return;
      }
    }
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addPayroll = () => { if (payroll.length < 3) setPayroll([...payroll, { id: Date.now(), role: '', quantity: 1, rate: '' }]); };
  const removePayroll = (id) => {
    if (payroll.length <= 1) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'You cannot delete this service. At least one service is required.' }));
      return;
    }
    setPayroll(payroll.filter(i => i.id !== id));
  };
  const updatePayroll = (id, field, value) => {
    if (field === 'role' && typeof value === 'string') {
      value = value.slice(0, 50);
      if (value.length > 0) {
        value = value.charAt(0).toUpperCase() + value.slice(1);
      }
    }
    if (field === 'rate') {
      if (value !== '' && (Number(value) <= 0 || isNaN(Number(value)) || String(value).trim().startsWith('-'))) {
        triggerSavageRateToast();
        setPayroll(payroll.map(item => item.id === id ? { ...item, rate: '' } : item));
        return;
      }
    }
    if (field === 'quantity') {
      if (value !== '' && (Number(value) <= 0 || isNaN(Number(value)) || String(value).trim().startsWith('-'))) {
        setPayroll(payroll.map(item => item.id === id ? { ...item, quantity: 1 } : item));
        return;
      }
    }
    setPayroll(payroll.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    try {
      const croppedResult = await getCroppedImg(
        upiImageSrc,
        croppedAreaPixels,
        0
      );
      if (croppedResult instanceof Blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setUpiCroppedImage(reader.result);
          setShowCropModal(false);
        };
        reader.onerror = () => {
          // Fallback to object URL if base64 reader fails
          try {
            setUpiCroppedImage(URL.createObjectURL(croppedResult));
          } catch (err) {
            console.error(err);
          }
          setShowCropModal(false);
        };
        reader.readAsDataURL(croppedResult);
      } else if (typeof croppedResult === 'string') {
        setUpiCroppedImage(croppedResult);
        setShowCropModal(false);
      } else {
        setShowCropModal(false);
      }
    } catch (e) {
      console.error('Error cropping image:', e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Error cropping image. Please try again.' }));
    }
  }, [upiImageSrc, croppedAreaPixels]);

  const onFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 1024 * 1024) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: "File size must be under 1MB" }));
        return;
      }
      let imageDataUrl = await readFile(file);
      setUpiImageSrc(imageDataUrl);
      setShowCropModal(true);
      e.target.value = '';
    }
  };

  const readFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.readAsDataURL(file);
    });
  };

  const parseDate = (str) => {
    if (!str) return undefined;
    const [y, m, d] = str.split('-');
    return new Date(y, m - 1, d);
  };

  const handleDateSelect = (field, d) => {
    if (!d) {
      if (field === 'date') setDate('');
      if (field === 'dueDate') setDueDate('');
      return;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const str = `${y}-${m}-${day}`;
    if (field === 'date') setDate(str);
    if (field === 'dueDate') setDueDate(str);
  };

  const formattedDate = date ? format(parseDate(date), 'MMM d, yyyy') : '';
  const formattedDueDate = dueDate ? format(parseDate(dueDate), 'MMM d, yyyy') : '';

  const renderExportPdfLayout = () => {
    const tableItems = isEditor ? items : payroll;

    return (
      <div 
        className="card pdf-export" 
        id="invoice-content" 
        style={{ 
          width: '794px', 
          margin: '0 auto', 
          backgroundColor: '#FFFFFF', 
          border: 'none', 
          boxShadow: 'none',
          padding: 0
        }}
      >
        {/* Page 1 - Fixed A4 Template (794px x 1115px) */}
        <div 
          className="invoice-page-1" 
          style={{ 
            width: '794px', 
            height: '1115px', 
            maxHeight: '1115px', 
            position: 'relative', 
            boxSizing: 'border-box', 
            backgroundColor: '#FFFFFF', 
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            overflow: 'hidden',
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          {/* 1. Header (Fixed: top: 48px, left: 52px, width: 690px, height: 98px) */}
          <div 
            className="pdf-section-header"
            style={{
              position: 'absolute',
              top: '48px',
              left: '52px',
              width: '690px',
              height: '98px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1.5px solid #E5E7EB',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img src={logoImg} alt="Idyll Productions Logo" style={{ width: '150px', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
              <h1 className="title" style={{ fontSize: '2.8rem', fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.1, paddingBottom: '2px' }}>INVOICE</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                <span style={{ fontWeight: '600', color: '#111827', fontSize: '1rem', lineHeight: '1.4', paddingBottom: '2px' }}>#</span>
                <span style={{ fontWeight: '600', color: '#111827', fontSize: '1rem', lineHeight: '1.4', paddingBottom: '2px' }}>{invoiceNo}</span>
              </div>
            </div>
          </div>

          {/* 2. Client Info & Metadata Grid (Fixed: top: 162px, left: 52px, width: 690px, height: 220px) */}
          <div 
            className="pdf-section-client"
            style={{
              position: 'absolute',
              top: '162px',
              left: '52px',
              width: '690px',
              display: 'grid',
              gridTemplateColumns: '340px 310px',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}
          >
            {/* Left Column: Name, Email/Phone, Bill To */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', margin: '0 0 3px 0', display: 'block' }}>NAME</label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827', wordBreak: 'break-word', lineHeight: '1.55', paddingBottom: '4px' }}>
                  {from || '—'}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', margin: '0 0 3px 0', display: 'block' }}>EMAIL / PHONE</label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827', wordBreak: 'break-word', lineHeight: '1.55', paddingBottom: '4px' }}>
                  {contactInfo || '—'}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', margin: '0 0 3px 0', display: 'block' }}>CLIENT NAME (BILL TO)</label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827', wordBreak: 'break-word', lineHeight: '1.55', paddingBottom: '4px' }}>
                  {billTo || '—'}
                </div>
              </div>
            </div>

            {/* Right Column: Date, Payment Type, Due Date, Invoice Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '26px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>DATE</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827', lineHeight: '1.55', paddingBottom: '3px' }}>{formattedDate || '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '26px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>PAYMENT TYPE</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827', lineHeight: '1.55', paddingBottom: '3px' }}>{paymentTerms || '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '26px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>DUE DATE</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827', lineHeight: '1.55', paddingBottom: '3px' }}>{formattedDueDate || '—'}</span>
              </div>
              {isEditor && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '26px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>INVOICE TYPE</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827', lineHeight: '1.55', paddingBottom: '3px' }}>{invoiceType}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Service Table (Fixed: top: 405px, left: 52px, width: 690px) */}
          <div 
            className="pdf-section-table"
            style={{
              position: 'absolute',
              top: '405px',
              left: '52px',
              width: '690px',
              boxSizing: 'border-box'
            }}
          >
            {/* Header Bar - Exactly centered vertically & horizontally */}
            <div 
              style={{
                height: '42px',
                backgroundColor: '#111827',
                borderRadius: '6px',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ width: '52%', paddingLeft: '1.25rem', paddingRight: '0.5rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', height: '100%', boxSizing: 'border-box' }}>
                {isEditor ? 'Item Description' : 'Service Name'}
              </div>
              <div style={{ width: '15%', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', boxSizing: 'border-box' }}>
                Quantity
              </div>
              <div style={{ width: '16%', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', boxSizing: 'border-box' }}>
                Rate
              </div>
              <div style={{ width: '17%', paddingRight: '1.25rem', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', boxSizing: 'border-box' }}>
                Amount
              </div>
            </div>

            {/* Data Rows - Fixed row heights with ample line height and padding to prevent descender cutoff */}
            <div style={{ width: '100%' }}>
              {tableItems.map((item) => {
                const name = isEditor ? item.description : item.role;
                const qty = item.quantity || 1;
                const rate = item.rate === 0 ? '' : item.rate;
                const amt = (Number(item.quantity) || 1) * (Number(item.rate) || 0);

                return (
                  <div 
                    key={item.id}
                    style={{
                      minHeight: '52px',
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: '1px solid #E5E7EB',
                      boxSizing: 'border-box',
                      fontSize: '0.925rem',
                      paddingTop: '8px',
                      paddingBottom: '8px'
                    }}
                  >
                    <div style={{ width: '52%', paddingLeft: '1.25rem', paddingRight: '0.5rem', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827', boxSizing: 'border-box', lineHeight: '1.6', paddingBottom: '4px' }}>
                      <span style={{ display: 'inline-block', lineHeight: 1.6, verticalAlign: 'middle', paddingBottom: '3px' }}>
                        {name || '—'}
                      </span>
                    </div>
                    <div style={{ width: '15%', textAlign: 'center', color: '#111827', boxSizing: 'border-box', lineHeight: '1.6', paddingBottom: '4px' }}>
                      <span style={{ display: 'inline-block', lineHeight: 1.6, verticalAlign: 'middle', paddingBottom: '3px' }}>
                        {qty}
                      </span>
                    </div>
                    <div style={{ width: '16%', textAlign: 'center', color: '#111827', boxSizing: 'border-box', lineHeight: '1.6', paddingBottom: '4px' }}>
                      <span style={{ display: 'inline-block', lineHeight: 1.6, verticalAlign: 'middle', paddingBottom: '3px' }}>
                        {rate}
                      </span>
                    </div>
                    <div style={{ width: '17%', paddingRight: '1.25rem', textAlign: 'center', fontWeight: 500, color: '#111827', boxSizing: 'border-box', lineHeight: '1.6', paddingBottom: '4px' }}>
                      <span style={{ display: 'inline-block', lineHeight: 1.6, verticalAlign: 'middle', paddingBottom: '3px' }}>
                        {currency}{formatAmount(amt, currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Notes and Total (Fixed: top: 715px, left: 52px, width: 690px) */}
          <div 
            className="pdf-section-notes-total"
            style={{
              position: 'absolute',
              top: '715px',
              left: '52px',
              width: '690px',
              display: 'grid',
              gridTemplateColumns: '340px 310px',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}
          >
            {/* Left Column: Notes */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', margin: '0 0 6px 0', display: 'block' }}>NOTES</label>
              <div 
                style={{ 
                  maxHeight: '160px', 
                  overflow: 'hidden', 
                  fontSize: '0.875rem', 
                  lineHeight: '1.6', 
                  color: '#374151', 
                  wordBreak: 'break-word',
                  paddingBottom: '6px' 
                }}
              >
                {notes || ''}
              </div>
            </div>

            {/* Right Column: Total & Words */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  borderBottom: '1.5px solid #E5E7EB', 
                  paddingBottom: '0.5rem' 
                }}
              >
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', lineHeight: '1.3', paddingBottom: '2px' }}>Total</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', lineHeight: '1.3', paddingBottom: '2px' }}>
                  {currency}{formatAmount(subtotal, currency)}
                </span>
              </div>
              <div 
                style={{ 
                  textAlign: 'right', 
                  fontSize: '0.85rem', 
                  color: '#4B5563', 
                  fontStyle: 'italic', 
                  marginTop: '0.45rem', 
                  lineHeight: '1.45',
                  paddingBottom: '4px' 
                }}
              >
                <span style={{ fontWeight: 600, fontStyle: 'normal' }}>In words: </span>
                {numberToWords(subtotal, currency)}
              </div>
            </div>
          </div>

          {/* 5. Footer (Fixed: top: 980px, left: 52px, width: 690px, height: 90px) */}
          <div 
            className="pdf-section-footer"
            style={{
              position: 'absolute',
              top: '980px',
              left: '52px',
              width: '690px',
              height: '90px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ color: '#9CA3AF', fontSize: '0.75rem', letterSpacing: '0.05em', marginBottom: '0.4rem', textAlign: 'center', lineHeight: '1.4', paddingBottom: '2px' }}>
              ID: {idyllTracksId}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4B5563', fontSize: '0.875rem', lineHeight: '1.4', paddingBottom: '2px' }}>
              <span>Powered by <strong>Idyll Tracks Payments</strong></span>
              <svg viewBox="0 0 502.23 469.39" style={{ height: '22px', transform: 'translateY(1px)' }}>
                <path fill="#111827" d="M7.76,185.46l56.74-57.28,35.33,35.58c9.99,10.06,23.14,14.81,37.6,11.76,20.63-4.35,34.18-25.32,30.11-45.87-2.11-10.6-7.71-18.11-15.08-25.43l-31.95-31.74,56.3-56.56c9.48-9.52,23.58-10.45,33.17-.88l19.05,19.01,21.41-21.05c7.65-7.52,17.79-11.82,28.3-12.77,16.03-1.45,29.89,3.9,41.01,15.06l100.65,101.03,68.45,69.15c16.83,17.01,18.35,48.87,1.39,66.23l-73.98,75.7-136.52,136.93c-7.95,7.98-21.88,5.77-29.06-1.43L8.95,220.53c-4.16-4.18-7.09-7.53-8.47-13.58-1.72-7.5,1.27-15.43,7.28-21.5ZM476.49,234.75c7.3-12.34,5.51-26.13-4.01-35.68l-75.07-75.32-95.46-95.84c-10.03-10.07-27.09-8.84-37.02.14-7.46,6.74-13.4,13.29-20.59,20.54,2.41,3.85,5.11,6.42,8.42,9.73l183.26,183.03c11.72,11.7,32.69,6.55,40.47-6.6Z"/>
                <circle fill="#111827" cx="125.53" cy="133.41" r="24.09"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Page 2 - UPI QR Code (if attached) */}
        {paymentTerms?.trim()?.toUpperCase() === 'UPI' && qrDisplaySrc && (
          <div 
            className="invoice-qr-page"
            style={{ 
              pageBreakBefore: 'always',
              breakBefore: 'page',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
              width: '794px',
              height: '1115px', 
              maxHeight: '1115px',
              position: 'relative',
              boxSizing: 'border-box',
              padding: '60px 52px 40px 52px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              fontFamily: 'Inter, system-ui, sans-serif',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF'
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ 
                fontSize: '1.15rem', 
                fontWeight: '600', 
                letterSpacing: '0.12em', 
                textTransform: 'uppercase', 
                marginBottom: '1.5rem', 
                color: 'var(--gray-600)',
                fontFamily: 'sans-serif'
              }}>
                Scan to Pay
              </h2>
              <img 
                src={qrDisplaySrc} 
                alt="UPI QR Code" 
                style={{ 
                  width: '330px', 
                  height: '330px', 
                  borderRadius: '0', 
                  border: 'none', 
                  boxShadow: 'none',
                  objectFit: 'contain'
                }} 
              />
            </div>
            
            <div style={{ marginTop: 'auto', marginBottom: '10px', opacity: 0.9 }}>
              <img src={upiFooterImg} alt="Idyll x UPI" style={{ height: '48px', objectFit: 'contain' }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFormLayout = () => (
    <div className="invoice-form-layout">
      {/* Top Banner / Card */}
      <div className="invoice-form-header-card">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Idyll Productions Logo" style={{ height: '48px', objectFit: 'contain' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--black, #222222)', letterSpacing: '-0.02em' }}>
            Create Invoice
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.5rem 0.9rem',
            backgroundColor: 'var(--bg-light, #F3F4F6)',
            borderRadius: '6px',
            border: '1px solid var(--gray-200, #E5E7EB)',
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'var(--black, #222222)'
          }}>
            <span style={{ color: 'var(--gray-500, #6B7280)' }}>Invoice #:</span>
            <span>{invoiceNo}</span>
          </div>
        </div>
      </div>

      {/* Top 2 Columns Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column: From & Dates */}
        <div className="flex flex-col gap-6">
          {/* From Fields */}
          <div>
            <div className="invoice-form-field">
              <label>Your Full Name *</label>
              <RenderField 
                maxLength={50} 
                value={from} 
                className={invalidFields['from'] ? 'input-error' : ''}
                onChange={e => { 
                  const val = e.target.value;
                  const formatted = val ? val.charAt(0).toUpperCase() + val.slice(1) : '';
                  setFrom(formatted); 
                  clearFieldError('from'); 
                }} 
                placeholder="Enter your full name or legal business name..." 
              />
            </div>

            <div className="invoice-form-field">
              <label>Email & Phone Number *</label>
              <RenderField 
                maxLength={60} 
                value={contactInfo} 
                className={invalidFields['contactInfo'] ? 'input-error' : ''}
                onChange={e => { setContactInfo(e.target.value); clearFieldError('contactInfo'); }} 
                placeholder="name@email.com | +91 98765 43210" 
              />
              <p style={{ fontSize: '0.875rem', color: 'var(--gray-600, #4B5563)', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Format: your email followed by your phone number separated by a vertical bar (|).
              </p>
            </div>
          </div>

          {/* Dates & Terms */}
          <div>
            {isEditor && (
              <div className="invoice-form-field">
                <label>Invoice Type</label>
                <CustomDropdown
                  options={invoiceTypeOptions}
                  value={invoiceType}
                  onChange={setInvoiceType}
                  className="text-sm bg-white"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="invoice-form-field">
                <label>Date Issued *</label>
                <div className={`invoice-date-picker ${invalidFields['date'] ? 'date-error' : ''}`}>
                  <DatePicker 
                    date={parseDate(date)} 
                    onSelect={(d) => {
                      handleDateSelect('date', d);
                      clearFieldError('date');
                    }} 
                  />
                </div>
              </div>

              <div className="invoice-form-field">
                <label>Due Date *</label>
                <div className={`invoice-date-picker ${invalidFields['dueDate'] ? 'date-error' : ''}`}>
                  <DatePicker 
                    date={parseDate(dueDate)} 
                    onSelect={(d) => {
                      handleDateSelect('dueDate', d);
                      clearFieldError('dueDate');
                    }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Bill To & Payment Method */}
        <div className="flex flex-col gap-6">
          {/* Bill To - LOCKED */}
          <div>
            <div className="invoice-form-field">
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Client Name / Organization *</label>
              <RenderField 
                type="text"
                value={billTo} 
                readOnly={true}
                hideCounter={true}
                placeholder="Idyll Productions Pvt. Ltd." 
                style={{ 
                  backgroundColor: 'var(--bg-light, #F9FAFB)', 
                  cursor: 'not-allowed', 
                  color: 'var(--primary, #111827)',
                  fontWeight: 500,
                  borderRadius: '6px',
                  userSelect: 'none',
                  opacity: 0.95
                }} 
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <div className="invoice-form-field">
              <label>Payment Method *</label>
              <PaymentDropdown 
                value={paymentTerms} 
                onChange={(val) => {
                  setPaymentTerms(val);
                  clearFieldError('paymentTerms');
                }} 
                isExporting={false} 
                hasError={!!invalidFields['paymentTerms']}
              />
            </div>

            {paymentTerms === 'UPI' && (
              <div style={{ 
                marginTop: '0.75rem', 
                padding: '0.85rem 1rem', 
                background: 'var(--bg-light, #F9FAFB)', 
                borderRadius: '8px', 
                border: '1px solid var(--gray-200, #E5E7EB)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500, #6B7280)', margin: 0 }}>
                    UPI QR Code (Optional)
                  </label>
                  {qrDisplaySrc && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={13} strokeWidth={2.5} /> Attached
                    </span>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                />

                {qrDisplaySrc ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
                      <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '8px',
                        border: '1px solid var(--gray-200, #E5E7EB)',
                        overflow: 'hidden',
                        backgroundColor: '#FFFFFF',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img 
                          src={qrDisplaySrc} 
                          alt="UPI QR Code Preview" 
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        />
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--gray-600, #4B5563)', margin: 0, lineHeight: 1.4 }}>
                        A second <strong style={{ color: 'var(--gray-800, #1F2937)' }}>"Scan to Pay"</strong> page will be automatically attached to your invoice PDF.
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button 
                        type="button"
                        className="btn btn-outline flex items-center justify-center gap-1.5" 
                        onClick={() => fileInputRef.current?.click()}
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '6px', fontWeight: '600' }}
                      >
                        <QrCode size={15} />
                        Change Image
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setUpiCroppedImage(null);
                          setUpiImageSrc(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.4rem 0.75rem',
                          fontSize: '0.8rem',
                          borderRadius: '6px',
                          background: 'transparent',
                          color: '#DC2626',
                          border: '1px solid #FCA5A5',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = '#FEE2E2';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500, #6B7280)', margin: 0 }}>
                      Add a QR code to attach a dedicated "Scan to Pay" page to the invoice.
                    </p>
                    <button 
                      type="button"
                      className="btn btn-outline flex items-center justify-center gap-1.5" 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '0.45rem 1rem', fontSize: '0.825rem', borderRadius: '6px', fontWeight: '600' }}
                    >
                      <QrCode size={15} />
                      Upload QR Image
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Services / Line Items (Full Width) */}
      <div>
        {isEditor ? (
          <>
            <div className="invoice-form-table-container" style={{ overflowX: 'auto', padding: '3px', margin: '-3px 0' }}>
              <table className="invoice-form-table">
                <thead>
                  <tr>
                    <th style={{ width: '48%', textAlign: 'left' }}>Item Description *</th>
                    <th style={{ width: '13%', textAlign: 'center' }}>Qty *</th>
                    <th style={{ width: '17%', textAlign: 'center' }}>Rate (₹) *</th>
                    <th style={{ width: '16%', textAlign: 'center' }}>Amount</th>
                    <th style={{ width: '6%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'left' }}>
                        <RenderField 
                          maxLength={100} 
                          hideCounter={true} 
                          className={invalidFields[`item_desc_${item.id}`] ? 'input-error' : ''} 
                          value={item.description} 
                          onChange={e => { updateItem(item.id, 'description', e.target.value); clearFieldError(`item_desc_${item.id}`); }} 
                          placeholder="Description of item or service..." 
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <RenderField 
                          type="number" 
                          min="1" 
                          className={invalidFields[`item_qty_${item.id}`] ? 'input-error' : ''} 
                          value={item.quantity} 
                          onChange={e => { updateItem(item.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value)); clearFieldError(`item_qty_${item.id}`); }} 
                          style={{ textAlign: 'center' }} 
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <RenderField 
                          type="number" 
                          min="1" 
                          step="any"
                          placeholder="Rate"
                          className={invalidFields[`item_rate_${item.id}`] ? 'input-error' : ''} 
                          value={item.rate === 0 ? '' : item.rate} 
                          onKeyDown={e => {
                            if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                              e.preventDefault();
                              if (e.key === '-') triggerSavageRateToast();
                            }
                          }}
                          onChange={e => { 
                            updateItem(item.id, 'rate', e.target.value === '' ? '' : Number(e.target.value)); 
                            clearFieldError(`item_rate_${item.id}`); 
                          }} 
                          style={{ textAlign: 'center' }} 
                        />
                      </td>
                      <td>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          backgroundColor: 'var(--bg-light, #F9FAFB)',
                          border: '1px solid var(--gray-200, #E5E7EB)',
                          borderRadius: '6px',
                          padding: '0.75rem 1rem',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          color: 'var(--black, #222222)',
                          boxSizing: 'border-box',
                          width: '100%',
                          minHeight: '46px'
                        }}>
                          <span key={currency} className="currency-anim">
                            {currency}{formatAmount((Number(item.quantity) || 1) * (Number(item.rate) || 0), currency)}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => removeItem(item.id)} 
                          title="Delete item"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '46px',
                            height: '46px',
                            backgroundColor: 'var(--bg-light, #F9FAFB)',
                            border: '1px solid var(--gray-200, #E5E7EB)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: 'var(--gray-500, #6B7280)',
                            transition: 'all 0.2s ease',
                            padding: 0
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#FEE2E2';
                            e.currentTarget.style.borderColor = '#FCA5A5';
                            e.currentTarget.style.color = '#DC2626';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-light, #F9FAFB)';
                            e.currentTarget.style.borderColor = 'var(--gray-200, #E5E7EB)';
                            e.currentTarget.style.color = 'var(--gray-500, #6B7280)';
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <button type="button" className="btn btn-outline" onClick={addItem} style={{ borderRadius: '6px' }}>+ Add Item</button>
            </div>
          </>
        ) : (
          <>
            <div className="invoice-form-table-container" style={{ overflowX: 'auto', padding: '3px', margin: '-3px 0' }}>
              <table className="invoice-form-table">
                <thead>
                  <tr>
                    <th style={{ width: '48%', textAlign: 'left' }}>Service Name *</th>
                    <th style={{ width: '13%', textAlign: 'center' }}>Qty *</th>
                    <th style={{ width: '17%', textAlign: 'center' }}>Rate (₹) *</th>
                    <th style={{ width: '16%', textAlign: 'center' }}>Amount</th>
                    <th style={{ width: '6%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map(item => (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'left' }}>
                        <RenderField 
                          maxLength={50} 
                          hideCounter={true} 
                          className={invalidFields[`payroll_role_${item.id}`] ? 'input-error' : ''} 
                          value={item.role} 
                          onChange={e => { 
                            const val = e.target.value.slice(0, 50);
                            const formatted = val ? val.charAt(0).toUpperCase() + val.slice(1) : '';
                            updatePayroll(item.id, 'role', formatted); 
                            clearFieldError(`payroll_role_${item.id}`); 
                          }} 
                          placeholder="Enter service name or role..." 
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <RenderField 
                          type="number" 
                          min="1" 
                          className={invalidFields[`payroll_qty_${item.id}`] ? 'input-error' : ''} 
                          value={item.quantity} 
                          onChange={e => { updatePayroll(item.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value)); clearFieldError(`payroll_qty_${item.id}`); }} 
                          placeholder="Qty" 
                          style={{ textAlign: 'center' }} 
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <RenderField 
                          type="number" 
                          min="1" 
                          step="any"
                          placeholder="Rate" 
                          className={invalidFields[`payroll_rate_${item.id}`] ? 'input-error' : ''} 
                          value={item.rate === 0 ? '' : item.rate} 
                          onKeyDown={e => {
                            if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                              e.preventDefault();
                              if (e.key === '-') triggerSavageRateToast();
                            }
                          }}
                          onChange={e => { 
                            updatePayroll(item.id, 'rate', e.target.value === '' ? '' : Number(e.target.value)); 
                            clearFieldError(`payroll_rate_${item.id}`); 
                          }} 
                          style={{ textAlign: 'center' }} 
                        />
                      </td>
                      <td>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          backgroundColor: 'var(--bg-light, #F9FAFB)',
                          border: '1px solid var(--gray-200, #E5E7EB)',
                          borderRadius: '6px',
                          padding: '0.75rem 1rem',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          color: 'var(--black, #222222)',
                          boxSizing: 'border-box',
                          width: '100%',
                          minHeight: '46px'
                        }}>
                          <span key={currency} className="currency-anim">
                            {currency}{formatAmount((Number(item.quantity) || 1) * (Number(item.rate) || 0), currency)}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => removePayroll(item.id)} 
                          title="Delete service"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '46px',
                            height: '46px',
                            backgroundColor: 'var(--bg-light, #F9FAFB)',
                            border: '1px solid var(--gray-200, #E5E7EB)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: 'var(--gray-500, #6B7280)',
                            transition: 'all 0.2s ease',
                            padding: 0
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#FEE2E2';
                            e.currentTarget.style.borderColor = '#FCA5A5';
                            e.currentTarget.style.color = '#DC2626';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-light, #F9FAFB)';
                            e.currentTarget.style.borderColor = 'var(--gray-200, #E5E7EB)';
                            e.currentTarget.style.color = 'var(--gray-500, #6B7280)';
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              {payroll.length < 3 ? (
                <button type="button" className="btn btn-outline" onClick={addPayroll} style={{ borderRadius: '6px' }}>+ Add Service</button>
              ) : (
                <div style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: '500', padding: '0.5rem 0' }}>
                  Maximum 3 services allowed per invoice.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Row 4: Notes & Total (2 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Notes & Instructions */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', height: '32px' }}>
            <label style={{ margin: 0 }}>
              Payment Details & Notes *
            </label>
            <button 
              type="button"
              className="btn btn-outline flex items-center gap-2" 
              onClick={handleUseSavedPaymentDetails}
              style={{ 
                padding: '0.35rem 0.75rem', 
                fontSize: '0.8rem', 
                borderRadius: '6px',
                height: '32px',
                minHeight: '32px'
              }}
            >
              <Wallet size={14} />
              Use Saved Payment Details
            </button>
          </div>

          <RenderField 
            isTextarea 
            maxLength={200} 
            value={notes} 
            className={invalidFields['notes'] ? 'input-error' : ''}
            onChange={e => {
              setNotes(e.target.value);
              clearFieldError('notes');
            }} 
            placeholder="Provide your payment information here (e.g. Account Number, IFSC, UPI ID, or special instructions)..." 
            style={{ height: '105px', minHeight: '105px', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        {/* Total Summary Card - Matching Alignment & Size */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', height: '32px' }}>
            <label style={{ margin: 0 }}>
              Total Amount
            </label>
          </div>

          <div style={{ 
            backgroundColor: '#FFFFFF',
            borderRadius: '6px',
            border: '1px solid var(--gray-200, #E5E7EB)',
            padding: '0.75rem 1rem',
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '105px',
            minHeight: '105px',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: 700, 
              color: 'var(--theme-text, #111827)', 
              letterSpacing: '-0.02em', 
              lineHeight: 1.2,
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontVariantNumeric: 'tabular-nums'
            }}>
              <span key={currency} className="currency-anim">{currency}{formatAmount(subtotal, currency)}</span>
            </div>

            {/* In Words Container */}
            <div style={{ 
              fontSize: '0.8rem', 
              backgroundColor: 'var(--bg-light, #F9FAFB)',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid var(--gray-200, #E5E7EB)',
              lineHeight: 1.35,
              wordBreak: 'break-word',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
            }}>
              <span style={{ fontWeight: 500, color: 'var(--gray-500, #6B7280)', marginRight: '4px' }}>In words:</span>
              <span style={{ fontWeight: 600, color: 'var(--black, #111827)' }}>{numberToWords(subtotal, currency)}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    );

  return (
    <>
      {renderFormLayout()}
      <div 
        className="invoice-export-hidden" 
        style={{ 
          position: 'fixed', 
          left: '-9999px', 
          top: '-9999px', 
          width: '794px', 
          pointerEvents: 'none', 
          zIndex: -100 
        }}
      >
        {renderExportPdfLayout()}
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <div 
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#0A0A0A',
            display: 'flex',
            flexDirection: 'column',
            width: '100vw',
            height: '100vh'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.2rem 2rem',
            backgroundColor: '#141414',
            borderBottom: '1px solid #262626',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#222222',
                border: '1px solid #333333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                flexShrink: 0
              }}>
                <QrCode size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F5F5F5', margin: 0, letterSpacing: '-0.01em' }}>
                  Adjust QR Code
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#888888', margin: '3px 0 0 0' }}>
                  Please crop your picture properly so only the QR code is visible within the square.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCropModal(false);
                if (!upiCroppedImage) setUpiImageSrc(null);
              }}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                border: '1px solid #333333',
                backgroundColor: 'transparent',
                color: '#A3A3A3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#222222';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#A3A3A3';
              }}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Canvas Area */}
          <div style={{ position: 'relative', flex: 1, width: '100%', minHeight: 0, backgroundColor: '#000000' }}>
            <Cropper
              image={upiImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              style={{
                containerStyle: { background: 'transparent' },
                cropAreaStyle: { 
                  border: '2px solid #FFFFFF',
                  borderRadius: '12px',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.85)'
                }
              }}
            />
          </div>

          {/* Footer Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem',
            padding: '1.15rem 2rem',
            backgroundColor: '#141414',
            borderTop: '1px solid #262626',
            zIndex: 10
          }}>
            {/* Zoom Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px' }}>
              <button 
                type="button"
                onClick={() => setZoom(prev => Math.max(1, +(prev - 0.1).toFixed(1)))}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #333333',
                  backgroundColor: '#222222',
                  color: '#D4D4D4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#333333';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#222222';
                  e.currentTarget.style.color = '#D4D4D4';
                }}
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.05}
                  aria-labelledby="Zoom"
                  onChange={e => setZoom(Number(e.target.value))}
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    accentColor: '#FFFFFF',
                    height: '6px'
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: '#A3A3A3', minWidth: '40px', fontWeight: 600 }}>
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <button 
                type="button"
                onClick={() => setZoom(prev => Math.max(1, +(prev + 0.1).toFixed(1)))}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #333333',
                  backgroundColor: '#222222',
                  color: '#D4D4D4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#333333';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#222222';
                  e.currentTarget.style.color = '#D4D4D4';
                }}
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
            </div>

            {/* Actions: Cancel & Crop & Save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  if (!upiCroppedImage) setUpiImageSrc(null);
                }}
                style={{
                  padding: '0.65rem 1.4rem',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: '#E5E5E5',
                  border: '1px solid #404040',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#222222';
                  e.currentTarget.style.borderColor = '#525252';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#404040';
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={showCroppedImage}
                style={{
                  padding: '0.65rem 1.6rem',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 10px rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#E5E5E5';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Crop size={16} strokeWidth={2.5} />
                <span>Crop & Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Payments Modal */}
      {showSavedPaymentsModal && (
        <div 
          className="saved-payment-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSavedPaymentsModal(false);
          }}
        >
          <div className="saved-payment-modal-container">
            {/* Header */}
            <div className="saved-payment-modal-header">
              <div className="saved-payment-header-left">
                <div className="saved-payment-header-icon">
                  <Wallet size={20} />
                </div>
                <h3 className="saved-payment-modal-title">Saved Payment Details</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowSavedPaymentsModal(false)}
                className="saved-payment-close-btn"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>            {/* Content Body */}
            {(() => {
              const MODAL_TABS = [
                { id: 'wire', label: 'Bank Transfer', logo: wireTransferLogo },
                { id: 'upi', label: 'UPI', logo: upiLogo },
                { id: 'paypal', label: 'PayPal', logo: paypalLogo },
                { id: 'wise', label: 'Wise', logo: wiseLogo }
              ];
              
              const currentMethods = savedMethods.filter(m => m.type === activeModalTab);
              const currentTabInfo = MODAL_TABS.find(p => p.id === activeModalTab);
              
              return (
                <>
                  <div className="saved-payment-modal-body">
                    {currentMethods.length === 0 ? (
                      <div className="saved-payment-empty-state">
                        <div className="saved-payment-empty-icon">
                          <AlertCircle size={24} />
                        </div>
                        <h5 className="saved-payment-empty-title">No saved details for {currentTabInfo?.label}</h5>
                        <p className="saved-payment-empty-desc">
                          You don't have any saved information for {currentTabInfo?.label}. If you want to use this payment method, please go to Payment Details in the sidebar and save your information first.
                        </p>
                      </div>
                    ) : (
                      <div className="saved-payment-cards-list">
                        {currentMethods.map((method) => {
                          const paymentInfo = PAYMENT_METHODS.find(p => p.value.toLowerCase() === method.type || p.label.toLowerCase() === method.type || (method.type === 'wire' && p.value === 'Bank Transfer'));
                          const cardLogo = paymentInfo?.logo || currentTabInfo?.logo;
                          const secondaryInfo = renderModalSecondaryDetail(method);

                          return (
                            <div 
                              key={method.id} 
                              className={`saved-payment-card ${method.isDefault ? 'saved-payment-card-default' : ''}`}
                            >
                              <div className="saved-payment-card-left">
                                <div className="saved-payment-card-icon-wrap">
                                  {method.type === 'paypal' ? (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.47A.641.641 0 0 1 5.577 1.9h7.19c3.558 0 6.046 1.745 5.518 5.28-.466 3.12-2.61 5.093-5.836 5.093H9.27L8.03 20.89a.642.642 0 0 1-.633.447h-.32z" fill="#003087"/>
                                      <path d="M9.27 12.273h3.179c3.226 0 5.37-1.973 5.836-5.093.528-3.535-1.96-5.28-5.518-5.28H5.577a.641.641 0 0 0-.633.57L2.99 15.11a.641.641 0 0 0 .633.74h3.336l.96-6.077.02-.12a.641.641 0 0 1 .633-.57h.698z" fill="#0079C1"/>
                                    </svg>
                                  ) : cardLogo ? (
                                    <img 
                                      src={cardLogo} 
                                      alt={method.type} 
                                      className="saved-payment-card-icon" 
                                      style={{
                                        height: method.type === 'wire' ? '24px' : undefined,
                                        width: method.type === 'wire' ? '24px' : undefined,
                                        objectFit: 'contain'
                                      }}
                                    />
                                  ) : null}
                                </div>
                                <div className="saved-payment-card-info">
                                  <div className="saved-payment-card-top-row">
                                    <span className="saved-payment-card-primary">
                                      {renderModalPrimaryDetail(method)}
                                    </span>
                                    {method.isDefault && (
                                      <span className="saved-payment-default-badge">
                                        <Check size={11} strokeWidth={3} /> Default
                                      </span>
                                    )}
                                  </div>
                                  {secondaryInfo && (
                                    <div className="saved-payment-card-subtext">
                                      {secondaryInfo}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <button 
                                type="button" 
                                className="saved-payment-use-btn"
                                onClick={() => handleSelectSavedMethod(method)}
                              >
                                Select & Use
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bottom Navigation Tabs */}
                  <div className="saved-payment-modal-footer">
                    <div className="saved-payment-tabs-bar">
                      {MODAL_TABS.map(tab => {
                        const isActive = activeModalTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveModalTab(tab.id)}
                            className={`saved-payment-tab-btn ${isActive ? 'saved-payment-tab-btn-active' : ''}`}
                          >
                            <div className="saved-payment-tab-logo-box">
                              {tab.id === 'paypal' ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.47A.641.641 0 0 1 5.577 1.9h7.19c3.558 0 6.046 1.745 5.518 5.28-.466 3.12-2.61 5.093-5.836 5.093H9.27L8.03 20.89a.642.642 0 0 1-.633.447h-.32z" fill="#003087"/>
                                  <path d="M9.27 12.273h3.179c3.226 0 5.37-1.973 5.836-5.093.528-3.535-1.96-5.28-5.518-5.28H5.577a.641.641 0 0 0-.633.57L2.99 15.11a.641.641 0 0 0 .633.74h3.336l.96-6.077.02-.12a.641.641 0 0 1 .633-.57h.698z" fill="#0079C1"/>
                                </svg>
                              ) : (
                                <img 
                                  src={tab.logo} 
                                  alt={tab.label} 
                                  className="saved-payment-tab-logo-img"
                                  style={{
                                    height: tab.id === 'wire' ? '20px' : '16px',
                                    width: tab.id === 'wire' ? '20px' : 'auto',
                                    objectFit: 'contain'
                                  }}
                                />
                              )}
                            </div>
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
};

export default Invoice;
