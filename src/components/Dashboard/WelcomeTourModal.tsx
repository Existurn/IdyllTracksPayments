import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Upload, 
  Trash2, 
  Camera, 
  Search, 
  ChevronDown, 
  Sparkles,
  CheckCircle2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Grid,
  UserCheck,
  CreditCard,
  FileText
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropImage';
import { supabase } from '../../lib/supabaseClient';
import { useRBAC } from '../../contexts/RBACContext';
import { getFirstLetterOfFirstName, getGoogleAvatarUrl, isGoogleAccount } from '../../utils/avatarHelper';
import { COUNTRIES, type Country } from '../../utils/countries';
import confetti from 'canvas-confetti';
import styles from './WelcomeTourModal.module.css';

const BUNNY_CDN_EMBED_URL = 'https://player.mediadelivery.net/play/644758/71b0d8a0-c6ea-46ee-944b-f3b5382f1ec7';

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

const playCelebrationSound = () => {
  try {
    // 1. Play soft, satisfying pop sound (volume 0.25 - gentle & low)
    const audio = new Audio('/macos-sound-fx-pop.wav');
    audio.volume = 0.25;
    audio.play().catch(() => {});

    // 2. Play gentle celebratory sparkle chime via Web Audio API (low volume)
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      // Staggered celebration chime chord (C5 - E5 - G5 - C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + 0.03 + idx * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.08, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.55);
      });
    }
  } catch (e) {
    console.warn('Celebration sound effect error:', e);
  }
};

const triggerConfettiBlast = () => {
  try {
    const brandColors = ['#FF6600', '#FF8533', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6'];
    
    // Cannon 1: Left bottom angled towards center
    confetti({
      particleCount: 100,
      angle: 60,
      spread: 55,
      startVelocity: 75,
      origin: { x: 0.1, y: 1.0 },
      colors: brandColors,
      zIndex: 999999,
      disableForReducedMotion: true
    });

    // Cannon 2: Right bottom angled towards center
    confetti({
      particleCount: 100,
      angle: 120,
      spread: 55,
      startVelocity: 75,
      origin: { x: 0.9, y: 1.0 },
      colors: brandColors,
      zIndex: 999999,
      disableForReducedMotion: true
    });

    // Cannon 3: Center bottom mega-blast
    confetti({
      particleCount: 160,
      spread: 100,
      startVelocity: 85,
      origin: { x: 0.5, y: 1.0 },
      colors: brandColors,
      zIndex: 999999,
      disableForReducedMotion: true
    });

    // Staggered follow-up burst 200ms later to create a continuous raining confetti canopy
    setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 120,
        startVelocity: 65,
        origin: { x: 0.5, y: 1.0 },
        colors: brandColors,
        zIndex: 999999,
        disableForReducedMotion: true
      });
    }, 200);
  } catch (confettiErr) {
    console.warn('Confetti launch error:', confettiErr);
  }
};

