import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  X, 
  Check,
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Search, 
  Mail, 
  Info,
  ExternalLink,
  ChevronRight,
  Inbox,
  List,
  PenLine
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useRBAC } from '../../contexts/RBACContext';
import { showToast } from '../../utils/notifications';
import { 
  sendCustomComposeEmail, 
  fetchResendEmailStatus, 
  type CustomComposeAttachment 
} from '../../utils/emailService';
import DancingDotsLoader from '../common/DancingDotsLoader';
import styles from './ComposeView.module.css';

export interface EmailHistoryItem {
  id: string;
  resend_id?: string;
  recipient: string;
  subject: string;
  body_snippet: string;
  sender_email?: string;
  sender_name?: string;
  attachment_count: number;
  attachment_names: string[];
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  error_message?: string;
  created_at: string;
}

const STORAGE_KEY = 'itp_email_send_history';

export const ComposeView: React.FC = () => {
  const { currentUser } = useRBAC();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Tab: 'compose' | 'history'
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  // Form State
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<CustomComposeAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Send status feedback
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<EmailHistoryItem[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'sent' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<EmailHistoryItem | null>(null);

  // Sync with Supabase (if table exists) + localStorage
  useEffect(() => {
    const loadSupabaseHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('email_send_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && data && data.length > 0) {
          setHistory(data as EmailHistoryItem[]);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      } catch {
        // Table may not exist yet, fallback to localStorage
      }
    };

    loadSupabaseHistory();
  }, []);

  const saveHistoryItem = async (newItem: EmailHistoryItem) => {
    // 1. Update React state & localStorage
    setHistory(prev => {
      const updated = [newItem, ...prev.filter(i => i.id !== newItem.id)];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not save email history to localStorage:', err);
      }
      return updated;
    });

    // 2. Dual layer: sync to Supabase table if it exists
    try {
      await supabase.from('email_send_history').insert({
        id: newItem.id,
        resend_id: newItem.resend_id,
        recipient: newItem.recipient,
        subject: newItem.subject,
        body_snippet: newItem.body_snippet,
        sender_email: newItem.sender_email,
        sender_name: newItem.sender_name,
        attachment_count: newItem.attachment_count,
        attachment_names: newItem.attachment_names,
        status: newItem.status,
        error_message: newItem.error_message,
        created_at: newItem.created_at,
      });
    } catch (err) {
      // Graceful fallback to client storage
    }
  };

  const updateHistoryStatus = async (id: string, newStatus: EmailHistoryItem['status'], resendData?: any) => {
    setHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === id || item.resend_id === id) {
          return {
            ...item,
            status: newStatus,
            error_message: resendData?.error || item.error_message
          };
        }
        return item;
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Sync to Supabase if available
    try {
      await supabase
        .from('email_send_history')
        .update({ status: newStatus })
        .or(`id.eq.${id},resend_id.eq.${id}`);
    } catch {}
  };

  // Convert files in-memory to base64 strings (ZERO storage upload)
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments: CustomComposeAttachment[] = [];

    for (const file of fileArray) {
      // 10MB limit per file for email standards
      if (file.size > 10 * 1024 * 1024) {
        showToast(`"${file.name}" exceeds 10MB limit.`);
        continue;
      }

      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Strip data:mime/type;base64, prefix for Resend API
            const base64 = result.split(',')[1] || result;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newAttachments.push({
          filename: file.name,
          content: base64Data,
          size: file.size,
          type: file.type
        });
      } catch (err) {
        showToast(`Failed to read file "${file.name}"`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
      showToast(`${newAttachments.length} file(s) attached in memory.`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext || '')) {
      return <ImageIcon size={14} color="#3B82F6" />;
    }
    if (ext === 'pdf') {
      return <FileText size={14} color="#EF4444" />;
    }
    return <File size={14} color="#6B7280" />;
  };

  // Handle Email Sending
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendSuccessMessage(null);
    setSendErrorMessage(null);

    const cleanTo = to.trim();
    const cleanSubject = subject.trim();
    const cleanBody = body.trim();

    if (!cleanTo) {
      showToast('Please specify at least one recipient email address.');
      return;
    }

    // Split multiple recipients by comma or semicolon
    const recipients = cleanTo
      .split(/[,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(em => !emailRegex.test(em));
    if (invalidEmails.length > 0) {
      showToast(`Invalid email address: ${invalidEmails.join(', ')}`);
      return;
    }

    if (!cleanSubject) {
      showToast('Please enter an email subject line.');
      return;
    }

    if (!cleanBody) {
      showToast('Please enter message content.');
      return;
    }

    setSending(true);

    const historyId = crypto.randomUUID();
    const attachmentNames = attachments.map(a => a.filename);

    try {
      const res = await sendCustomComposeEmail({
        to: recipients,
        subject: cleanSubject,
        body: cleanBody,
        attachments: attachments,
        replyTo: currentUser?.email || undefined,
        senderName: currentUser?.name || 'Idyll Tracks Payments'
      });

      if (res.success) {
        const successItem: EmailHistoryItem = {
          id: historyId,
          resend_id: res.id,
          recipient: recipients.join(', '),
          subject: cleanSubject,
          body_snippet: cleanBody.slice(0, 140),
          sender_email: currentUser?.email || 'billing@idylltrackspayments.online',
          sender_name: currentUser?.name || 'Admin',
          attachment_count: attachments.length,
          attachment_names: attachmentNames,
          status: 'sent',
          created_at: new Date().toISOString()
        };

        await saveHistoryItem(successItem);

        setSendSuccessMessage(`Email dispatched successfully via Resend! ID: ${res.id || 'N/A'}`);
        showToast('Email sent successfully via Resend!');

        // Clear in-memory attachments & form
        setTo('');
        setSubject('');
        setBody('');
        setAttachments([]);

        // Automatically switch to history tab or let user inspect
        setTimeout(() => {
          setActiveTab('history');
        }, 1200);
      } else {
        const failureReason = res.error || 'Resend rejected the request.';
        const failedItem: EmailHistoryItem = {
          id: historyId,
          recipient: recipients.join(', '),
          subject: cleanSubject,
          body_snippet: cleanBody.slice(0, 140),
          sender_email: currentUser?.email || 'billing@idylltrackspayments.online',
          sender_name: currentUser?.name || 'Admin',
          attachment_count: attachments.length,
          attachment_names: attachmentNames,
          status: 'failed',
          error_message: failureReason,
          created_at: new Date().toISOString()
        };

        await saveHistoryItem(failedItem);
        setSendErrorMessage(`Failed to send email: ${failureReason}`);
        showToast(`Send failed: ${failureReason}`);
      }
    } catch (err: any) {
      const errorStr = err.message || 'Network exception during email dispatch.';
      setSendErrorMessage(`Error: ${errorStr}`);
      showToast(`Error: ${errorStr}`);
    } finally {
      setSending(false);
    }
  };

  // Poll Resend API for fresh status of a history item
  const handleRefreshStatus = async (item: EmailHistoryItem) => {
    if (!item.resend_id) {
      showToast('No Resend ID available for this email.');
      return;
    }

    setRefreshingId(item.id);
    try {
      const result = await fetchResendEmailStatus(item.resend_id);
      if (result.success && result.data) {
        const event = result.data.last_event || 'sent';
        let mappedStatus: EmailHistoryItem['status'] = 'sent';

        if (event === 'delivered' || event === 'opened' || event === 'clicked') {
          mappedStatus = 'delivered';
        } else if (event === 'bounced' || event === 'complained') {
          mappedStatus = 'bounced';
        } else if (event === 'failed') {
          mappedStatus = 'failed';
        }

        await updateHistoryStatus(item.id, mappedStatus, result.data);
        showToast(`Status updated: ${mappedStatus.toUpperCase()}`);
      } else {
        showToast(result.error || 'Could not fetch updated status from Resend.');
      }
    } catch (err: any) {
      showToast(err.message || 'Status check failed.');
    } finally {
      setRefreshingId(null);
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesFilter = statusFilter === 'all' || item.status === statusFilter;
    const matchesQuery = 
      item.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.attachment_names.some(n => n.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesQuery;
  });

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Compose Email</h1>
          <p className={styles.subtitle}>
            Direct email dispatcher with zero-storage attachments and delivery status tracking.
          </p>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.apiPill} title="Connected (billing@idylltrackspayments.online)">
            <Check size={16} strokeWidth={2.5} color="#10B981" />
          </div>

          {/* Navigation Pill Tabs */}
          <div className={styles.tabNav}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'compose' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('compose')}
            >
              <Mail size={15} />
              <span>Composer</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <Clock size={15} />
              <span>Send History</span>
              {history.length > 0 && (
                <span className={styles.tabCount}>{history.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {sendSuccessMessage && (
        <div className={`${styles.alertBanner} ${styles.alertSuccess}`}>
          <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Email Sent!</strong>
            <div>{sendSuccessMessage}</div>
          </div>
        </div>
      )}

      {sendErrorMessage && (
        <div className={`${styles.alertBanner} ${styles.alertError}`}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Failed to Send Email:</strong>
            <div>{sendErrorMessage}</div>
          </div>
        </div>
      )}

      {/* TAB 1: COMPOSER */}
      {activeTab === 'compose' && (
        <div className={styles.card}>
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Recipient Field */}
            <div className={styles.formRow}>
              <label htmlFor="recipientInput" className={styles.label}>
                <span>To:</span>
                <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--text-secondary)' }}>
                  Separate multiple addresses with commas
                </span>
              </label>
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon}>
                  <Mail size={16} />
                </span>
                <input
                  id="recipientInput"
                  type="text"
                  className={styles.input}
                  placeholder="client@example.com, partner@company.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Subject Field */}
            <div className={styles.formRow}>
              <label htmlFor="subjectInput" className={styles.label}>
                <span>Subject:</span>
              </label>
              <input
                id="subjectInput"
                type="text"
                className={`${styles.input} ${styles.inputNoIcon}`}
                placeholder="Enter email subject line..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Body Textarea Editor */}
            <div className={styles.formRow}>
              <label htmlFor="bodyInput" className={styles.label}>
                <span>Message Body:</span>
                <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--text-secondary)' }}>
                  Formatted with clean typography & company branding
                </span>
              </label>

              <div className={styles.editorWrapper}>
                <div className={styles.editorToolbar}>
                  <button
                    type="button"
                    className={styles.toolbarBtn}
                    onClick={() => setBody(prev => (prev ? (prev.endsWith('\n') ? `${prev}• ` : `${prev}\n• `) : '• '))}
                    title="Insert bullet list item"
                  >
                    <List size={14} />
                    <span>List</span>
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarBtn}
                    onClick={() => {
                      const sig = `Best regards,\nIdyll Productions Payments Team`;
                      setBody(prev => (prev.trim() ? `${prev.trim()}\n\n${sig}` : sig));
                    }}
                    title="Add signature"
                  >
                    <PenLine size={14} />
                    <span>Sign</span>
                  </button>
                </div>

                <textarea
                  id="bodyInput"
                  className={styles.textarea}
                  placeholder="Write your email message here. Line breaks and paragraphs are preserved cleanly..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Attachment Section */}
            <div className={styles.attachmentSection}>
              <label className={styles.label}>
                <span>Attachments:</span>
              </label>

              {/* Dropzone */}
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  multiple
                />
                <Paperclip size={24} className={styles.dropzoneIcon} />
                <div className={styles.dropzoneText}>
                  Click to browse files or drag and drop here
                </div>
                <div className={styles.dropzoneHint}>
                  Supports PDFs, PNG, JPG, Word documents, Spreadsheets (max 10MB per file)
                </div>
              </div>

              {/* Attachment Chips */}
              {attachments.length > 0 && (
                <div className={styles.chipsContainer}>
                  {attachments.map((att, index) => (
                    <div key={`${att.filename}-${index}`} className={styles.chip}>
                      {getFileIcon(att.filename)}
                      <span className={styles.chipName} title={att.filename}>{att.filename}</span>
                      <span className={styles.chipSize}>({formatFileSize(att.size)})</span>
                      <button
                        type="button"
                        className={styles.chipRemoveBtn}
                        onClick={() => removeAttachment(index)}
                        title="Remove attachment"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Bar with Actions */}
            <div className={styles.footerBar}>
              <div className={styles.senderMeta}>
                Sending from: <strong>billing@idylltrackspayments.online</strong>
              </div>

              <div className={styles.footerButtons}>
                <button
                  type="button"
                  className={styles.discardBtn}
                  onClick={() => {
                    setTo('');
                    setSubject('');
                    setBody('');
                    setAttachments([]);
                    setSendSuccessMessage(null);
                    setSendErrorMessage(null);
                  }}
                  disabled={sending}
                >
                  Discard
                </button>

                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <DancingDotsLoader size={8} color="#FFFFFF" gap={5} borderRadius="2px" />
                      <span>Sending via Resend...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Send Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>
      )}

      {/* TAB 2: SEND HISTORY */}
      {activeTab === 'history' && (
        <div className={styles.historyCard}>
          <div className={styles.historyHeader}>
            <div className={styles.historyTitleGroup}>
              <h2 className={styles.historyTitle}>Send History</h2>
              <p className={styles.historySubtitle}>
                Log of all emails dispatched via Resend with live delivery tracking.
              </p>
            </div>

            <div className={styles.historyActions}>
              {/* Search */}
              <div className={styles.inputGroup} style={{ width: '220px' }}>
                <span className={styles.inputIcon}>
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '8px 12px 8px 36px', fontSize: '13px' }}
                />
              </div>

              {/* Status Filter Pill */}
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-main)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                {(['all', 'delivered', 'sent', 'failed'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    style={{
                      border: 'none',
                      background: statusFilter === tab ? 'var(--bg-surface)' : 'transparent',
                      color: statusFilter === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: '500',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      boxShadow: 'none',
                      transition: 'background-color 0.15s ease, color 0.15s ease'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* History Table */}
          {filteredHistory.length === 0 ? (
            <div className={styles.emptyState}>
              <Inbox size={40} className={styles.emptyIcon} />
              <div className={styles.emptyTitle}>No Sent Emails Found</div>
              <p className={styles.emptyText}>
                {searchQuery || statusFilter !== 'all' 
                  ? 'No emails match the selected filters.' 
                  : 'Emails you compose and send will be logged here with real-time Resend delivery events.'}
              </p>
              <button
                type="button"
                className={styles.sendBtn}
                style={{ marginTop: '12px', padding: '9px 18px', fontSize: '13px' }}
                onClick={() => setActiveTab('compose')}
              >
                <Send size={14} />
                <span>Compose First Email</span>
              </button>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Attachments</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(item => (
                    <tr key={item.id}>
                      {/* Recipient */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>
                            {item.recipient.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }} title={item.recipient}>
                            {item.recipient}
                          </div>
                        </div>
                      </td>

                      {/* Subject */}
                      <td>
                        <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }} title={item.subject}>
                          {item.subject}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.body_snippet}
                        </div>
                      </td>

                      {/* Attachments */}
                      <td>
                        {item.attachment_count > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', color: 'var(--text-secondary)' }} title={item.attachment_names.join(', ')}>
                            <Paperclip size={13} />
                            <span>{item.attachment_count} file{item.attachment_count > 1 ? 's' : ''}</span>
                          </span>
                        ) : (
                          <span style={{ color: '#9CA3AF', fontSize: '12.5px' }}>None</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                        {new Date(item.created_at).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>

                      {/* Status */}
                      <td>
                        {item.status === 'delivered' && (
                          <span className={`${styles.statusBadge} ${styles.statusDelivered}`}>
                            <CheckCircle2 size={12} />
                            <span>Delivered</span>
                          </span>
                        )}
                        {item.status === 'sent' && (
                          <span className={`${styles.statusBadge} ${styles.statusSent}`}>
                            <Send size={11} />
                            <span>Sent</span>
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className={`${styles.statusBadge} ${styles.statusFailed}`} title={item.error_message || 'Failed'}>
                            <AlertCircle size={12} />
                            <span>Failed</span>
                          </span>
                        )}
                        {item.status === 'bounced' && (
                          <span className={`${styles.statusBadge} ${styles.statusBounced}`}>
                            <AlertCircle size={12} />
                            <span>Bounced</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {item.resend_id && (
                            <button
                              type="button"
                              className={styles.refreshBtn}
                              onClick={() => handleRefreshStatus(item)}
                              disabled={refreshingId === item.id}
                              title="Fetch latest status from Resend"
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              <RefreshCw size={12} className={refreshingId === item.id ? 'animate-spin' : ''} />
                              <span>Sync</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.refreshBtn}
                            onClick={() => setSelectedDetail(item)}
                            title="View Email Details"
                            style={{ padding: '5px 10px', fontSize: '12px' }}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setSelectedDetail(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #FFFFFF)',
              borderRadius: '14px',
              maxWidth: '560px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600' }}>Email Dispatch Details</h3>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Recipient</span>
                <strong>{selectedDetail.recipient}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Subject</span>
                <div>{selectedDetail.subject}</div>
              </div>
              {selectedDetail.resend_id && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Resend Email ID</span>
                  <code style={{ background: 'var(--bg-main)', padding: '3px 6px', borderRadius: '4px', fontSize: '12px' }}>{selectedDetail.resend_id}</code>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Status</span>
                <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{selectedDetail.status}</span>
              </div>
              {selectedDetail.error_message && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: '8px', color: '#B91C1C' }}>
                  <span style={{ fontWeight: '600', display: 'block', marginBottom: '2px' }}>Failure Information:</span>
                  {selectedDetail.error_message}
                </div>
              )}
              {selectedDetail.attachment_names.length > 0 && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px', marginBottom: '4px' }}>Attachments Dispatched:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedDetail.attachment_names.map((n, i) => (
                      <span key={i} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-default)', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                        📎 {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px', marginBottom: '4px' }}>Message Preview</span>
                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-default)', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto', fontSize: '13px' }}>
                  {selectedDetail.body_snippet}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-default)', paddingTop: '14px' }}>
              <button
                type="button"
                className={styles.discardBtn}
                onClick={() => setSelectedDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ComposeView;
