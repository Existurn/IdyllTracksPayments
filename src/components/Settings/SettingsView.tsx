import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Camera, Mail, MailX, X, Check, Upload, Image as ImageIcon, ArrowLeft, RotateCw, ZoomIn, ZoomOut, Crop, FileText, ExternalLink, Trash2, RefreshCw, Sun, Moon, Lock, Sparkles, Bell, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useRBAC } from '../../contexts/RBACContext';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropImage';
import { getFirstLetterOfFirstName, getGoogleAvatarUrl, isAvatarExplicitlyRemoved, extractGoogleAvatarUrl, isGoogleAccount } from '../../utils/avatarHelper';
import { useKeyboardShortcut } from '../../contexts/KeyboardShortcutContext';
import { useTheme } from '../../contexts/ThemeContext';
import { showToast } from '../../utils/notifications';
import iosLogo from '../../assets/device/ios.png';
import windowsLogo from '../../assets/device/windows.png';
import DancingDotsLoader from '../common/DancingDotsLoader';
import { COUNTRIES, type Country } from '../../utils/countries';
import styles from './SettingsView.module.css';

const AVAILABLE_AVATARS = [
  { id: '1', name: 'Profile 1', url: '/profile-pics/profile-pic-1.jpg' },
  { id: '2', name: 'Profile 2', url: '/profile-pics/profile-pic-2.jpg' },
  { id: '3', name: 'Profile 3', url: '/profile-pics/profile-pic-3.jpg' },
  { id: '5', name: 'Profile 4', url: '/profile-pics/profile-pic-5.jpg' },
  { id: '6', name: 'Profile 5', url: '/profile-pics/profile-pic-6.jpg' },
  { id: '7', name: 'Profile 6', url: '/profile-pics/profile-pic-7.jpg' },
  { id: '8', name: 'Profile 7', url: '/profile-pics/profile-pic-8.jpg' },
  { id: '9', name: 'Profile 8', url: '/profile-pics/profile-pic-9.jpg' },
  { id: '10', name: 'Profile 9', url: '/profile-pics/profile-pic-10.jpg' },
  { id: '12', name: 'Profile 10', url: '/profile-pics/profile-pic-12.jpg' },
  { id: '13', name: 'Profile 11', url: '/profile-pics/profile-pic-13.jpg' },
  { id: '14', name: 'Profile 12', url: '/profile-pics/profile-pic-14.jpg' },
  { id: '15', name: 'Profile 13', url: '/profile-pics/profile-pic-15.jpg' },
  { id: '16', name: 'Profile 14', url: '/profile-pics/profile-pic-16.jpg' },
  { id: 'artboard-2', name: 'Artboard 2', url: '/profile-pics/artboard-2-100.jpg' },
  { id: 'artboard-3', name: 'Artboard 3', url: '/profile-pics/artboard-3-100.jpg' },
];

const isPdfUrl = (url?: string | null, type?: string | null, name?: string | null) => {
  if (!url && !name && !type) return false;
  if (type?.includes('pdf')) return true;
  if (name?.toLowerCase().endsWith('.pdf')) return true;
  if (typeof url === 'string') {
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.pdf')) return true;
  }
  return false;
};

export interface SettingsUnsavedHandlers {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
}

