import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CreditCard, Trash2, Plus, Check, Lock, Upload, Crop, Image as ImageIcon, X, Edit2, QrCode, ZoomIn, ZoomOut } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropImage';
import styles from './PaymentDetails.module.css';
import { logAction } from '../../utils/auditLogger';

type PaymentType = 'wire' | 'upi' | 'paypal' | 'wise';

interface PaymentMethod {
  id: string;
  type: PaymentType;
  isDefault: boolean;
  details: any;
}

const PAYMENT_TYPES: { id: PaymentType; label: string; logo: string }[] = [
  { id: 'wire', label: 'Bank Transfer', logo: '/payment-logos/Wire Transfer Logo.png' },
  { id: 'upi', label: 'UPI', logo: '/payment-logos/Upi Logo.png' },
  { id: 'paypal', label: 'PayPal', logo: '/payment-logos/Paypal Logo.png' },
  { id: 'wise', label: 'Wise', logo: '/payment-logos/Wise Logo.png' }
];

const COMMON_COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia', 
  'Germany', 'United Arab Emirates', 'Singapore', 'Other'
];

const COMMON_CURRENCIES = [
  'INR (₹)', 'USD ($)', 'EUR (€)', 'GBP (£)', 'CAD ($)', 
  'AUD ($)', 'AED (د.إ)', 'SGD ($)'
];

const PaymentDetailsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PaymentType>('wire');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);

  // QR Crop & Upload State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let foundMethods: any[] = [];
      if (user.user_metadata?.payment_methods && Array.isArray(user.user_metadata.payment_methods)) {
        foundMethods = user.user_metadata.payment_methods;
      }

      // Check user_roles overrides as primary database persistence
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('overrides')
        .eq('id', user.id)
        .maybeSingle();

      if (roleRow?.overrides?.payment_methods && Array.isArray(roleRow.overrides.payment_methods)) {
        foundMethods = roleRow.overrides.payment_methods;
      }

      // Filter out legacy card types like mastercard or visa
      const validMethods = foundMethods.filter((m: any) => 
        ['wire', 'upi', 'paypal', 'wise'].includes(m.type)
      );

      setMethods(validMethods);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMethodsToDB = async (updatedMethods: PaymentMethod[]) => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Update Auth metadata
      await supabase.auth.updateUser({
        data: { payment_methods: updatedMethods }
      });

      // 2. Persist in user_roles table overrides so all views & admin user-picker can query it
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('overrides')
        .eq('id', user.id)
        .maybeSingle();

      const existingOverrides = roleRow?.overrides || {};
      await supabase.from('user_roles').update({
        overrides: {
          ...existingOverrides,
          payment_methods: updatedMethods
        }
      }).eq('id', user.id);

      setMethods(updatedMethods);

      // Broadcast update event so Invoice and other views re-fetch immediately
      window.dispatchEvent(new CustomEvent('payment-methods-updated', {
        detail: { userId: user.id, methods: updatedMethods }
      }));

      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Payment details saved successfully' }));
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Failed to save payment details: ' + error.message }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelForm = () => {
    const originalMethod = editingMethodId ? methods.find(m => m.id === editingMethodId) : null;
    const originalQrUrl = originalMethod?.details?.qrImage || null;
    
    if (qrPreviewUrl && qrPreviewUrl !== originalQrUrl) {
      const urlParts = qrPreviewUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      supabase.storage.from('payment_qrcodes').remove([fileName]).catch(e => console.error(e));
    }

    setShowAddForm(false);
    setEditingMethodId(null);
    setFormData({});
    setQrPreviewUrl(null);
    setImageSrc(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let updatedMethods;
    let oldImageToDelete: string | null = null;
    
    if (editingMethodId) {
      updatedMethods = methods.map(m => {
        if (m.id === editingMethodId) {
          if (m.details.qrImage && m.details.qrImage !== qrPreviewUrl) {
            oldImageToDelete = m.details.qrImage;
          }
          return { ...m, details: { ...formData, qrImage: qrPreviewUrl } };
        }
        return m;
      });
      await logAction('Payment Updated', `Updated payment details for ${activeTab}`);
    } else {
      const newMethod: PaymentMethod = {
        id: Date.now().toString(),
        type: activeTab,
        isDefault: methods.filter(m => m.type === activeTab).length === 0,
        details: { ...formData, qrImage: qrPreviewUrl }
      };
      updatedMethods = [...methods, newMethod];
      await logAction('Payment Added', `Added new payment details for ${activeTab}`);
    }
    
    await saveMethodsToDB(updatedMethods);
    
    if (typeof oldImageToDelete === 'string') {
      const urlParts = (oldImageToDelete as string).split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      await supabase.storage.from('payment_qrcodes').remove([fileName]).catch(e => console.error(e));
    }

    setShowAddForm(false);
    setFormData({});
    setQrPreviewUrl(null);
    setImageSrc(null);
    setEditingMethodId(null);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: "Only JPG format is allowed. Please select a JPG image." }));
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || null);
        setShowCropModal(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropAndUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsUploading(true);
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedFile) throw new Error("Failed to crop image");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const fileExt = 'jpg';
      const fileName = `${user.id}-qr-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      let fileToUpload: any = croppedFile;
      if (typeof croppedFile === 'string') {
        const res = await fetch(croppedFile);
        fileToUpload = await res.blob();
      }

      const { error: uploadError } = await supabase.storage
        .from('payment_qrcodes')
        .upload(filePath, fileToUpload, { 
          upsert: true,
          contentType: 'image/jpeg' 
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment_qrcodes')
        .getPublicUrl(filePath);

      setQrPreviewUrl(`${publicUrl}?t=${Date.now()}`);
      await logAction('QR Upload', `Uploaded QR code for payment method`);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'QR code successfully uploaded' }));
    } catch (error: any) {
      console.error("Error uploading QR code:", error);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Failed to upload QR code: ${error.message || JSON.stringify(error)}` }));
    } finally {
      setIsUploading(false);
      setShowCropModal(false);
    }
  };

  const handleSetDefault = async (id: string, type: PaymentType) => {
    const updatedMethods = methods.map(m => {
      if (m.type !== type) return m;
      return { ...m, isDefault: m.id === id };
    });
    await saveMethodsToDB(updatedMethods);
  };

  const confirmDelete = async () => {
    if (!methodToDelete) return;
    const id = methodToDelete;
    
    const methodObj = methods.find(m => m.id === id);
    if (methodObj?.details?.qrImage) {
      const urlParts = methodObj.details.qrImage.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      await supabase.storage.from('payment_qrcodes').remove([fileName]).catch(e => console.error(e));
    }
    
    let updatedMethods = methods.filter(m => m.id !== id);
    
    // If we deleted the default, make another one default if it exists
    if (methodObj?.isDefault) {
      const remainingOfSameType = updatedMethods.filter(m => m.type === methodObj.type);
      if (remainingOfSameType.length > 0) {
        remainingOfSameType[0].isDefault = true;
      }
    }
    
    await saveMethodsToDB(updatedMethods);
    await logAction('Payment Deleted', `Deleted payment details for ${methodObj?.type || 'unknown'}`);
    setMethodToDelete(null);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Payment method deleted successfully' }));
  };

  const renderFormFields = () => {
    if (activeTab === 'paypal') {
      return (
        <>
          <div className={styles.formGroup}>
            <label>Full Name</label>
            <input 
              required type="text" 
              value={formData.name || ''} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="Full legal name on PayPal account"
            />
          </div>
          <div className={styles.formGroup}>
            <label>PayPal Email Address</label>
            <input 
              required type="email" 
              value={formData.email || ''} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              placeholder="billing@example.com"
            />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Country</label>
              <input 
                required type="text" 
                list="paypal-countries-list"
                value={formData.country || ''} 
                onChange={e => setFormData({...formData, country: e.target.value})} 
                placeholder="e.g. United States, India"
              />
              <datalist id="paypal-countries-list">
                {COMMON_COUNTRIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className={styles.formGroup}>
              <label>Currency</label>
              <input 
                required type="text" 
                list="paypal-currencies-list"
                value={formData.currency || ''} 
                onChange={e => setFormData({...formData, currency: e.target.value})} 
                placeholder="e.g. USD ($), EUR (€)"
              />
              <datalist id="paypal-currencies-list">
                {COMMON_CURRENCIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
        </>
      );
    }
    if (activeTab === 'upi') {
      return (
        <>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Account Holder Name</label>
              <input 
                required type="text" 
                value={formData.accountName || ''} 
                onChange={e => setFormData({...formData, accountName: e.target.value})} 
                placeholder="Full Name as registered with bank"
              />
            </div>
            <div className={styles.formGroup}>
              <label>UPI ID</label>
              <input 
                required type="text" 
                value={formData.upiId || ''} 
                onChange={e => setFormData({...formData, upiId: e.target.value})} 
                placeholder="username@bank or mobile@upi"
              />
            </div>
          </div>

          <div className={styles.formGroup} style={{ marginTop: '16px' }}>
            <label>QR Code (Optional)</label>
            {qrPreviewUrl ? (
              <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '8px' }}>
                <img src={qrPreviewUrl} alt="QR Code Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <button 
                  type="button" 
                  onClick={() => { setQrPreviewUrl(null); setImageSrc(null); }}
                  style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 16px', border: '1px dashed #D1D5DB', borderRadius: '8px', color: '#4B5563', fontSize: '14px' }}>
                <Upload size={16} /> Upload QR Image
                <input type="file" accept="image/jpeg, image/jpg" style={{ display: 'none' }} onChange={onFileChange} />
              </label>
            )}
            {isUploading && <span style={{ marginLeft: '12px', fontSize: '13px', color: '#6B7280' }}>Uploading...</span>}
          </div>
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: 0 }}>How to upload your QR Code</h4>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ width: '100%', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                  <img src="/right-qr.png" alt="Correct way to upload QR code" style={{ width: '100%', transform: 'scale(1.4)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', backgroundColor: '#D1FAE5', color: '#059669', borderRadius: '50%' }}>
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>Correct Way</span>
                </div>
                <p style={{ fontSize: '12.5px', color: '#6B7280', lineHeight: '1.5', margin: 0 }}>
                  Upload a clear, high-quality QR code image where the entire QR code is visible and not cropped. Make sure there is no blur, glare, distortion, or extra elements covering the code.
                </p>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ width: '100%', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                  <img src="/wrong-qr.png" alt="Wrong way to upload QR code" style={{ width: '100%', transform: 'scale(1.4)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '50%' }}>
                    <X size={14} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>Wrong Way</span>
                </div>
                <p style={{ fontSize: '12.5px', color: '#6B7280', lineHeight: '1.5', margin: 0 }}>
                  Do not upload a blurry, cropped, stretched, rotated, or low-quality QR code. Avoid screenshots where the QR code is partially hidden or surrounded by noise.
                </p>
              </div>
            </div>
          </div>
        </>
      );
    }
    if (activeTab === 'wire') {
      return (
        <>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Account Holder Name</label>
              <input 
                required type="text" 
                value={formData.accountName || ''} 
                onChange={e => setFormData({...formData, accountName: e.target.value})} 
                placeholder="Full Name as on Bank Account"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Account Number</label>
              <input 
                required type="text" 
                value={formData.accountNumber || ''} 
                onChange={e => setFormData({...formData, accountNumber: e.target.value})} 
                placeholder="Bank account number"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>IFSC Code (for India)</label>
              <input 
                required type="text" 
                value={formData.ifscCode || ''} 
                onChange={e => setFormData({...formData, ifscCode: e.target.value.toUpperCase()})} 
                placeholder="e.g. HDFC0001234"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Bank Name</label>
              <input 
                required type="text" 
                value={formData.bankName || ''} 
                onChange={e => setFormData({...formData, bankName: e.target.value})} 
                placeholder="e.g. HDFC Bank, Chase, Barclays"
              />
            </div>
          </div>
        </>
      );
    }
    if (activeTab === 'wise') {
      return (
        <>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Recipient Name</label>
              <input 
                required type="text" 
                value={formData.accountName || ''} 
                onChange={e => setFormData({...formData, accountName: e.target.value})} 
                placeholder="Full legal recipient name"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Wise Email (if applicable)</label>
              <input 
                type="email" 
                value={formData.email || ''} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="user@example.com"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Country</label>
              <input 
                required type="text" 
                list="wise-countries-list"
                value={formData.country || ''} 
                onChange={e => setFormData({...formData, country: e.target.value})} 
                placeholder="e.g. United Kingdom, United States"
              />
              <datalist id="wise-countries-list">
                {COMMON_COUNTRIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className={styles.formGroup}>
              <label>Currency</label>
              <input 
                required type="text" 
                list="wise-currencies-list"
                value={formData.currency || ''} 
                onChange={e => setFormData({...formData, currency: e.target.value})} 
                placeholder="e.g. USD ($), EUR (€), GBP (£)"
              />
              <datalist id="wise-currencies-list">
                {COMMON_CURRENCIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <h4 style={{ fontSize: '13.5px', fontWeight: 600, color: '#374151', margin: '16px 0 8px 0' }}>
            Relevant Bank Details for Country
          </h4>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Account Number / IBAN</label>
              <input 
                required type="text" 
                value={formData.accountNumber || ''} 
                onChange={e => setFormData({...formData, accountNumber: e.target.value})} 
                placeholder="Account number or IBAN"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Bank Name</label>
              <input 
                type="text" 
                value={formData.bankName || ''} 
                onChange={e => setFormData({...formData, bankName: e.target.value})} 
                placeholder="e.g. Wise Europe SA, JP Morgan"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Routing Number / Sort Code / SWIFT / BIC</label>
            <input 
              type="text" 
              value={formData.swiftCode || ''} 
              onChange={e => setFormData({...formData, swiftCode: e.target.value.toUpperCase()})} 
              placeholder="e.g. ACH Routing, Sort Code, or SWIFT/BIC"
            />
          </div>
        </>
      );
    }
  };

  const renderDetails = (method: PaymentMethod) => {
    if (method.type === 'paypal') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: 600, color: '#111827' }}>{method.details.name || 'PayPal Account'}</span>
          <span style={{ fontSize: '13px', color: '#4B5563' }}>{method.details.email}</span>
          {(method.details.country || method.details.currency) && (
            <span style={{ fontSize: '12px', color: '#6B7280' }}>
              {[method.details.country, method.details.currency].filter(Boolean).join(' • ')}
            </span>
          )}
        </div>
      );
    }
    if (method.type === 'upi') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: 600, color: '#111827' }}>
            {method.details.accountName || method.details.upiId}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#4B5563' }}>{method.details.upiId}</span>
            {method.details.qrImage && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: '#ECFDF5', color: '#047857', padding: '1px 6px', borderRadius: '8px', fontWeight: '500' }}>
                <ImageIcon size={11} /> QR Saved
              </span>
            )}
          </div>
        </div>
      );
    }
    if (method.type === 'wire') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: 600, color: '#111827' }}>
            {method.details.accountName || method.details.bankName || 'Bank Transfer'}
          </span>
          <span style={{ fontSize: '13px', color: '#4B5563' }}>
            {method.details.bankName ? `${method.details.bankName} • ` : ''}
            A/C: {method.details.accountNumber || '—'}
            {method.details.ifscCode ? ` • IFSC: ${method.details.ifscCode}` : ''}
          </span>
        </div>
      );
    }
    if (method.type === 'wise') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: 600, color: '#111827' }}>
            {method.details.accountName || method.details.email || 'Wise Account'}
          </span>
          <span style={{ fontSize: '13px', color: '#4B5563' }}>
            {method.details.email ? `${method.details.email} • ` : ''}
            {method.details.accountNumber ? `A/C: ${method.details.accountNumber}` : ''}
          </span>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            {[method.details.bankName, method.details.swiftCode, method.details.country, method.details.currency].filter(Boolean).join(' • ')}
          </span>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div style={{ width: '240px', height: '32px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '12px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
        <div style={{ width: '400px', height: '20px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '40px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
        
        <div className={styles.layout}>
          <div className={styles.sidebar}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ width: '100%', height: '60px', backgroundColor: '#F3F4F6', borderRadius: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            ))}
          </div>

          <div className={styles.content}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
              <div style={{ width: '200px', height: '28px', backgroundColor: '#F3F4F6', borderRadius: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
              <div style={{ width: '100px', height: '36px', backgroundColor: '#F3F4F6', borderRadius: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            </div>
            <div style={{ width: '100%', height: '200px', backgroundColor: '#F9FAFB', borderRadius: '12px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
        `}</style>
      </div>
    );
  }

  const currentMethods = methods.filter(m => m.type === activeTab);
  const currentTabInfo = PAYMENT_TYPES.find(p => p.id === activeTab);

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Payment Details</h1>
      <p className={styles.pageSubtitle}>Manage your payout methods for receiving editor payments.</p>

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          {PAYMENT_TYPES.map(type => (
            <button
              key={type.id}
              className={`${styles.tabBtn} ${activeTab === type.id ? styles.activeTab : ''}`}
              onClick={() => {
                setActiveTab(type.id);
                handleCancelForm();
              }}
            >
              <img 
                src={type.logo} 
                alt={type.label} 
                className={styles.tabLogo} 
                style={{
                  height: type.id === 'wire' ? '18px' : type.id === 'upi' ? '15px' : '14px',
                  width: type.id === 'wire' ? '18px' : 'auto',
                  objectFit: 'contain'
                }} 
              />
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src={currentTabInfo?.logo} 
                alt={currentTabInfo?.label} 
                style={{ 
                  height: currentTabInfo?.id === 'wire' ? '20px' : currentTabInfo?.id === 'upi' ? '21px' : '18px',
                  width: currentTabInfo?.id === 'wire' ? '20px' : 'auto',
                  maxHeight: '21px',
                  objectFit: 'contain'
                }} 
              />
              <h2 className={styles.contentTitle}>Saved {currentTabInfo?.label} Details</h2>
            </div>
            {!showAddForm && (
              <button className={styles.addBtn} onClick={() => {
                handleCancelForm();
                setShowAddForm(true);
              }}>
                <Plus size={16} /> Add New
              </button>
            )}
          </div>

          {showAddForm ? (
            <form onSubmit={handleAddSubmit} className={styles.addForm}>
              <h3 style={{ marginBottom: '16px', fontSize: '15px' }}>{editingMethodId ? 'Edit' : 'Add New'} {currentTabInfo?.label}</h3>
              
              {renderFormFields()}
              
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={handleCancelForm}>Cancel</button>
                <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.methodList}>
              {currentMethods.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No saved details for {currentTabInfo?.label}</p>
                  <button className={styles.addBtnOutline} onClick={() => {
                    handleCancelForm();
                    setShowAddForm(true);
                  }}>
                    <Plus size={16} /> Add First Method
                  </button>
                </div>
              ) : (
                currentMethods.map(method => (
                  <div key={method.id} className={`${styles.methodCard} ${method.isDefault ? styles.methodCardDefault : ''}`}>
                    <div className={styles.methodInfo}>
                      <CreditCard size={20} color="#6B7280" />
                      <span className={styles.methodText}>{renderDetails(method)}</span>
                      {method.isDefault && (
                        <span className={styles.defaultBadge}>
                          <Check size={12} /> Default
                        </span>
                      )}
                    </div>
                    <div className={styles.methodActions}>
                      {!method.isDefault && (
                        <button 
                          className={styles.makeDefaultBtn}
                          onClick={() => handleSetDefault(method.id, method.type)}
                          disabled={isSaving}
                        >
                          Make Default
                        </button>
                      )}
                      <button 
                        className={styles.deleteBtn}
                        onClick={() => {
                          handleCancelForm();
                          setEditingMethodId(method.id);
                          setFormData(method.details);
                          setQrPreviewUrl(method.details.qrImage || null);
                          setShowAddForm(true);
                        }}
                        style={{ color: '#111827', marginRight: '8px' }}
                        disabled={isSaving}
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        className={styles.deleteBtn}
                        onClick={() => setMethodToDelete(method.id)}
                        disabled={isSaving}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ 
        marginTop: '32px', 
        padding: '16px 20px', 
        backgroundColor: '#F3F4F6', 
        borderRadius: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        color: '#4B5563',
        fontSize: '13.5px',
        lineHeight: '1.5'
      }}>
        <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <Lock size={18} color="#6B7280" />
        </div>
        <div>
          <strong>Your information is completely safe with us.</strong> All payment details are securely encrypted and stored in our protected database. We do not share your financial data with any third parties, so you can manage your details with total peace of mind.
        </div>
      </div>

      {methodToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>Delete Payment Method</h3>
            <p style={{ margin: '0 0 24px 0', color: '#4B5563', fontSize: '14px' }}>Are you sure you want to delete this payment method? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setMethodToDelete(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontWeight: '500', flex: 1, textAlign: 'center' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: 'white', cursor: 'pointer', fontWeight: '500', flex: 1, textAlign: 'center' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
                setImageSrc(null);
                setIsUploading(false);
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
              image={imageSrc || undefined}
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
                  setImageSrc(null);
                  setIsUploading(false);
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
                onClick={handleCropAndUpload}
                disabled={isUploading}
                style={{
                  padding: '0.65rem 1.6rem',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  opacity: isUploading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 10px rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  if (!isUploading) {
                    e.currentTarget.style.backgroundColor = '#E5E5E5';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isUploading) {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <Crop size={16} strokeWidth={2.5} />
                <span>{isUploading ? 'Uploading...' : 'Crop & Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentDetailsView;
