import React, { useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import aadhaarLogo from '../../assets/Aadhaar.svg';
import styles from './AadhaarUpload.module.css';

interface AadhaarUploadProps {
  file: File | null;
  existingDocument?: {
    name: string;
    type: string;
    size?: number;
    url?: string;
  } | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export const AadhaarUpload: React.FC<AadhaarUploadProps> = ({
  file,
  existingDocument,
  onFileChange,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Accepted formats: PDF, JPG, JPEG, PNG
  const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  const MAX_SIZE_MB = 10;

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);

    // Format validation
    const fileType = selectedFile.type.toLowerCase();
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
    const isValidFormat = 
      ACCEPTED_TYPES.includes(fileType) || 
      ['pdf', 'jpg', 'jpeg', 'png'].includes(fileExt || '');

    if (!isValidFormat) {
      setError('Invalid format. Only PDF, JPG/JPEG, and PNG files are accepted.');
      return;
    }

    // Size validation
    if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_SIZE_MB}MB limit.`);
      return;
    }

    onFileChange(selectedFile);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRemove = () => {
    if (disabled) return;
    onFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTriggerUpload = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatLabel = (type?: string, name?: string) => {
    if (type?.includes('pdf') || name?.toLowerCase().endsWith('.pdf')) return 'PDF Document';
    if (type?.includes('png') || name?.toLowerCase().endsWith('.png')) return 'PNG Image';
    return 'JPEG Image';
  };

  const hasDocument = file || existingDocument;
  const displayDocName = file ? file.name : existingDocument?.name;
  const displayDocType = getFormatLabel(file?.type || existingDocument?.type, displayDocName);
  const displayDocSize = formatFileSize(file?.size || existingDocument?.size);
  const isPdf = displayDocType.includes('PDF');

  return (
    <div className={styles.uploadContainer}>
      <div className={styles.labelRow}>
        <label className={styles.label}>
          Upload Aadhaar Card
          <span className={styles.requiredTag}>*</span>
        </label>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {!hasDocument ? (
        <div 
          className={`${styles.dropzone} ${disabled ? styles.dropzoneDisabled : ''}`}
          onClick={handleTriggerUpload}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          role="button"
          tabIndex={disabled ? -1 : 0}
        >
          <div className={styles.uploadIconWrapper}>
            <Upload size={20} strokeWidth={2} />
          </div>
          <div className={styles.primaryText}>
            Click to upload or <span className={styles.browseLink}>browse</span>
          </div>
          <div className={styles.formatText}>
            Accepted formats: PDF, JPG/JPEG, PNG (Max 10MB)
          </div>
        </div>
      ) : (
        <div className={styles.fileCard}>
          <div className={styles.fileInfo}>
            <div className={styles.fileIconWrapper}>
              <img src={aadhaarLogo} alt="Aadhaar" className={styles.aadhaarLogo} />
            </div>
            <div className={styles.fileMeta}>
              <span className={styles.fileName} title={displayDocName}>
                {displayDocName}
              </span>
              <span className={styles.fileSubtext}>
                {displayDocType} {displayDocSize ? `• ${displayDocSize}` : ''}
              </span>
            </div>
          </div>

          {!disabled && (
            <div className={styles.fileActions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={handleTriggerUpload}
                title="Replace Document"
              >
                <RefreshCw size={13} />
                Replace
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.removeBtn}`}
                onClick={handleRemove}
                title="Remove Document"
              >
                <Trash2 size={13} />
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Mandatory Regulatory & Informational Note */}
      <div className={styles.noticeUnderneath}>
        You must fill in your Aadhaar information and upload a copy of your Aadhaar card. The information you enter will be used for automated Aadhaar verification, while the uploaded document will be used for manual verification when required. This is a one-time process. We may ask you to complete Aadhaar verification when required. Verification usually takes 1 to 2 days.
      </div>
    </div>
  );
};