export interface SettingsViewProps {
  onRegisterUnsavedCheck?: (handlers: SettingsUnsavedHandlers | null) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onRegisterUnsavedCheck }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Profile states
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [userIdy, setUserIdy] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentSize, setDocumentSize] = useState<number | undefined>(undefined);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [signUpMethod, setSignUpMethod] = useState('');
  const isGoogleUser = Boolean(
    signUpMethod === 'Google Sign Up' ||
    isGoogleAccount(user)
  );
  const [timeFormat, setTimeFormat] = useState('12h');
  const [isTimeFormatOpen, setIsTimeFormatOpen] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [showTime, setShowTime] = useState(true);
  const [showDay, setShowDay] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const { os, setOS } = useKeyboardShortcut();
  const { theme, setTheme, isDark } = useTheme();

  // Country states
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Close country dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setIsCountryOpen(false);
      }
    };
    if (isCountryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCountryOpen]);

  const filteredCountries = React.useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase().trim();
    return COUNTRIES.filter(
      c => c.name.toLowerCase().includes(q) ||
           c.code.toLowerCase().includes(q) ||
           c.dialCode.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  // Reference to track initial saved state
  const initialSettingsRef = useRef<{
    displayName: string;
    fullName: string;
    mobileNumber: string;
    countryCode?: string;
    countryName?: string;
    timeFormat: string;
    showDate: boolean;
    showTime: boolean;
    showDay: boolean;
    os: string;
    emailNotifications: boolean;
  } | null>(null);
  
  // Modals
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarTab, setAvatarTab] = useState<'preset' | 'upload'>('preset');
  const [selectedPresetUrl, setSelectedPresetUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [isFetchingGoogle, setIsFetchingGoogle] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const closeAvatarModal = () => {
    if (saving) return;
    setIsClosingModal(true);
    setTimeout(() => {
      setShowAvatarModal(false);
      setIsClosingModal(false);
      setIsCropping(false);
      setEnableAvatarTransition(false);
      setAvatarBodyHeight(undefined);
    }, 200);
  };

  // Cropping states
  const [isCropping, setIsCropping] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  const { hasPermission, updateProfile } = useRBAC();

  // Smooth modal resizing for avatar modal
  const avatarModalBodyRef = useRef<HTMLDivElement>(null);
  const [avatarBodyHeight, setAvatarBodyHeight] = useState<number | undefined>(undefined);
  const [enableAvatarTransition, setEnableAvatarTransition] = useState(false);
  const hasMountedModalRef = useRef(false);

  useLayoutEffect(() => {
    if (!showAvatarModal || isCropping) {
      hasMountedModalRef.current = false;
      setEnableAvatarTransition(false);
      setAvatarBodyHeight(undefined);
      return;
    }

    if (!avatarModalBodyRef.current) return;

    const measuredHeight = avatarModalBodyRef.current.offsetHeight;

    if (!hasMountedModalRef.current) {
      hasMountedModalRef.current = true;
      setAvatarBodyHeight(measuredHeight);
      const timer = setTimeout(() => {
        setEnableAvatarTransition(true);
      }, 60);
      return () => clearTimeout(timer);
    } else {
      setEnableAvatarTransition(true);
      setAvatarBodyHeight(measuredHeight);
    }
  }, [showAvatarModal, isCropping, avatarTab, uploadPreview]);

  useEffect(() => {
    if (!showAvatarModal || isCropping || !avatarModalBodyRef.current) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const measured = Math.round(entry.target.getBoundingClientRect().height);
        setAvatarBodyHeight((prev) => {
          if (prev !== undefined && prev !== measured) {
            return measured;
          }
          return prev ?? measured;
        });
      }
    });

    ro.observe(avatarModalBodyRef.current);
    return () => ro.disconnect();
  }, [showAvatarModal, isCropping]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const generateIdyId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'IDY-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        let metaName = user.user_metadata?.full_name || '';
        let metaFullName = user.user_metadata?.legal_full_name || '';
        let metaMobile = user.user_metadata?.mobile_number || '';
        let metaIdy = user.user_metadata?.idy_id;
        let metaAvatar = user.user_metadata?.avatar_url || '';
        let metaTimeFormat = user.user_metadata?.time_format || '12h';
        let metaShowDate = user.user_metadata?.show_date !== undefined ? user.user_metadata.show_date : true;
        let metaShowTime = user.user_metadata?.show_time !== undefined ? user.user_metadata.show_time : true;
        let metaShowDay = user.user_metadata?.show_day !== undefined ? user.user_metadata.show_day : true;
        
        const isAvatarRemoved = isAvatarExplicitlyRemoved(user);
        const isGoogle = isGoogleAccount(user);
        const candidateGooglePfp = extractGoogleAvatarUrl(user);
        
        // Cache google_avatar_url in metadata for permanence
        if (isGoogle && candidateGooglePfp && !user.user_metadata?.google_avatar_url) {
          supabase.auth.updateUser({
            data: { google_avatar_url: candidateGooglePfp }
          }).catch(console.error);
        }

        if (!metaAvatar && !isAvatarRemoved && isGoogle && candidateGooglePfp) {
          metaAvatar = candidateGooglePfp;
          await supabase.auth.updateUser({
            data: { avatar_url: candidateGooglePfp, google_avatar_url: candidateGooglePfp }
          });
          await supabase.from('user_roles').update({ avatar_url: candidateGooglePfp }).eq('id', user.id);
        }

        if (!metaIdy) {
          // Generate and save unique IDY if it doesn't exist
          metaIdy = generateIdyId();
          await supabase.auth.updateUser({
            data: { idy_id: metaIdy }
          });
        }
        
        if (!metaName && user.email) {
          const parts = user.email.split('@')[0].split(/[._-]/);
          metaName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          await supabase.auth.updateUser({
            data: { full_name: metaName }
          });
        }
        
        let metaDocName = user.user_metadata?.document_name || '';
        let metaDocType = user.user_metadata?.document_type || '';
        let metaDocSize = user.user_metadata?.document_size;

        if (!metaDocName && metaAvatar) {
          const clean = metaAvatar.split('?')[0].split('/').pop();
          if (clean?.toLowerCase().endsWith('.pdf')) {
            metaDocName = clean;
            metaDocType = 'application/pdf';
          }
        }

        setDisplayName(metaName);
        setFullName(metaFullName);
        setMobileNumber(metaMobile);
        setUserIdy(metaIdy);
        setAvatarUrl(metaAvatar);
        setDocumentName(metaDocName);
        setDocumentType(metaDocType);
        setDocumentSize(metaDocSize);
        setImageLoadError(false);
        setTimeFormat(metaTimeFormat);
        setShowDate(metaShowDate);
        setShowTime(metaShowTime);
        setShowDay(metaShowDay);

        let metaEmailNotifications = user.user_metadata?.email_notifications !== undefined
          ? user.user_metadata.email_notifications
          : (localStorage.getItem(`idyll_email_notifications_${user.id}`) !== null
              ? localStorage.getItem(`idyll_email_notifications_${user.id}`) === 'true'
              : true);
        setEmailNotifications(metaEmailNotifications);

        let metaCountryName = user.user_metadata?.country || '';
        let metaCountryCode = user.user_metadata?.country_code || '';
        let detectedCountry = COUNTRIES[0]; // default India
        if (metaCountryName || metaCountryCode) {
          const found = COUNTRIES.find(
            c => (metaCountryName && c.name.toLowerCase() === metaCountryName.toLowerCase()) ||
                 (metaCountryCode && c.code.toLowerCase() === metaCountryCode.toLowerCase())
          );
          if (found) detectedCountry = found;
        } else if (user?.id) {
          try {
            const savedLocal = localStorage.getItem(`idyll_user_country_${user.id}`);
            if (savedLocal) {
              const parsed = JSON.parse(savedLocal);
              const found = COUNTRIES.find(c => c.code === parsed.code || c.name === parsed.name);
              if (found) detectedCountry = found;
            }
          } catch (_) {}
        }
        setSelectedCountry(detectedCountry);

        const fetchedOS = user.user_metadata?.os_preference || os;
        initialSettingsRef.current = {
          displayName: metaName,
          fullName: metaFullName,
          mobileNumber: metaMobile,
          countryCode: detectedCountry.code,
          countryName: detectedCountry.name,
          timeFormat: metaTimeFormat,
          showDate: metaShowDate,
          showTime: metaShowTime,
          showDay: metaShowDay,
          os: fetchedOS,
          emailNotifications: metaEmailNotifications
        };

        if (isGoogleAccount(user) || (user.app_metadata && user.app_metadata.provider === 'google')) {
          setSignUpMethod('Google Sign Up');
        } else if (user.app_metadata && user.app_metadata.provider === 'email') {
          setSignUpMethod('Manual Sign Up');
        } else if (user.app_metadata && user.app_metadata.provider) {
          setSignUpMethod(user.app_metadata.provider);
        } else {
          setSignUpMethod('Manual Sign Up');
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setImageLoadError(false);
  }, [avatarUrl]);

  const openAvatarModal = () => {
    const isCurrentPreset = AVAILABLE_AVATARS.some(a => a.url === avatarUrl);
    if (isCurrentPreset) {
      setSelectedPresetUrl(avatarUrl);
    } else {
      setSelectedPresetUrl('');
    }
    setAvatarTab('preset');
    setUploadFile(null);
    setUploadPreview(null);
    setCropImageSrc(null);
    setIsCropping(false);
    setIsClosingModal(false);
    setSaving(false);
    setShowAvatarModal(true);
  };

  const handleClearSelectedFile = () => {
    if (uploadPreview && uploadPreview.startsWith('blob:')) {
      URL.revokeObjectURL(uploadPreview);
    }
    setUploadFile(null);
    setUploadPreview(null);
    setCropImageSrc(null);
    setIsCropping(false);
    if (modalFileInputRef.current) {
      modalFileInputRef.current.value = '';
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, pixelCrop: any) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  const processSelectedFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'File size must be less than 10MB' }));
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name);

    if (!isPdf && !isImage) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Please select a valid image (PNG, JPG, WEBP, GIF) or PDF' }));
      return;
    }

    if (uploadPreview && uploadPreview.startsWith('blob:')) {
      URL.revokeObjectURL(uploadPreview);
    }

    const url = URL.createObjectURL(file);
    setUploadFile(file);
    setUploadPreview(url);

    if (isPdf) {
      setCropImageSrc(null);
      setIsCropping(false);
    } else {
      setCropImageSrc(url);
      setCrop({ x: 0, y: 0 });
      setZoom(0.7);
      setRotation(0);
      setIsCropping(false);
    }
  };

  const handleModalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFetchFromGoogle = async () => {
    try {
      setIsFetchingGoogle(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const activeUser = currentUser || session?.user || user;
      if (!activeUser) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Please sign in to fetch Google profile picture.' }));
        return;
      }

      let googlePfp = extractGoogleAvatarUrl(activeUser, session?.user);

      // If not found in metadata or identities array, query getUserIdentities() API
      if (!googlePfp && (supabase.auth as any).getUserIdentities) {
        try {
          const { data: identData } = await (supabase.auth as any).getUserIdentities();
          const gIdentity = identData?.identities?.find((i: any) => i.provider === 'google');
          if (gIdentity?.identity_data) {
            googlePfp = gIdentity.identity_data.avatar_url || gIdentity.identity_data.picture || '';
          }
        } catch (identErr) {
          console.warn('Error fetching user identities:', identErr);
        }
      }

      if (!googlePfp) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: 'No profile picture found on your Google account.' 
        }));
        return;
      }

      // Clean up previous uploaded avatar in storage if exists
      const previousAvatarUrl = avatarUrl || activeUser?.user_metadata?.avatar_url;
      if (previousAvatarUrl && previousAvatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const oldFileName = previousAvatarUrl.split('?')[0].split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('avatars').remove([oldFileName]).catch((e) => console.error('Error removing old avatar:', e));
        }
      }

      // Explicitly update Supabase Auth metadata with new avatar and reset avatar_removed flag
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          avatar_url: googlePfp,
          google_avatar_url: googlePfp,
          avatar_removed: false,
          document_name: null,
          document_type: null,
          document_size: null
        }
      });
      if (authError) throw authError;

      // Update via central profile update
      await updateProfile({ avatarUrl: googlePfp });

      setAvatarUrl(googlePfp);
      setDocumentName('');
      setDocumentType('');
      setDocumentSize(undefined);
      setImageLoadError(false);
      closeAvatarModal();
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Profile picture imported from Google successfully.' }));
      window.dispatchEvent(new Event('profile-updated'));
    } catch (err: any) {
      console.error('Error fetching Google avatar:', err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: err?.message || 'Failed to fetch Google profile picture.' }));
    } finally {
      setIsFetchingGoogle(false);
    }
  };

  const handleSaveAvatar = async () => {
    try {
      setSaving(true);
      let currentUser = user;
      if (!currentUser) {
        const { data: { user: fetchedUser } } = await supabase.auth.getUser();
        currentUser = fetchedUser;
      }
      if (!currentUser) {
        throw new Error('User session not found. Please refresh and try again.');
      }

      let targetUrl = '';
      let docName: string | null = null;
      let docType: string | null = null;
      let docSize: number | null = null;

      if (avatarTab === 'upload') {
        if (!uploadFile) {
          if (avatarUrl) {
            closeAvatarModal();
            return;
          }
          window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Please select a file to upload.' }));
          return;
        }

        const isPdf = uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf');
        let fileToUpload: Blob | File = uploadFile;
        let fileExt = uploadFile.name.split('.').pop() || (isPdf ? 'pdf' : 'jpg');
        let contentType = isPdf ? 'application/pdf' : (uploadFile.type || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`);

        if (isPdf) {
          docName = uploadFile.name;
          docType = 'application/pdf';
          docSize = uploadFile.size;
        } else {
          if (cropImageSrc) {
            try {
              const pixelCrop = croppedAreaPixels || { x: 0, y: 0, width: 280, height: 280 };
              const croppedBlob = await getCroppedImg(cropImageSrc, pixelCrop, rotation);
              if (croppedBlob) {
                fileToUpload = croppedBlob;
                fileExt = 'jpg';
                contentType = 'image/jpeg';
              }
            } catch (cropErr) {
              console.warn('Cropping error, falling back to original file:', cropErr);
              fileToUpload = uploadFile;
            }
          }
        }

        // Safeguard: Ensure fileToUpload is a real binary Blob/File, never a base64 data URL string
        if (typeof (fileToUpload as any) === 'string') {
          const str = fileToUpload as unknown as string;
          if (str.startsWith('data:')) {
            const arr = str.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            fileToUpload = new Blob([u8arr], { type: mime });
          }
        }

        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, fileToUpload, {
            contentType,
            upsert: true
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Clean up previous uploaded avatar in storage if exists
        const previousAvatarUrl = avatarUrl || currentUser.user_metadata?.avatar_url;
        if (previousAvatarUrl && previousAvatarUrl.includes('/storage/v1/object/public/avatars/')) {
          const oldFileName = previousAvatarUrl.split('?')[0].split('/').pop();
          if (oldFileName && oldFileName !== fileName) {
            await supabase.storage.from('avatars').remove([oldFileName]).catch((e) => console.error('Error removing old avatar:', e));
          }
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        targetUrl = `${publicUrl}?v=${Date.now()}`;
      } else {
        // Preset tab
        targetUrl = selectedPresetUrl;
        if (!targetUrl) return;

        // Clean up previous uploaded avatar in storage if user switched to preset
        const previousAvatarUrl = avatarUrl || currentUser.user_metadata?.avatar_url;
        if (previousAvatarUrl && previousAvatarUrl.includes('/storage/v1/object/public/avatars/')) {
          const oldFileName = previousAvatarUrl.split('?')[0].split('/').pop();
          if (oldFileName) {
            await supabase.storage.from('avatars').remove([oldFileName]).catch((e) => console.error('Error removing old avatar:', e));
          }
        }
      }

      // Update Supabase Auth metadata
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: targetUrl,
          avatar_removed: false,
          document_name: docName,
          document_type: docType,
          document_size: docSize
        }
      });
      if (authUpdateError) throw authUpdateError;

      // Update via central profile update
      await updateProfile({ avatarUrl: targetUrl });

      // Update local state
      setAvatarUrl(targetUrl);
      setDocumentName(docName || '');
      setDocumentType(docType || '');
      setDocumentSize(docSize || undefined);
      setImageLoadError(false);
      setUploadFile(null);
      setUploadPreview(null);
      setCropImageSrc(null);
      setIsCropping(false);
      closeAvatarModal();

      const successMsg = docType === 'application/pdf'
        ? 'PDF document uploaded successfully'
        : 'Profile picture updated successfully';
      window.dispatchEvent(new CustomEvent('show-toast', { detail: successMsg }));
      window.dispatchEvent(new Event('profile-updated'));
    } catch (error: any) {
      console.error('Error saving avatar:', error);
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: error?.message || 'Failed to save profile picture. Please try again.' 
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setSaving(true);
      let currentUser = user;
      if (!currentUser) {
        const { data: { user: fetchedUser } } = await supabase.auth.getUser();
        currentUser = fetchedUser;
      }
      if (!currentUser) {
        throw new Error('User session not found');
      }

      const wasPdf = isPdfUrl(avatarUrl, documentType, documentName);

      const previousAvatarUrl = avatarUrl || currentUser?.avatarUrl || currentUser?.user_metadata?.avatar_url;
      // Remove from storage bucket if stored there
      if (previousAvatarUrl && previousAvatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const oldFileName = previousAvatarUrl.split('?')[0].split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('avatars').remove([oldFileName]).catch((e) => console.error(e));
        }
      }

      // Explicitly mark avatar as removed and clear all avatar/document fields
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          avatar_url: '',
          avatar_removed: true,
          document_name: null,
          document_type: null,
          document_size: null
        }
      });
      if (authError) throw authError;

      await updateProfile({ avatarUrl: null });

      if (uploadPreview && uploadPreview.startsWith('blob:')) {
        URL.revokeObjectURL(uploadPreview);
      }

      setAvatarUrl('');
      setDocumentName('');
      setDocumentType('');
      setDocumentSize(undefined);
      setImageLoadError(false);
      setUploadFile(null);
      setUploadPreview(null);
      setCropImageSrc(null);
      setIsCropping(false);

      closeAvatarModal();
      window.dispatchEvent(new CustomEvent('show-toast', { detail: wasPdf ? 'Document removed' : 'Profile picture removed' }));
      window.dispatchEvent(new Event('profile-updated'));
    } catch (error: any) {
      console.error('Error removing avatar:', error);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: error?.message || 'Failed to remove profile picture' }));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEmailNotifications = async () => {
    const nextVal = !emailNotifications;
    setEmailNotifications(nextVal);

    if (user?.id) {
      localStorage.setItem(`idyll_email_notifications_${user.id}`, String(nextVal));
      try {
        await supabase.auth.updateUser({
          data: { email_notifications: nextVal }
        });
        if (initialSettingsRef.current) {
          initialSettingsRef.current.emailNotifications = nextVal;
        }
      } catch (err) {
        console.warn('Error saving email notification preference:', err);
      }
    }
    showToast(nextVal ? 'Email notifications enabled' : 'Email notifications paused');
  };

  const isDirty = Boolean(
    initialSettingsRef.current && (
      displayName !== initialSettingsRef.current.displayName ||
      fullName !== initialSettingsRef.current.fullName ||
      mobileNumber !== initialSettingsRef.current.mobileNumber ||
      selectedCountry.code !== initialSettingsRef.current.countryCode ||
      timeFormat !== initialSettingsRef.current.timeFormat ||
      showDate !== initialSettingsRef.current.showDate ||
      showTime !== initialSettingsRef.current.showTime ||
      showDay !== initialSettingsRef.current.showDay ||
      os !== initialSettingsRef.current.os ||
      emailNotifications !== initialSettingsRef.current.emailNotifications
    )
  );

  const saveChanges = async (): Promise<boolean> => {
    try {
      if (!displayName.trim()) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Display Name is required to complete your profile' }));
        return false;
      }
      if (!fullName.trim()) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Full Name is required to complete your profile' }));
        return false;
      }

      setSaving(true);
      const resolvedName = (displayName || fullName || '').trim();
      
      // Update central profile (user_roles table + RBAC state + Supabase Auth)
      await updateProfile({
        displayName: displayName.trim(),
        fullName: fullName.trim(),
        name: resolvedName
      });

      const { error } = await supabase.auth.updateUser({
        data: { 
          full_name: displayName.trim(), 
          legal_full_name: fullName.trim(),
          profile_setup_completed: true,
          mobile_number: mobileNumber,
          country: selectedCountry.name,
          country_code: selectedCountry.code,
          time_format: timeFormat,
          show_date: showDate,
          show_time: showTime,
          show_day: showDay,
          os_preference: os,
          email_notifications: emailNotifications
        }
      });
      if (error) throw error;

      if (user?.id) {
        try {
          await supabase.from('user_roles').update({
            country: selectedCountry.name,
            country_code: selectedCountry.code
          }).eq('id', user.id);
        } catch (_) {}
        localStorage.setItem(`idyll_email_notifications_${user.id}`, String(emailNotifications));
        localStorage.setItem(`idyll_user_country_${user.id}`, JSON.stringify(selectedCountry));
      }

      setUser((prev: any) => prev ? {
        ...prev,
        user_metadata: {
          ...prev.user_metadata,
          full_name: displayName.trim(),
          legal_full_name: fullName.trim(),
          country: selectedCountry.name,
          country_code: selectedCountry.code,
          profile_setup_completed: true,
          email_notifications: emailNotifications
        }
      } : prev);

      initialSettingsRef.current = {
        displayName: displayName.trim(),
        fullName: fullName.trim(),
        mobileNumber,
        countryCode: selectedCountry.code,
        countryName: selectedCountry.name,
        timeFormat,
        showDate,
        showTime,
        showDay,
        os,
        emailNotifications
      };
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Changes saved' }));
      window.dispatchEvent(new Event('profile-updated'));
      return true;
    } catch (error: any) {
      console.error('Error updating settings:', error);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: error?.message || 'Failed to save changes' }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (!initialSettingsRef.current) return;
    const init = initialSettingsRef.current;
    setDisplayName(init.displayName);
    setFullName(init.fullName);
    setMobileNumber(init.mobileNumber);
    if (init.countryCode || init.countryName) {
      const found = COUNTRIES.find(c => c.code === init.countryCode || c.name === init.countryName);
      if (found) setSelectedCountry(found);
    }
    setTimeFormat(init.timeFormat);
    setShowDate(init.showDate);
    setShowTime(init.showTime);
    setShowDay(init.showDay);
    setOS(init.os as any);
    setEmailNotifications(init.emailNotifications ?? true);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveChanges();
  };

  const handlersRef = useRef<SettingsUnsavedHandlers>({
    isDirty: () => isDirty,
    save: saveChanges,
    discard: discardChanges
  });

  useEffect(() => {
    handlersRef.current = {
      isDirty: () => isDirty,
      save: saveChanges,
      discard: discardChanges
    };
  });

  useEffect(() => {
    if (onRegisterUnsavedCheck) {
      onRegisterUnsavedCheck({
        isDirty: () => handlersRef.current.isDirty(),
        save: () => handlersRef.current.save(),
        discard: () => handlersRef.current.discard()
      });
    }
    return () => {
      if (onRegisterUnsavedCheck) {
        onRegisterUnsavedCheck(null);
      }
    };
  }, [onRegisterUnsavedCheck]);

  useEffect(() => {
    (window as any).__settingsUnsavedHandlers = {
      isDirty: () => handlersRef.current.isDirty(),
      save: () => handlersRef.current.save(),
      discard: () => handlersRef.current.discard()
    };
    return () => {
      delete (window as any).__settingsUnsavedHandlers;
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (handlersRef.current.isDirty()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);


  if (loading) {
    return (
      <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
        <DancingDotsLoader size={8} color="#000000" gap={6} borderRadius="2px" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>Manage your personal details, workspace preferences, and notification settings.</p>
      </div>
      
      {/* Welcome / Complete Profile Alert if incomplete */}
      {(!user?.user_metadata?.profile_setup_completed || !displayName.trim() || !fullName.trim()) && (
        <div style={{
          backgroundColor: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: '#9A3412', marginBottom: '3px' }}>
            Welcome to Idyll Track Payments
          </div>
          <div style={{ fontSize: '13.5px', color: '#7C2D12', lineHeight: '1.4' }}>
            Please complete your <strong>Display Name</strong> and <strong>Full Name</strong> below to complete your account setup and access the platform.
          </div>
        </div>
      )}

      {/* Main Form Splitting into Left and Right Columns */}
      <form onSubmit={handleUpdateName} style={{ width: '100%' }}>
        <div className={styles.splitGrid}>
          
          {/* LEFT COLUMN: Profile Information */}
          <div className={styles.column}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Profile Information</h2>
              <p className={styles.sectionSubtitle}>Update your photo and personal account credentials.</p>
            </div>

            {/* Profile Photo Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '16px',
              backgroundColor: 'var(--bg-hover)',
              border: '1px solid var(--border-default)',
              borderRadius: '10px'
            }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div 
                  onClick={openAvatarModal}
                  title="Click to change profile picture"
                  style={{ 
                    width: '76px', height: '76px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', 
                    border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', color: 'var(--text-primary)', fontSize: '26px', fontWeight: '600',
                    cursor: 'pointer', transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {avatarUrl && isPdfUrl(avatarUrl, documentType, documentName) ? (
                    <div style={{ width: '100%', height: '100%', backgroundColor: '#FEF2F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={28} color="#DC2626" />
                      <span style={{ fontSize: '9px', fontWeight: '700', color: '#DC2626', marginTop: '2px' }}>PDF</span>
                    </div>
                  ) : avatarUrl && !imageLoadError ? (
                    <img 
                      src={avatarUrl} 
                      alt="Avatar" 
                      referrerPolicy="no-referrer"
                      onError={() => setImageLoadError(true)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    getFirstLetterOfFirstName(displayName || fullName, user?.email)
                  )}
                </div>
                <button 
                  type="button"
                  onClick={openAvatarModal}
                  disabled={saving}
                  style={{ 
                    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#111827', color: 'white',
                    border: 'none', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                  }}
                  title={isPdfUrl(avatarUrl, documentType, documentName) ? "Change document" : "Change profile picture"}
                >
                  <Camera size={13} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Profile Photo</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>JPG, PNG or PDF document. Max 5MB.</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={openAvatarModal}
                    disabled={saving}
                    style={{
                      fontSize: '12px',
                      color: '#2563EB',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '500',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {isPdfUrl(avatarUrl, documentType, documentName) ? 'Change File' : 'Change Picture'}
                  </button>

                  {avatarUrl && (
                    <button 
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={saving}
                      style={{ fontSize: '12px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', padding: '4px 8px' }}
                    >
                      Remove
                    </button>
                  )}

                  {isGoogleUser && (
                    <button
                      type="button"
                      onClick={handleFetchFromGoogle}
                      disabled={saving || isFetchingGoogle}
                      style={{
                        fontSize: '12px',
                        color: '#4B5563',
                        background: 'none',
                        border: 'none',
                        cursor: (saving || isFetchingGoogle) ? 'not-allowed' : 'pointer',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Import profile picture from your Google account"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      {isFetchingGoogle ? 'Fetching...' : 'Fetch from Google'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Uploaded PDF Document Card (if a PDF is uploaded) */}
            {avatarUrl && isPdfUrl(avatarUrl, documentType, documentName) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, marginRight: '8px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: '#FEE2E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#DC2626',
                    flexShrink: 0
                  }}>
                    <FileText size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', wordBreak: 'break-all' }}>
                      {documentName || 'Uploaded_Document.pdf'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                      PDF Document {documentSize ? `• ${(documentSize / 1024).toFixed(1)} KB` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => window.open(avatarUrl, '_blank', 'noopener,noreferrer')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#111827',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <ExternalLink size={13} /> View PDF
                  </button>

                  <button
                    type="button"
                    onClick={openAvatarModal}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#374151',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={12} /> Replace
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#DC2626',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            )}

            {/* Display Name */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Display Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                style={{ 
                  width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', 
                  fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Full Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Legal or Full Name"
                style={{ 
                  width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', 
                  fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              />
              {hasPermission(user?.id, 'payments') && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', margin: '6px 0 0 0' }}>
                  This name will be used when you use the auto fill feature in invoice creation.
                </p>
              )}
            </div>

            {/* Mobile Number & Country */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Mobile Number
                </label>
                <input 
                  type="text" 
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+1 234 567 8900"
                  style={{ 
                    width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', 
                    fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ position: 'relative' }} ref={countryDropdownRef}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Country
                </label>
                <div 
                  onClick={() => setIsCountryOpen(!isCountryOpen)}
                  style={{ 
                    width: '100%', padding: '10px 12px', border: isCountryOpen ? '1px solid var(--text-primary)' : '1px solid var(--border-default)', borderRadius: '8px', 
                    fontSize: '14px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box',
                    userSelect: 'none', transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>{selectedCountry.flag}</span>
                    <span style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedCountry.name}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', flexShrink: 0 }}>({selectedCountry.dialCode})</span>
                  </div>
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{
                      transform: isCountryOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                      color: 'var(--text-secondary)',
                      flexShrink: 0
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>

                {isCountryOpen && (
                  <>
                    <div 
                      onClick={() => setIsCountryOpen(false)} 
                      style={{ position: 'fixed', inset: 0, zIndex: 19 }} 
                    />
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                      backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px',
                      boxShadow: 'var(--shadow-md, 0 10px 25px -5px rgba(0,0,0,0.15))', zIndex: 20, overflow: 'hidden',
                      display: 'flex', flexDirection: 'column', maxHeight: '260px'
                    }}>
                      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-default)' }}>
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country or code..."
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            fontSize: '13px',
                            border: '1px solid var(--border-default)',
                            borderRadius: '6px',
                            outline: 'none',
                            backgroundColor: 'var(--bg-hover)',
                            color: 'var(--text-primary)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div style={{ overflowY: 'auto', flex: 1, maxHeight: '200px' }}>
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((c) => {
                            const isSelected = selectedCountry.code === c.code;
                            return (
                              <div
                                key={c.code}
                                onClick={() => {
                                  setSelectedCountry(c);
                                  setIsCountryOpen(false);
                                  setCountrySearch('');
                                }}
                                style={{
                                  padding: '9px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                  color: 'var(--text-primary)',
                                  transition: 'background-color 0.1s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '16px', lineHeight: 1 }}>{c.flag}</span>
                                  <span>{c.name}</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{c.dialCode}</span>
                                </div>
                                {isSelected && <Check size={14} color="var(--text-primary)" />}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            No countries found
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Unique ID & Email Address */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Unique ID</label>
                <input 
                  type="text" 
                  value={userIdy}
                  readOnly
                  style={{ 
                    width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', 
                    fontSize: '14px', backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    value={user?.email || ''}
                    readOnly
                    style={{ 
                      width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border-default)', borderRadius: '8px', 
                      fontSize: '14px', backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Mail size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>
            </div>

            {/* Sign Up Method & Time Format */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Sign Up Method</label>
                <input 
                  type="text" 
                  value={signUpMethod}
                  readOnly
                  style={{ 
                    width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', 
                    fontSize: '14px', backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Time Format</label>
                <div 
                  onClick={() => setIsTimeFormatOpen(!isTimeFormatOpen)}
                  style={{ 
                    width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', 
                    fontSize: '14px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box'
                  }}
                >
                  {timeFormat === '12h' ? '12-hour (e.g., 2:30 PM)' : '24-hour (e.g., 14:30)'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                {isTimeFormatOpen && (
                  <>
                    <div 
                      onClick={() => setIsTimeFormatOpen(false)} 
                      style={{ position: 'fixed', inset: 0, zIndex: 9 }} 
                    />
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                      backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px',
                      boxShadow: 'var(--shadow-md)', zIndex: 10, overflow: 'hidden'
                    }}>
                      <div 
                        onClick={() => { setTimeFormat('12h'); setIsTimeFormatOpen(false); }}
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', backgroundColor: timeFormat === '12h' ? 'var(--bg-hover)' : 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        12-hour (e.g., 2:30 PM) {timeFormat === '12h' && <span style={{color: 'var(--text-primary)'}}>✓</span>}
                      </div>
                      <div 
                        onClick={() => { setTimeFormat('24h'); setIsTimeFormatOpen(false); }}
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', backgroundColor: timeFormat === '24h' ? 'var(--bg-hover)' : 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        24-hour (e.g., 14:30) {timeFormat === '24h' && <span style={{color: 'var(--text-primary)'}}>✓</span>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Preferences & System */}
          <div className={styles.column}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Preferences & System</h2>
              <p className={styles.sectionSubtitle}>Manage notifications, keyboard shortcuts, and clock visibility.</p>
            </div>

            {/* User-Specific Email Notifications */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', margin: 0 }}>
                  Email Notifications
                </label>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: emailNotifications ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: emailNotifications ? '#059669' : '#DC2626',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: emailNotifications ? '#10B981' : '#EF4444'
                  }} />
                  {emailNotifications ? 'Emails Enabled' : 'Emails Paused'}
                </span>
              </div>

              {/* Main Toggle Card */}
              <div 
                id="email-notifications-toggle-card"
                onClick={handleToggleEmailNotifications}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  border: '1.5px solid var(--border-default)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, background-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: emailNotifications ? 'var(--bg-hover)' : 'rgba(239, 68, 68, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: emailNotifications ? 'var(--text-primary)' : '#DC2626',
                    flexShrink: 0
                  }}>
                    {emailNotifications ? <Mail size={18} /> : <MailX size={18} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', userSelect: 'none' }}>
                      Send invoice & activity emails to my email
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', userSelect: 'none', marginTop: '2px' }}>
                      {user?.email ? `Delivering to ${user.email}` : 'Sends confirmations and updates to your registered account email'}
                    </div>
                  </div>
                </div>

                <div 
                  id="email-notifications-toggle-switch"
                  role="switch"
                  aria-checked={emailNotifications}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEmailNotifications();
                  }}
                  style={{ 
                    width: '40px', 
                    height: '24px', 
                    backgroundColor: emailNotifications ? 'var(--text-primary)' : 'var(--border-default)', 
                    borderRadius: '8px', 
                    position: 'relative', 
                    cursor: 'pointer', 
                    transition: 'background-color 0.2s',
                    flexShrink: 0,
                    marginLeft: '12px'
                  }}
                >
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: '2px', 
                      left: emailNotifications ? '18px' : '2px', 
                      width: '20px', 
                      height: '20px', 
                      backgroundColor: 'var(--bg-surface)', 
                      borderRadius: '6px', 
                      transition: 'left 0.2s', 
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)' 
                    }} 
                  />
                </div>
              </div>

              {/* Dynamic Service Status Breakdown Card */}
              <div style={{
                marginTop: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-hover)',
                fontSize: '12px',
                lineHeight: '1.5'
              }}>
                {emailNotifications ? (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontWeight: '600', 
                      color: 'var(--text-primary)', 
                      marginBottom: '6px' 
                    }}>
                      <Check size={14} color="#059669" strokeWidth={2.5} />
                      <span>Services active with Email Notifications turned ON:</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                      <li style={{ marginBottom: '4px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Invoice Receipts:</strong> Instant confirmation email with invoice details & PDF download link when you create and submit an invoice.
                      </li>
                      <li style={{ marginBottom: '4px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Status Alerts:</strong> Real-time notifications when your submitted invoice is approved, paid, or reviewed by Finance.
                      </li>
                      <li>
                        <strong style={{ color: 'var(--text-primary)' }}>Account Updates:</strong> Verified activity logs and receipts sent directly to your registered email.
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <div style={{ 
                      fontWeight: '600', 
                      color: '#DC2626', 
                      marginBottom: '6px' 
                    }}>
                      <span>Services paused with Email Notifications turned OFF:</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                      <li style={{ marginBottom: '4px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>No Invoice Submission Emails:</strong> No confirmation or copy emails will be sent to your inbox when you create or send an invoice.
                      </li>
                      <li style={{ marginBottom: '4px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>No Activity Alerts:</strong> Routine automated emails for post-login actions and status changes will be suppressed.
                      </li>
                      <li>
                        <strong style={{ color: 'var(--text-primary)' }}>Dashboard Always Available:</strong> Your invoices remain 100% safe, submitted to the Finance team, and accessible anytime in your portal.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Keyboard Shortcuts / Operating System */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Keyboard Shortcuts / Operating System
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div 
                  onClick={() => setOS('mac')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    minHeight: '56px',
                    boxSizing: 'border-box',
                    border: os === 'mac' ? '1.5px solid var(--text-primary)' : '1.5px solid var(--border-default)',
                    borderRadius: '8px',
                    backgroundColor: os === 'mac' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img 
                      src={iosLogo} 
                      alt="iOS / Mac" 
                      style={{ width: '26px', height: '26px', objectFit: 'contain', display: 'block', flexShrink: 0 }} 
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', userSelect: 'none' }}>
                      iOS / Mac
                    </span>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-hover)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-default)',
                    userSelect: 'none'
                  }}>
                    ⌘K
                  </span>
                </div>

                <div 
                  onClick={() => setOS('windows')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    minHeight: '56px',
                    boxSizing: 'border-box',
                    border: os === 'windows' ? '1.5px solid var(--text-primary)' : '1.5px solid var(--border-default)',
                    borderRadius: '8px',
                    backgroundColor: os === 'windows' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img 
                      src={windowsLogo} 
                      alt="Windows" 
                      style={{ width: '26px', height: '26px', objectFit: 'contain', display: 'block', flexShrink: 0 }} 
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', userSelect: 'none' }}>
                      Windows
                    </span>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-hover)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-default)',
                    userSelect: 'none'
                  }}>
                    Ctrl + K
                  </span>
                </div>
              </div>
            </div>

            {/* Header Display Toggles */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Top Bar Display
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--border-default)', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '500' }}>Show Date</span>
                  <div 
                    onClick={() => setShowDate(!showDate)}
                    style={{ width: '38px', height: '22px', backgroundColor: showDate ? 'var(--text-primary)' : 'var(--border-default)', borderRadius: '8px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', top: '2px', left: showDate ? '18px' : '2px', width: '18px', height: '18px', backgroundColor: 'var(--bg-surface)', borderRadius: '5px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--border-default)', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '500' }}>Show Day</span>
                  <div 
                    onClick={() => setShowDay(!showDay)}
                    style={{ width: '38px', height: '22px', backgroundColor: showDay ? 'var(--text-primary)' : 'var(--border-default)', borderRadius: '8px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', top: '2px', left: showDay ? '18px' : '2px', width: '18px', height: '18px', backgroundColor: 'var(--bg-surface)', borderRadius: '5px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--border-default)', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '500' }}>Show Time</span>
                  <div 
                    onClick={() => setShowTime(!showTime)}
                    style={{ width: '38px', height: '22px', backgroundColor: showTime ? 'var(--text-primary)' : 'var(--border-default)', borderRadius: '8px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', top: '2px', left: showTime ? '18px' : '2px', width: '18px', height: '18px', backgroundColor: 'var(--bg-surface)', borderRadius: '5px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Changes button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button 
                type="submit"
                disabled={saving}
                style={{ 
                  padding: '10px 24px', backgroundColor: 'var(--brand-dark)', color: 'var(--bg-main)', borderRadius: '8px', 
                  border: 'none', fontSize: '14px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s', minWidth: '130px', textAlign: 'center'
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

          </div>

        </div>
      </form>


      {/* Profile Picture Selection Modal */}
      {showAvatarModal && typeof document !== 'undefined' && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            animation: isClosingModal ? 'fadeOutBackdrop 0.2s ease-in forwards' : 'fadeInBackdrop 0.24s ease-out forwards'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              if (isCropping) {
                setIsCropping(false);
              } else {
                closeAvatarModal();
              }
            }
          }}
        >
          {isCropping && cropImageSrc ? (
            <div
              key="crop-view"
              style={{
                backgroundColor: '#131314',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                animation: isClosingModal 
                  ? 'scaleOutModal 0.2s cubic-bezier(0.4, 0, 1, 1) forwards' 
                  : 'cropViewIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                color: '#FFFFFF'
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <button
                  type="button"
                  onClick={() => setIsCropping(false)}
                  disabled={saving}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#E3E3E3',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  title="Back"
                >
                  <ArrowLeft size={20} />
                </button>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#FFFFFF',
                  letterSpacing: '0.2px'
                }}>
                  Crop and rotate
                </h3>
                <div style={{ width: '36px' }} />
              </div>

              {/* Cropper Body with 4 Corner White Brackets */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '370px',
                backgroundColor: '#131314',
                overflow: 'hidden'
              }}>
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  cropSize={{ width: 260, height: 260 }}
                  minZoom={0.2}
                  maxZoom={3}
                  restrictPosition={false}
                  zoomSpeed={0.5}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  onMediaLoaded={(mediaSize) => {
                    const maxDim = Math.max(mediaSize.width, mediaSize.height);
                    if (maxDim > 0) {
                      // Fit the full image inside the 260px crop circle so it is not cropped on load
                      const fitZoom = Math.min(1, Math.max(0.2, +(240 / maxDim).toFixed(2)));
                      setZoom(fitZoom);
                    }
                  }}
                  style={{
                    containerStyle: {
                      backgroundColor: '#131314'
                    },
                    cropAreaStyle: {
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }
                  }}
                />

                {/* 4 Corner White Brackets ("L" shapes) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '260px',
                    height: '260px',
                    pointerEvents: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '24px',
                    height: '24px',
                    borderTop: '3px solid #FFFFFF',
                    borderLeft: '3px solid #FFFFFF'
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '24px',
                    height: '24px',
                    borderTop: '3px solid #FFFFFF',
                    borderRight: '3px solid #FFFFFF'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '24px',
                    height: '24px',
                    borderBottom: '3px solid #FFFFFF',
                    borderLeft: '3px solid #FFFFFF'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '24px',
                    height: '24px',
                    borderBottom: '3px solid #FFFFFF',
                    borderRight: '3px solid #FFFFFF'
                  }} />
                </div>
              </div>

              {/* Controls: Rotate & Zoom & Next */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '20px 24px 28px',
                backgroundColor: '#131314'
              }}>
                {/* Rotate button */}
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#28292A',
                    border: '1px solid #3C4043',
                    color: '#E3E3E3',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#35363A')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#28292A')}
                >
                  <RotateCw size={18} />
                  <span style={{ fontSize: '12px', fontWeight: '500' }}>Rotate</span>
                </button>

                {/* Zoom control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '250px' }}>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9AA0A6',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Zoom Out"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.02}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: '#A8C7FA',
                      cursor: 'pointer',
                      height: '4px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9AA0A6',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Zoom In"
                  >
                    <ZoomIn size={18} />
                  </button>
                </div>

                {/* Save button */}
                <button
                  type="button"
                  onClick={handleSaveAvatar}
                  disabled={saving}
                  style={{
                    backgroundColor: '#A8C7FA',
                    color: '#041E49',
                    border: 'none',
                    borderRadius: '24px',
                    padding: '10px 42px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    transition: 'background-color 0.15s, opacity 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) e.currentTarget.style.backgroundColor = '#BEE0FC';
                  }}
                  onMouseLeave={(e) => {
                    if (!saving) e.currentTarget.style.backgroundColor = '#A8C7FA';
                  }}
                >
                  {saving ? (
                    <>
                      <div style={{
                        width: 14,
                        height: 14,
                        border: '2px solid #041E49',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite'
                      }} />
                      Saving...
                    </>
                  ) : (
                    'Save Picture'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div 
              key="main-view"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '540px',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--border-default)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                animation: isClosingModal 
                  ? 'scaleOutModal 0.2s cubic-bezier(0.4, 0, 1, 1) forwards' 
                  : 'mainViewIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
            >
              {/* Modal Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-default)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Select Profile Picture
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Choose from available avatars or upload a new photo
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !saving && closeAvatarModal()}
                  disabled={saving}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    color: '#6B7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s, color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) {
                      e.currentTarget.style.backgroundColor = '#F3F4F6';
                      e.currentTarget.style.color = '#111827';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6B7280';
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid #E5E7EB',
                padding: '0 24px',
                gap: '24px',
                backgroundColor: '#FAFAFA'
              }}>
                <button
                  type="button"
                  onClick={() => setAvatarTab('preset')}
                  style={{
                    padding: '14px 0',
                    background: 'none',
                    border: 'none',
                    borderBottom: avatarTab === 'preset' ? '2px solid #111827' : '2px solid transparent',
                    color: avatarTab === 'preset' ? '#111827' : '#6B7280',
                    fontWeight: avatarTab === 'preset' ? '600' : '500',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'color 0.2s, border-bottom-color 0.2s'
                  }}
                >
                  <ImageIcon size={16} /> Choose Avatar
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarTab('upload')}
                  style={{
                    padding: '14px 0',
                    background: 'none',
                    border: 'none',
                    borderBottom: avatarTab === 'upload' ? '2px solid #111827' : '2px solid transparent',
                    color: avatarTab === 'upload' ? '#111827' : '#6B7280',
                    fontWeight: avatarTab === 'upload' ? '600' : '500',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'color 0.2s, border-bottom-color 0.2s'
                  }}
                >
                  <Upload size={16} /> Upload New
                </button>

                {isGoogleUser && (
                  <button
                    type="button"
                    onClick={handleFetchFromGoogle}
                    disabled={saving || isFetchingGoogle}
                    style={{
                      marginLeft: 'auto',
                      padding: '6px 12px',
                      background: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      color: '#374151',
                      fontWeight: '500',
                      fontSize: '13px',
                      cursor: (saving || isFetchingGoogle) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      alignSelf: 'center',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F9FAFB';
                      e.currentTarget.style.borderColor = '#D1D5DB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#E5E7EB';
                    }}
                    title="Import profile picture from your Google account"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    {isFetchingGoogle ? 'Fetching...' : 'Fetch from Google'}
                  </button>
                )}
              </div>

              {/* Modal Body with smooth height transition */}
              <div 
                style={{
                  height: avatarBodyHeight !== undefined ? `${avatarBodyHeight}px` : 'auto',
                  transition: enableAvatarTransition ? 'height 0.28s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                  overflow: 'hidden',
                  flexShrink: 0,
                  maxHeight: 'calc(90vh - 170px)',
                  overflowY: 'auto',
                  willChange: enableAvatarTransition ? 'height' : 'auto'
                }}
              >
                <div ref={avatarModalBodyRef} style={{ padding: '24px' }}>
                  {avatarTab === 'preset' ? (
                    <div key="tab-preset" style={{ animation: 'tabContentIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '16px',
                        justifyItems: 'center'
                      }}>
                        {AVAILABLE_AVATARS.map((pic) => {
                          const isSelected = selectedPresetUrl === pic.url;
                          return (
                            <div
                              key={pic.id}
                              onClick={() => setSelectedPresetUrl(isSelected ? '' : pic.url)}
                              style={{
                                position: 'relative',
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                border: isSelected ? '2px solid #111827' : '1px solid #E5E7EB',
                                backgroundColor: '#FFFFFF',
                                boxSizing: 'border-box',
                                padding: '3px',
                                transition: 'all 0.18s ease',
                                transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                                boxShadow: 'none'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.borderColor = '#9CA3AF';
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.borderColor = '#E5E7EB';
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }
                              }}
                            >
                              <img
                                src={pic.url}
                                alt={pic.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                              />
                              {isSelected && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '-2px',
                                  right: '-2px',
                                  backgroundColor: '#111827',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '22px',
                                  height: '22px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: 'none',
                                  border: '2px solid #FFFFFF'
                                }}>
                                  <Check size={13} strokeWidth={3} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div key="tab-upload" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'tabContentIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                      <div
                        onClick={() => modalFileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        style={{
                          width: '100%',
                          border: '2px dashed #D1D5DB',
                          borderRadius: '12px',
                          padding: '36px 20px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          backgroundColor: '#F9FAFB',
                          transition: 'border-color 0.2s, background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#111827';
                          e.currentTarget.style.backgroundColor = '#F3F4F6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#D1D5DB';
                          e.currentTarget.style.backgroundColor = '#F9FAFB';
                        }}
                      >
                        {uploadFile && uploadPreview ? (
                          (uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf')) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '72px',
                                height: '72px',
                                borderRadius: '16px',
                                backgroundColor: '#FEE2E2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#DC2626',
                                boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.1)'
                              }}>
                                <FileText size={38} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', maxWidth: '90%' }}>
                                <p style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '600', color: '#111827', wordBreak: 'break-all', textAlign: 'center' }}>
                                  {uploadFile.name}
                                </p>
                                <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                  PDF Document • {(uploadFile.size / 1024).toFixed(1)} KB
                                </span>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (uploadPreview) window.open(uploadPreview, '_blank');
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      backgroundColor: '#FFFFFF',
                                      border: '1px solid #D1D5DB',
                                      color: '#111827',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <ExternalLink size={13} /> View PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (modalFileInputRef.current) {
                                        modalFileInputRef.current.value = '';
                                        modalFileInputRef.current.click();
                                      }
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      backgroundColor: '#111827',
                                      border: '1px solid #111827',
                                      color: '#FFFFFF',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <RefreshCw size={12} /> Replace File
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                              <img
                                src={uploadPreview}
                                alt="Selected preview"
                                style={{
                                  width: '96px',
                                  height: '96px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '3px solid #111827',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <p style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                                  {uploadFile.name}
                                </p>
                                <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                  Image • {(uploadFile.size / 1024).toFixed(1)} KB
                                </span>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCropImageSrc(uploadPreview);
                                      setCrop({ x: 0, y: 0 });
                                      setZoom(0.7);
                                      setRotation(0);
                                      setIsCropping(true);
                                    }}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      backgroundColor: '#111827',
                                      border: '1px solid #111827',
                                      color: '#FFFFFF',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#374151')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111827')}
                                  >
                                    <Crop size={14} /> Crop & Rotate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (modalFileInputRef.current) {
                                        modalFileInputRef.current.value = '';
                                        modalFileInputRef.current.click();
                                      }
                                    }}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      backgroundColor: '#FFFFFF',
                                      border: '1px solid #D1D5DB',
                                      color: '#374151',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                                  >
                                    <RefreshCw size={12} /> Replace
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '50%',
                              backgroundColor: '#E5E7EB',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#4B5563'
                            }}>
                              <Upload size={22} />
                            </div>
                            <div>
                              <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                                Click to upload or drag and drop
                              </p>
                              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                                PNG, JPG, JPEG, WEBP, GIF or PDF (max 10MB)
                              </p>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={modalFileInputRef}
                          onChange={handleModalFileSelect}
                          accept="image/*,application/pdf,.pdf"
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderTop: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-hover)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Preview:</span>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: '#E5E7EB',
                    border: '1px solid #D1D5DB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {avatarTab === 'upload' ? (
                      uploadFile && (uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf')) ? (
                        <div style={{ width: '100%', height: '100%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={18} color="#DC2626" />
                        </div>
                      ) : uploadPreview ? (
                        <img
                          src={uploadPreview}
                          alt="Preview"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : avatarUrl && isPdfUrl(avatarUrl, documentType, documentName) ? (
                        <div style={{ width: '100%', height: '100%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={18} color="#DC2626" />
                        </div>
                      ) : avatarUrl && !imageLoadError ? (
                        <img
                          src={avatarUrl}
                          alt="Preview"
                          referrerPolicy="no-referrer"
                          onError={() => setImageLoadError(true)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          {getFirstLetterOfFirstName(displayName || fullName, user?.email)}
                        </span>
                      )
                    ) : (
                      selectedPresetUrl ? (
                        <img
                          src={selectedPresetUrl}
                          alt="Preview"
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : avatarUrl && isPdfUrl(avatarUrl, documentType, documentName) ? (
                        <div style={{ width: '100%', height: '100%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={18} color="#DC2626" />
                        </div>
                      ) : avatarUrl && !imageLoadError ? (
                        <img
                          src={avatarUrl}
                          alt="Preview"
                          referrerPolicy="no-referrer"
                          onError={() => setImageLoadError(true)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          {getFirstLetterOfFirstName(displayName || fullName, user?.email)}
                        </span>
                      )
                    )}
                  </div>

                  {(avatarUrl || uploadFile || (avatarTab === 'preset' && selectedPresetUrl)) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (saving) return;
                        if (uploadFile) {
                          handleClearSelectedFile();
                        } else if (avatarTab === 'preset' && selectedPresetUrl) {
                          setSelectedPresetUrl('');
                        } else if (avatarUrl) {
                          handleRemoveAvatar();
                        }
                      }}
                      disabled={saving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #FCA5A5',
                        color: '#DC2626',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        marginLeft: '8px',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                      onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                    >
                      <Trash2 size={13} /> {
                        (uploadFile && (uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf'))) || (!uploadFile && isPdfUrl(avatarUrl, documentType, documentName))
                          ? 'Remove Document'
                          : 'Remove Picture'
                      }
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={closeAvatarModal}
                    disabled={saving}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#FFFFFF',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAvatar}
                    disabled={saving || (avatarTab === 'upload' ? !uploadFile : !selectedPresetUrl)}
                    style={{
                      padding: '9px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: (saving || (avatarTab === 'upload' ? !uploadFile : !selectedPresetUrl)) ? '#9CA3AF' : '#111827',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: (saving || (avatarTab === 'upload' ? !uploadFile : !selectedPresetUrl)) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {saving ? (
                      <>
                        <div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                        Saving...
                      </>
                    ) : (
                      avatarTab === 'upload' && ((uploadFile && (uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf'))) || (!uploadFile && uploadPreview && isPdfUrl(uploadPreview, documentType, documentName)))
                        ? 'Save Document'
                        : 'Save Picture'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          <style>{`
            @keyframes fadeInBackdrop {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes fadeOutBackdrop {
              from { opacity: 1; }
              to { opacity: 0; }
            }
            @keyframes scaleInModal {
              from { opacity: 0; transform: scale(0.95) translateY(10px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes scaleOutModal {
              from { opacity: 1; transform: scale(1) translateY(0); }
              to { opacity: 0; transform: scale(0.95) translateY(10px); }
            }
            @keyframes cropViewIn {
              from { opacity: 0; transform: scale(0.96) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes mainViewIn {
              from { opacity: 0; transform: scale(0.96) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes tabContentIn {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SettingsView;