interface WelcomeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WelcomeTourModal: React.FC<WelcomeTourModalProps> = ({ isOpen, onClose }) => {
  const { updateProfile, addUser } = useRBAC();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Profile data states
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [googleAvatarUrl, setGoogleAvatarUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // default India
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cropping Tool States
  const [isCropping, setIsCropping] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Avatar Browser State with swipe-slide transition
  const [isBrowsingAvatars, setIsBrowsingAvatars] = useState(false);
  const [isExitingAvatarBrowser, setIsExitingAvatarBrowser] = useState(false);

  const openAvatarBrowser = () => {
    setIsBrowsingAvatars(true);
    setIsExitingAvatarBrowser(false);
  };

  const closeAvatarBrowser = () => {
    setIsExitingAvatarBrowser(true);
    setTimeout(() => {
      setIsBrowsingAvatars(false);
      setIsExitingAvatarBrowser(false);
    }, 220);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const introVideoRef = useRef<HTMLVideoElement>(null);

  // Handle intro video playback and muting
  useEffect(() => {
    if (introVideoRef.current) {
      introVideoRef.current.muted = true;
      if (step === 1) {
        introVideoRef.current.play().catch(() => {});
      } else {
        introVideoRef.current.pause();
      }
    }
  }, [step]);

  // Initialize data on mount/open
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';
    setStep(1);
    setSlideDirection('forward');
    setIsCropping(false);
    setIsBrowsingAvatars(false);

    const initUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);

          let metaName = user.user_metadata?.full_name || '';
          if (!metaName && user.email) {
            const parts = user.email.split('@')[0].split(/[._-]/);
            metaName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          }

          let metaLegalName = user.user_metadata?.legal_full_name || metaName || '';
          let metaMobile = user.user_metadata?.mobile_number || '';
          let metaAvatar = user.user_metadata?.avatar_url || '';

          const isGoogle = isGoogleAccount(user);
          const gPfp = isGoogle ? getGoogleAvatarUrl(user) : '';
          setGoogleAvatarUrl(gPfp);

          if (!metaAvatar && gPfp) {
            metaAvatar = gPfp;
          }

          // Initial country detection if saved in metadata
          if (user.user_metadata?.country) {
            const found = COUNTRIES.find(
              c => c.name.toLowerCase() === user.user_metadata.country.toLowerCase() ||
                   c.code.toLowerCase() === (user.user_metadata.country_code || '').toLowerCase()
            );
            if (found) setSelectedCountry(found);
          }

          setDisplayName(metaName);
          setFullName(metaLegalName);
          setMobileNumber(metaMobile);
          setAvatarUrl(metaAvatar);
        }
      } catch (err) {
        console.error('Error reading auth user for starting modal:', err);
      }
    };

    initUserData();

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close country dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setIsCountryOpen(false);
      }
    };
    if (isCountryOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isCountryOpen]);

  // Filter countries by query
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase().trim();
    return COUNTRIES.filter(
      c => c.name.toLowerCase().includes(q) ||
           c.code.toLowerCase().includes(q) ||
           c.dialCode.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const onCropComplete = useCallback((_croppedArea: any, pixelCrop: any) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  if (!isOpen) return null;

  const handleSelectPreset = (url: string) => {
    setUploadFile(null);
    setAvatarUrl(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Please select an image smaller than 10MB' }));
      return;
    }

    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!isImage) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Please select a valid image (PNG, JPG, WEBP, GIF)' }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setIsCropping(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveCroppedImage = async () => {
    if (!cropImageSrc || !croppedAreaPixels) {
      setIsCropping(false);
      return;
    }

    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels, rotation);
      if (croppedBlob) {
        const croppedUrl = URL.createObjectURL(croppedBlob);
        const croppedFile = new File([croppedBlob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setUploadFile(croppedFile);
        setAvatarUrl(croppedUrl);
      }
    } catch (err) {
      console.error('Error cropping image:', err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Error cropping image' }));
    } finally {
      setIsCropping(false);
    }
  };

  const handleRemoveAvatar = () => {
    setUploadFile(null);
    setAvatarUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const goToStep = (targetStep: 1 | 2 | 3 | 4) => {
    setSlideDirection(targetStep > step ? 'forward' : 'backward');
    setStep(targetStep);
  };

  const handleStep3Next = () => {
    if (!displayName.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Display Name is required' }));
      return;
    }
    if (!fullName.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Full Legal Name is required' }));
      return;
    }
    if (!selectedCountry) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Please select your country' }));
      return;
    }
    goToStep(4);
  };

  const handleFinish = async () => {
    if (!displayName.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Display Name is required' }));
      return;
    }
    if (!fullName.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Full Legal Name is required' }));
      return;
    }
    if (!selectedCountry) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Please select your country' }));
      return;
    }

    // 0ms Instant Celebration: Sound + Confetti fire immediately when clicked
    playCelebrationSound();
    triggerConfettiBlast();

    // Mark completion in localStorage immediately so UI will never bounce back to /profile
    try {
      localStorage.setItem('has_seen_welcome_tour', 'true');
      localStorage.setItem('has_completed_profile_setup', 'true');
    } catch (_) {}

    setSaving(true);
    const startTime = Date.now();
    try {
      let finalAvatarUrl = avatarUrl;

      // If local file was cropped/uploaded, persist to Supabase storage
      if (uploadFile && currentUser?.id) {
        const fileExt = uploadFile.name.split('.').pop() || 'jpg';
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, uploadFile, { upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          finalAvatarUrl = publicUrl;
        }
      }

      // 1. Update Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: displayName.trim(),
          legal_full_name: fullName.trim(),
          mobile_number: mobileNumber.trim(),
          country: selectedCountry.name,
          country_code: selectedCountry.code,
          avatar_url: finalAvatarUrl,
          profile_setup_completed: true
        }
      });
      if (authError) throw authError;

      // 2. Ensure user exists and is up-to-date in public.user_roles table
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const targetUserId = authUser?.id || currentUser?.id;
      const targetEmail = authUser?.email || currentUser?.email || '';
      
      if (targetUserId) {
        const isRootAdmin = targetEmail.trim().toLowerCase() === 'harshidyllproductions@gmail.com';
        const finalStatus = 'Approved';
        const validRoles = ['CEO', 'CFO', 'Manager', 'Editor', 'Client'];
        const existingRole = (currentUser?.role && validRoles.includes(currentUser.role)) ? currentUser.role : 'Editor';
        const roleToAssign = isRootAdmin ? 'CEO' : existingRole;

        await addUser({
          id: targetUserId,
          name: displayName.trim() || targetEmail || 'User',
          displayName: displayName.trim(),
          fullName: fullName.trim(),
          email: targetEmail,
          role: roleToAssign as any,
          status: finalStatus,
          overrides: currentUser?.overrides || {},
          avatarUrl: finalAvatarUrl || undefined,
          requestDate: currentUser?.requestDate || new Date().toISOString()
        });

        // Also ensure full_name, avatar_url, and status are updated in database
        await supabase.from('user_roles').update({
          name: displayName.trim(),
          full_name: fullName.trim(),
          avatar_url: finalAvatarUrl || null,
          status: finalStatus
        }).eq('id', targetUserId);

        if (updateProfile) {
          await updateProfile({
            displayName: displayName.trim(),
            fullName: fullName.trim(),
            name: displayName.trim(),
            avatarUrl: finalAvatarUrl || undefined
          });
        }
      }

      // 3. Dispatch events to refresh dashboard & header
      window.dispatchEvent(new Event('profile-updated'));
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Profile setup complete! Welcome to Idyll Tracks.' }));

      // 4. Smoothly close modal after user enjoys the confetti launch
      const elapsed = Date.now() - startTime;
      const delayRemaining = Math.max(0, 800 - elapsed);
      setTimeout(() => {
        onClose();
      }, delayRemaining);
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: err?.message || 'Error saving profile setup' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        
        {/* =========================================================
            Crop & Rotate View (Overlay inside same modal dimensions)
            ========================================================= */}
        {isCropping && cropImageSrc ? (
          <div className={styles.cropContainer}>
            {/* Header */}
            <div className={styles.cropHeader}>
              <button
                type="button"
                className={styles.cropBackBtn}
                onClick={() => setIsCropping(false)}
                title="Back to avatars"
              >
                <ArrowLeft size={18} />
              </button>
              <h3 className={styles.cropTitle}>Crop and rotate</h3>
              <div style={{ width: '32px' }} />
            </div>

            {/* Cropper Area with White Corner Brackets */}
            <div className={styles.cropAreaWrapper}>
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                cropSize={{ width: 250, height: 250 }}
                minZoom={0.2}
                maxZoom={3}
                restrictPosition={false}
                zoomSpeed={0.5}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: { backgroundColor: '#131314' },
                  cropAreaStyle: { border: '1px solid rgba(255, 255, 255, 0.25)' }
                }}
              />

              {/* 4 Corner White Brackets */}
              <div className={styles.cropCornerBrackets}>
                <div className={styles.bracketTopLeft} />
                <div className={styles.bracketTopRight} />
                <div className={styles.bracketBottomLeft} />
                <div className={styles.bracketBottomRight} />
              </div>
            </div>

            {/* Controls: Rotate, Zoom Slider, Save Button */}
            <div className={styles.cropControls}>
              {/* Rotate Button */}
              <button
                type="button"
                className={styles.cropRotateBtn}
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw size={17} />
                <span className={styles.cropRotateText}>Rotate</span>
              </button>

              {/* Zoom Control Slider */}
              <div className={styles.cropZoomRow}>
                <button
                  type="button"
                  className={styles.cropZoomBtn}
                  onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <input
                  type="range"
                  min={0.2}
                  max={3}
                  step={0.02}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className={styles.cropZoomSlider}
                />
                <button
                  type="button"
                  className={styles.cropZoomBtn}
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
              </div>

              {/* Save Picture */}
              <button
                type="button"
                className={styles.cropSaveBtn}
                onClick={handleSaveCroppedImage}
              >
                Save Picture
              </button>
            </div>
          </div>
        ) : null}

        {/* =========================================================
            Avatar Browser Overlay (Opens all 16 avatars seamlessly)
            ========================================================= */}
        {isBrowsingAvatars ? (
          <div className={`${styles.avatarBrowserOverlay} ${isExitingAvatarBrowser ? styles.browserSlideOut : styles.browserSlideIn}`}>
            {/* Header */}
            <div className={styles.avatarBrowserHeader}>
              <button
                type="button"
                className={styles.avatarBrowserBackBtn}
                onClick={closeAvatarBrowser}
                title="Back to profile"
              >
                <ArrowLeft size={18} />
              </button>
              <div className={styles.avatarBrowserTitleGroup}>
                <h3 className={styles.avatarBrowserTitle}>Choose an Avatar</h3>
                <p className={styles.avatarBrowserSubtitle}>Select from all 16 available illustrated avatars</p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeAvatarBrowser}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Selected Avatar Preview Strip */}
            <div className={styles.avatarBrowserCurrentPreview}>
              <span className={styles.avatarBrowserPreviewLabel}>Selected:</span>
              <div className={styles.avatarBrowserPreviewCircle}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Selected" className={styles.mainAvatarImg} />
                ) : (
                  getFirstLetterOfFirstName(displayName, currentUser?.email || 'User')
                )}
              </div>
              <span className={styles.avatarBrowserSelectedName}>
                {AVAILABLE_AVATARS.find(a => a.url === avatarUrl)?.name || (avatarUrl ? 'Custom Image' : 'None Selected')}
              </span>
            </div>

            {/* 4x4 Grid of All 16 Avatars */}
            <div className={styles.avatarBrowserGrid}>
              {AVAILABLE_AVATARS.map((avatar) => {
                const isSelected = avatarUrl === avatar.url;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    className={`${styles.browserAvatarThumb} ${isSelected ? styles.browserAvatarThumbActive : ''}`}
                    onClick={() => handleSelectPreset(avatar.url)}
                    title={avatar.name}
                  >
                    <img 
                      src={avatar.url} 
                      alt={avatar.name} 
                      className={styles.browserAvatarImg} 
                    />
                    {isSelected && (
                      <div className={styles.presetCheckmarkBadge}>
                        <Check size={11} color="#FFFFFF" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className={styles.avatarBrowserFooter}>
              <button
                type="button"
                className={styles.avatarBrowserCancelBtn}
                onClick={closeAvatarBrowser}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.avatarBrowserDoneBtn}
                onClick={closeAvatarBrowser}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}

        {/* Header */}
        <div className={styles.modalHeader}>
          {/* Animated Top Progress Bar Line */}
          <div className={styles.progressBarTrack}>
            <div 
              className={styles.progressBarFill} 
              style={{ width: `${(step / 4) * 100}%` }} 
            />
          </div>

          <div className={styles.headerLeft}>
            <img 
              src="/idyll_track_logo.svg" 
              alt="Idyll Tracks Payments" 
              className={styles.logo} 
            />
            <h2 className={styles.modalTitle}>Welcome to Idyll Tracks Payments</h2>
          </div>

          <div className={styles.headerRight}>
            {/* Animated Line of Dots (No text or numbers) */}
            <div className={styles.dotsLineContainer}>
              <div className={styles.dotsLineTrack}>
                <div 
                  className={styles.dotsLineProgress} 
                  style={{ width: `${((step - 1) / 3) * 100}%` }} 
                />
              </div>
              {[1, 2, 3, 4].map((s) => {
                const isCompleted = s < step;
                const isActive = s === step;
                return (
                  <div
                    key={s}
                    className={`${styles.animatedDot} ${isActive ? styles.animatedDotActive : ''} ${isCompleted ? styles.animatedDotCompleted : ''}`}
                    onClick={() => {
                      if (s < step) {
                        goToStep(s as 1 | 2 | 3 | 4);
                      }
                    }}
                    title={['Welcome Intro', 'Profile Picture', 'Account Details', 'Walkthrough Tutorial'][s - 1]}
                  >
                    {isActive && <div className={styles.dotPulseRing} />}
                    <div className={styles.dotCore} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Body with smooth directional animations */}
        <div className={styles.modalBody}>
          {/* =========================================================
              Step 1: Onboarding Intro Video (On Boarding Intro.mp4)
              ========================================================= */}
          {step === 1 && (
            <div 
              key="step-1"
              className={`${styles.stepSlide} ${slideDirection === 'backward' ? styles.slideBackward : styles.slideForward}`}
            >
              <div className={styles.stepHeader} style={{ marginTop: '16px', marginBottom: '8px' }}>
                <p className={styles.stepSubtitle}>
                  Welcome aboard! Watch this quick intro to get started with your account.
                </p>
              </div>

              {/* Local Onboarding Intro Video Player (Vertically centered, muted, looping, no controls) */}
              <div className={styles.centeredVideoContainer}>
                <div 
                  className={styles.mediaFrame}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <video
                    ref={introVideoRef}
                    src="/onboarding-intro.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    disablePictureInPicture
                    controlsList="nodownload nofullscreen noremoteplayback"
                    onContextMenu={(e) => e.preventDefault()}
                    className={styles.videoPlayer}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              Step 2: Profile Picture (Centered avatar, crop, browse 16)
              ========================================================= */}
          {step === 2 && (
            <div 
              key="step-2"
              className={`${styles.stepSlide} ${slideDirection === 'backward' ? styles.slideBackward : styles.slideForward}`}
            >
              <div className={styles.stepHeader}>
                <h3 className={styles.stepTitle}>Set Up Your Profile Picture</h3>
                <p className={styles.stepSubtitle}>
                  Choose an avatar or upload and crop your photo so team and clients can recognize you.
                </p>
              </div>

              {/* Centered Main Profile Picture Section */}
              <div className={styles.centeredAvatarContainer}>
                {/* Big Centered Avatar Circle with Camera Badge */}
                <div 
                  className={styles.mainAvatarWrapper}
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to upload and crop photo"
                >
                  <div className={styles.mainAvatarCircle}>
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt="Selected Profile" 
                        className={styles.mainAvatarImg}
                        onError={() => setAvatarUrl('')}
                      />
                    ) : (
                      <span className={styles.mainAvatarInitials}>
                        {getFirstLetterOfFirstName(displayName, currentUser?.email || 'User')}
                      </span>
                    )}
                  </div>
                  
                  {/* Camera / Edit Badge */}
                  <div className={styles.avatarCameraBadge} title="Upload photo">
                    <Camera size={15} color="#FFFFFF" />
                  </div>
                </div>

                {/* Centered Action Buttons Row: Upload & Browse */}
                <div className={styles.avatarActionsRow}>
                  <button 
                    type="button"
                    className={styles.uploadPhotoBtn}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    <span>Upload & Crop</span>
                  </button>

                  <button 
                    type="button"
                    className={styles.browseAvatarsBtn}
                    onClick={openAvatarBrowser}
                  >
                    <Grid size={14} />
                    <span>Browse Avatars</span>
                    <span className={styles.avatarCountPill}>16</span>
                  </button>
                </div>

                {/* Secondary Actions (Google Photo, Remove Picture) */}
                <div className={styles.avatarSecondaryActions}>
                  {googleAvatarUrl && avatarUrl !== googleAvatarUrl && (
                    <button 
                      type="button"
                      className={styles.googlePhotoBtn}
                      onClick={() => {
                        setUploadFile(null);
                        setAvatarUrl(googleAvatarUrl);
                      }}
                    >
                      <Sparkles size={12} />
                      <span>Use Google Photo</span>
                    </button>
                  )}

                  {avatarUrl && (
                    <button 
                      type="button"
                      className={styles.removePhotoBtn}
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 size={12} />
                      <span>Remove Picture</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Hidden File Picker Input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/png,image/jpeg,image/webp,image/jpg" 
                style={{ display: 'none' }} 
              />
            </div>
          )}

          {/* =========================================================
              Step 3: Account Details ("name and all")
              ========================================================= */}
          {step === 3 && (
            <div 
              key="step-3"
              className={`${styles.stepSlide} ${slideDirection === 'backward' ? styles.slideBackward : styles.slideForward}`}
            >
              <div className={styles.stepHeader}>
                <h3 className={styles.stepTitle}>Your Account Details</h3>
                <p className={styles.stepSubtitle}>
                  Please fill in your details to set up your profile and invoices.
                </p>
              </div>

              {/* Step 3 Inputs */}
              <div className={styles.formSection}>
                {/* Display Name */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Display Name <span className={styles.requiredAsterisk}>*</span>
                  </label>
                  <input 
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How you'd like your name to be displayed"
                    className={styles.formInput}
                    autoFocus
                  />
                </div>

                {/* Full Legal Name */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Full Legal Name <span className={styles.requiredAsterisk}>*</span>
                  </label>
                  <input 
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Official name matching bank / ID records"
                    className={styles.formInput}
                  />
                </div>

                {/* Mobile Number */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Mobile Number <span className={styles.optionalTag}>(Optional)</span>
                  </label>
                  <input 
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className={styles.formInput}
                  />
                </div>

                {/* Custom Searchable Country Dropdown */}
                <div className={styles.formGroup} ref={countryDropdownRef}>
                  <label className={styles.formLabel}>
                    Country <span className={styles.requiredAsterisk}>*</span>
                  </label>

                  <div 
                    className={`${styles.countryTrigger} ${isCountryOpen ? styles.countryTriggerActive : ''}`}
                    onClick={() => {
                      setIsCountryOpen(!isCountryOpen);
                      setCountrySearch('');
                    }}
                  >
                    <div className={styles.countryTriggerLeft}>
                      <span className={styles.countryFlag}>{selectedCountry.flag}</span>
                      <span>{selectedCountry.name}</span>
                      <span className={styles.countryDialCode}>({selectedCountry.dialCode})</span>
                    </div>
                    <ChevronDown size={14} color="#6B7280" />
                  </div>

                  {isCountryOpen && (
                    <div className={styles.countryDropdown}>
                      {/* Search Box */}
                      <div className={styles.countrySearchBox}>
                        <Search size={14} color="#9CA3AF" />
                        <input 
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country or code..."
                          className={styles.countrySearchInput}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Filtered Country List */}
                      <div className={styles.countryList}>
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((country) => {
                            const isSelected = selectedCountry.code === country.code;
                            return (
                              <div
                                key={country.code}
                                className={`${styles.countryOption} ${isSelected ? styles.countryOptionSelected : ''}`}
                                onClick={() => {
                                  setSelectedCountry(country);
                                  setIsCountryOpen(false);
                                  setCountrySearch('');
                                }}
                              >
                                <div className={styles.countryOptionLeft}>
                                  <span className={styles.countryFlag}>{country.flag}</span>
                                  <span>{country.name}</span>
                                  <span className={styles.countryDialCode}>{country.dialCode}</span>
                                </div>
                                {isSelected && (
                                  <Check size={14} color="var(--text-primary, #111827)" />
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className={styles.noResultsText}>
                            No countries found matching "{countrySearch}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              Step 4: Quick Walkthrough Video (Platform Tutorial)
              ========================================================= */}
          {step === 4 && (
            <div 
              key="step-4"
              className={`${styles.stepSlide} ${slideDirection === 'backward' ? styles.slideBackward : styles.slideForward}`}
            >
              <div className={styles.stepHeader}>
                <h3 className={styles.stepTitle}>Quick Platform Walkthrough</h3>
                <p className={styles.stepSubtitle}>
                  Watch this quick walkthrough video to understand how your dashboard, payments, and invoices work.
                </p>
              </div>

              {/* Walkthrough Video Player Frame */}
              <div className={styles.centeredVideoContainer}>
                <div className={styles.mediaFrame}>
                  <iframe
                    src={BUNNY_CDN_EMBED_URL}
                    loading="lazy"
                    className={styles.videoIframe}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                    title="Idyll Tracks Payments Walkthrough"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.footerLeft}>
            {step === 1 ? (
              <button 
                type="button" 
                className={styles.skipBtn}
                onClick={() => goToStep(2)}
              >
                Skip Intro
              </button>
            ) : (
              <button 
                type="button" 
                className={styles.backBtn}
                onClick={() => goToStep((step - 1) as 1 | 2 | 3 | 4)}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className={styles.footerRight}>
            {step === 1 && (
              <button 
                type="button" 
                className={styles.primaryBtn}
                onClick={() => goToStep(2)}
              >
                <span>Profile Picture</span>
                <ArrowRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button 
                type="button" 
                className={styles.primaryBtn}
                onClick={() => goToStep(3)}
              >
                <span>Account Details</span>
                <ArrowRight size={14} />
              </button>
            )}

            {step === 3 && (
              <button 
                type="button" 
                className={styles.primaryBtn}
                onClick={handleStep3Next}
              >
                <span>Walkthrough Video</span>
                <ArrowRight size={14} />
              </button>
            )}

            {step === 4 && (
              <button 
                type="button" 
                className={styles.primaryBtn}
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Complete Setup</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeTourModal;
