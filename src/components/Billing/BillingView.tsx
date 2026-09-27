import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, MoreVertical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Edit2, X, Download, RotateCcw, User, Users, ExternalLink, Undo2, ChevronDown, CheckSquare, Square } from 'lucide-react';
import styles from './BillingView.module.css';
import { supabase } from '../../lib/supabaseClient';
import { logAction } from '../../utils/auditLogger';
import { showToast, sendInvoiceEmail } from '../../utils/notifications';
import { useKeyboardShortcut } from '../../contexts/KeyboardShortcutContext';
import { useRBAC } from '../../contexts/RBACContext';
import { getFirstLetterOfFirstName } from '../../utils/avatarHelper';

// Helper to delete invoice PDF files from Supabase Storage
const deleteInvoiceStorageFiles = async (pdfUrls: (string | null | undefined)[]) => {
  const filePaths = pdfUrls
    .filter((url): url is string => !!url && typeof url === 'string')
    .map(url => {
      // url format: .../storage/v1/object/public/invoices/<userId>/invoice-<timestamp>.pdf
      const marker = '/storage/v1/object/public/invoices/';
      if (url.includes(marker)) {
        return decodeURIComponent(url.split(marker)[1]?.split('?')[0] || '');
      }
      return '';
    })
    .filter(path => path.length > 0);

  if (filePaths.length > 0) {
    try {
      const { error } = await supabase.storage.from('invoices').remove(filePaths);
      if (error) console.error("Error removing invoice PDFs from storage:", error);
    } catch (e) {
      console.error("Storage removal error:", e);
    }
  }
};

const handleForceDownload = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Error downloading file", err);
    window.open(url, '_blank');
  }
};

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Paid', 'Rejected'];

const BillingView: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  const [currentTab, setCurrentTab] = useState<'active' | 'deleted'>('active');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showBulkDeleteConfirmModal, setShowBulkDeleteConfirmModal] = useState(false);
  const [showBulkTrashConfirmModal, setShowBulkTrashConfirmModal] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const masterCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = 
        selectedIds.length > 0 && selectedIds.length < invoices.length;
    }
  }, [selectedIds, invoices]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [tempSelectedUserId, setTempSelectedUserId] = useState<string>('All');
  const { users } = useRBAC();
  
  const [monthFilter, setMonthFilter] = useState('All Months');
  const [isMonthFilterOpen, setIsMonthFilterOpen] = useState(false);
  
  const MONTHS = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeStatusMenu, setActiveStatusMenu] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { searchShortcutLabel, isSearchShortcut } = useKeyboardShortcut();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSearchShortcut(e)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchShortcut]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
    setIsSelectionMode(false);
  }, [debouncedSearch, statusFilter, userFilter, currentTab, monthFilter]);

  const getInvoiceCreator = (invoice: any) => {
    // 1. Check by direct ID match in RBAC users
    if (invoice.creator_id || invoice.owner_id) {
      const match = users.find(u => 
        (invoice.creator_id && u.id === invoice.creator_id) || 
        (invoice.owner_id && u.id === invoice.owner_id)
      );
      if (match) {
        return {
          id: match.id,
          name: match.displayName || match.name || match.email || 'User',
          displayName: match.displayName || match.name,
          avatarUrl: match.avatarUrl,
          email: match.email,
          role: match.role
        };
      }
    }

    // 2. Check invoice number prefix (e.g. IDYDEE-0001 -> Deepak, IDYHAR-0001 -> Harsh)
    if (invoice.invoice_no) {
      const matchPrefix = invoice.invoice_no.match(/^IDY([A-Z]{3})-/i);
      if (matchPrefix && matchPrefix[1]) {
        const letters = matchPrefix[1].toUpperCase();
        const userByPrefix = users.find(u => {
          const uLetters = (u.name || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
          return uLetters === letters;
        });
        if (userByPrefix) {
          return {
            id: userByPrefix.id,
            name: userByPrefix.displayName || userByPrefix.name || 'User',
            displayName: userByPrefix.displayName || userByPrefix.name,
            avatarUrl: userByPrefix.avatarUrl,
            email: userByPrefix.email,
            role: userByPrefix.role
          };
        }
      }
    }

    // 3. Check creator_name if valid and not 'Unknown'
    if (invoice.creator_name && invoice.creator_name !== 'Unknown') {
      const userByName = users.find(u => 
        u.name?.toLowerCase() === invoice.creator_name.toLowerCase() ||
        u.displayName?.toLowerCase() === invoice.creator_name.toLowerCase()
      );
      return {
        id: userByName?.id || invoice.creator_id,
        name: invoice.creator_name,
        displayName: userByName?.displayName || invoice.creator_name,
        avatarUrl: userByName?.avatarUrl,
        email: userByName?.email,
        role: userByName?.role
      };
    }

    return {
      id: null,
      name: 'Unknown',
      displayName: 'Unknown',
      avatarUrl: undefined,
      email: '',
      role: undefined
    };
  };

  const isFirstLoadRef = useRef(true);
  const syncedInvoicesRef = useRef<Set<string>>(new Set());

  const fetchInvoices = async (showSpinner = false) => {
    if (showSpinner || isFirstLoadRef.current || invoices.length === 0) {
      setLoading(true);
    }
    try {
      if (currentTab === 'deleted') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        try {
          const { data: expiredInvoices, error: expErr } = await supabase
            .from('invoices')
            .select('pdf_url')
            .eq('is_deleted', true)
            .lt('deleted_at', thirtyDaysAgo);

          if (!expErr && expiredInvoices && expiredInvoices.length > 0) {
            await deleteInvoiceStorageFiles(expiredInvoices.map(inv => inv.pdf_url));
            await supabase
              .from('invoices')
              .delete()
              .eq('is_deleted', true)
              .lt('deleted_at', thirtyDaysAgo);
          }
        } catch (purgeErr) {
          console.warn("Auto purge check error:", purgeErr);
        }
      }

      let query = supabase
        .from('invoices')
        .select('*', { count: 'exact' });

      if (currentTab === 'deleted') {
        query = query.eq('is_deleted', true);
      } else {
        query = query.neq('is_deleted', true);
      }

      if (statusFilter !== 'All') {
        if (statusFilter === 'Rejected') {
          query = query.or('status.eq.Rejected,status.eq.Need Changes And Rejected');
        } else if (statusFilter === 'In Progress') {
          query = query.or('status.eq.In Progress,status.eq.In Process');
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      if (userFilter !== 'All') {
        const selectedUser = users.find(u => u.id === userFilter);
        const prefixLetters = selectedUser ? (selectedUser.name || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() : '';
        if (prefixLetters) {
          query = query.or(`creator_id.eq.${userFilter},owner_id.eq.${userFilter},invoice_no.ilike.IDY${prefixLetters}-%`);
        } else {
          query = query.or(`creator_id.eq.${userFilter},owner_id.eq.${userFilter}`);
        }
      }

      if (monthFilter !== 'All Months') {
        const monthIndex = MONTHS.indexOf(monthFilter);
        if (monthIndex > 0) {
          const currentYear = new Date().getFullYear();
          const startDate = new Date(currentYear, monthIndex - 1, 1).toISOString();
          const endDate = new Date(currentYear, monthIndex, 0, 23, 59, 59, 999).toISOString();
          query = query.gte('created_at', startDate).lte('created_at', endDate);
        }
      }

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`invoice_no.ilike.${term},client_name.ilike.${term},title.ilike.${term}`);
      }

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Auto-backfill creator_name in background once per session if currently 'Unknown'
      if (data && data.length > 0) {
        data.forEach((inv: any) => {
          if (!inv.creator_name || inv.creator_name === 'Unknown') {
            const resolved = getInvoiceCreator(inv);
            if (resolved.name && resolved.name !== 'Unknown') {
              inv.creator_name = resolved.name;
              if (!inv.creator_id && resolved.id) inv.creator_id = resolved.id;
              if (!syncedInvoicesRef.current.has(inv.id)) {
                syncedInvoicesRef.current.add(inv.id);
                supabase.from('invoices').update({
                  creator_name: resolved.name,
                  ...(resolved.id && !inv.creator_id ? { creator_id: resolved.id } : {})
                }).eq('id', inv.id).then(() => {});
              }
            }
          }
        });
      }

      setInvoices(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      showToast("Failed to fetch invoices");
    } finally {
      setLoading(false);
      isFirstLoadRef.current = false;
    }
  };

  useEffect(() => {
    fetchInvoices(true);
    setSelectedIds([]);
  }, [currentPage, debouncedSearch, statusFilter, userFilter, currentTab, monthFilter]);

  // Real-time listener for invoice updates across the system
  useEffect(() => {
    const subscription = supabase
      .channel('public:billing_invoices_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        // Silently update invoices without flashing loading spinner or resetting UI state
        fetchInvoices(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentPage, debouncedSearch, statusFilter, userFilter, currentTab, monthFilter]);

  const handleStatusChange = async (invoice: any, newStatus: string) => {
    if (invoice.status === newStatus) return;
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoice.id);
        
      if (error) throw error;
      setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, status: newStatus } : inv));
      await logAction('Status Change', `Changed status from ${invoice.status} to ${newStatus} for invoice ${invoice.invoice_no}`);
      showToast(`Status updated to ${newStatus}`);
      if (newStatus === 'Paid' || newStatus === 'Rejected' || newStatus === 'Pending') {
        await sendInvoiceEmail({ 
          toUserId: invoice.creator_id, 
          invoiceNo: invoice.invoice_no, 
          status: newStatus, 
          invoiceId: invoice.id,
          amount: invoice.amount,
          clientName: invoice.client_name,
          dueDate: invoice.due_date
        });
      }
    } catch (error) {
      showToast("Failed to update status");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      const isPermanentlyDeleting = currentTab === 'deleted';
      if (isPermanentlyDeleting) {
        await deleteInvoiceStorageFiles([invoiceToDelete.pdf_url]);
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', invoiceToDelete.id);
          
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));
        setSelectedIds(prev => prev.filter(id => id !== invoiceToDelete.id));
        await logAction('Deleted', `Permanently deleted invoice ${invoiceToDelete.invoice_no}`);
        showToast("Invoice permanently deleted");
      } else {
        let { error } = await supabase
          .from('invoices')
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq('id', invoiceToDelete.id);
          
        if (error && (error.code === 'PGRST204' || error.message?.includes('deleted_at'))) {
          const retry = await supabase
            .from('invoices')
            .update({ is_deleted: true })
            .eq('id', invoiceToDelete.id);
          error = retry.error;
        }

        if (error) throw error;
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));
        setSelectedIds(prev => prev.filter(id => id !== invoiceToDelete.id));
        await logAction('Deleted', `Moved invoice ${invoiceToDelete.invoice_no} to Recently Deleted`);
        showToast("Invoice moved to Recently Deleted");
      }
      setInvoiceToDelete(null);
      fetchInvoices();
    } catch (error: any) {
      console.error("Error deleting invoice:", error);
      showToast(error?.message || "Failed to delete invoice");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkTrashConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      let { error } = await supabase
        .from('invoices')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .in('id', selectedIds);

      if (error && (error.code === 'PGRST204' || error.message?.includes('deleted_at'))) {
        const retry = await supabase
          .from('invoices')
          .update({ is_deleted: true })
          .in('id', selectedIds);
        error = retry.error;
      }

      if (error) throw error;
      await logAction('Batch Trash', `Moved ${selectedIds.length} invoice(s) to Recently Deleted`);
      showToast(`${selectedIds.length} invoice(s) moved to Recently Deleted`);
      setSelectedIds([]);
      setIsSelectionMode(false);
      setShowBulkTrashConfirmModal(false);
      fetchInvoices();
    } catch (error: any) {
      console.error("Error moving invoices to deleted:", error);
      showToast(error?.message || "Failed to delete selected invoices");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      let { error } = await supabase
        .from('invoices')
        .update({ is_deleted: false, deleted_at: null })
        .in('id', selectedIds);

      if (error && (error.code === 'PGRST204' || error.message?.includes('deleted_at'))) {
        const retry = await supabase
          .from('invoices')
          .update({ is_deleted: false })
          .in('id', selectedIds);
        error = retry.error;
      }

      if (error) throw error;
      await logAction('Batch Restore', `Restored ${selectedIds.length} invoice(s)`);
      showToast(`${selectedIds.length} invoice(s) restored successfully`);
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchInvoices();
    } catch (error: any) {
      console.error("Error restoring invoices:", error);
      showToast(error?.message || "Failed to restore selected invoices");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .in('id', selectedIds);

      if (error) throw error;

      setInvoices(prev => prev.map(inv => selectedIds.includes(inv.id) ? { ...inv, status: newStatus } : inv));
      await logAction('Bulk Status Change', `Changed status to ${newStatus} for ${selectedIds.length} invoice(s)`);
      showToast(`Updated ${selectedIds.length} invoice(s) to ${newStatus}`);

      if (newStatus === 'Paid' || newStatus === 'Rejected' || newStatus === 'Pending') {
        const affected = invoices.filter(inv => selectedIds.includes(inv.id));
        for (const inv of affected) {
          sendInvoiceEmail({
            toUserId: inv.creator_id,
            invoiceNo: inv.invoice_no,
            status: newStatus,
            invoiceId: inv.id,
            amount: inv.amount,
            clientName: inv.client_name,
            dueDate: inv.due_date
          }).catch(e => console.warn("Email notify error:", e));
        }
      }
      setSelectedIds([]);
      setIsBulkStatusOpen(false);
    } catch (error: any) {
      console.error("Bulk status error:", error);
      showToast("Failed to update status for selected invoices");
    }
  };

  const handleBulkDownload = async () => {
    const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id) && inv.pdf_url);
    if (selectedInvoices.length === 0) {
      showToast("No downloadable PDFs found for selected invoices");
      return;
    }
    showToast(`Downloading ${selectedInvoices.length} invoice(s)...`);
    for (let i = 0; i < selectedInvoices.length; i++) {
      const inv = selectedInvoices[i];
      const filename = `${inv.invoice_no || `invoice-${inv.id}`}.pdf`;
      await handleForceDownload(inv.pdf_url, filename);
      if (i < selectedInvoices.length - 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      const invoicesToDelete = invoices.filter(inv => selectedIds.includes(inv.id));
      await deleteInvoiceStorageFiles(invoicesToDelete.map(inv => inv.pdf_url));
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', selectedIds);
      if (error) throw error;
      await logAction('Batch Deleted', `Permanently deleted ${selectedIds.length} invoice(s)`);
      showToast(`${selectedIds.length} invoice(s) permanently deleted`);
      setSelectedIds([]);
      setShowBulkDeleteConfirmModal(false);
      fetchInvoices();
    } catch (error) {
      showToast("Failed to delete selected invoices");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllConfirm = async () => {
    setIsDeleting(true);
    try {
      // 1. Fetch all deleted invoices to get their pdf_urls
      const { data: allDeleted } = await supabase
        .from('invoices')
        .select('pdf_url')
        .eq('is_deleted', true);

      if (allDeleted && allDeleted.length > 0) {
        await deleteInvoiceStorageFiles(allDeleted.map(inv => inv.pdf_url));
      }

      // 2. Delete database rows
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('is_deleted', true);

      if (error) throw error;

      await logAction('Clear All Deleted', `Cleared all recently deleted invoices`);
      showToast("All recently deleted invoices have been permanently deleted");
      setInvoices([]);
      setSelectedIds([]);
      setShowClearConfirmModal(false);
      fetchInvoices();
    } catch (error) {
      console.error("Error clearing all invoices:", error);
      showToast("Failed to clear all deleted invoices");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreInvoice = async (id: string) => {
    try {
      let { error } = await supabase
        .from('invoices')
        .update({ is_deleted: false, deleted_at: null })
        .eq('id', id);
        
      if (error && (error.code === 'PGRST204' || error.message?.includes('deleted_at'))) {
        const retry = await supabase
          .from('invoices')
          .update({ is_deleted: false })
          .eq('id', id);
        error = retry.error;
      }

      if (error) throw error;
      
      await logAction('Restored', `Restored invoice ${id}`);
      
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, is_deleted: false } : inv));
      setSelectedIds(prev => prev.filter(item => item !== id));
      showToast("Invoice restored successfully");
      fetchInvoices();
    } catch (error: any) {
      console.error("Error restoring invoice:", error);
      showToast(error?.message || "Failed to restore invoice");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === invoices.length && invoices.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoices.map(inv => inv.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const renderStatusDropdown = (invoice: any) => {
    let rawStatus = invoice.status || 'Pending';
    if (rawStatus === 'Need Changes And Rejected') rawStatus = 'Rejected';
    if (rawStatus === 'In Process') rawStatus = 'In Progress';

    if (currentTab === 'deleted') {
      return (
        <span style={{ color: '#6B7280', fontSize: '14px' }}>
          {rawStatus}
        </span>
      );
    }

    let bgColor = '#F3F4F6';
    let textColor = '#374151';
    
    switch(rawStatus) {
      case 'Paid': bgColor = '#DEF7EC'; textColor = '#03543F'; break;
      case 'Pending': bgColor = '#FEF3C7'; textColor = '#92400E'; break;
      case 'In Progress': bgColor = '#FCE7F3'; textColor = '#9D174D'; break;
      case 'Rejected': bgColor = '#FDE8E8'; textColor = '#9B1C1C'; break;
    }
    
    const isOpen = activeStatusMenu === invoice.id;

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button 
          onClick={() => setActiveStatusMenu(isOpen ? null : invoice.id)}
          style={{
            backgroundColor: bgColor,
            color: textColor,
            border: 'none',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: '110px',
            justifyContent: 'space-between'
          }}
        >
          {rawStatus}
          <ChevronDown size={12} />
        </button>
        
        {isOpen && (
          <div className={styles.actionDropdown} style={{ top: '100%', left: '0', right: 'auto', marginTop: '4px', minWidth: '130px', borderRadius: '8px' }}>
            {STATUS_OPTIONS.map(opt => (
              <button 
                key={opt}
                onClick={() => {
                  handleStatusChange(invoice, opt);
                  setActiveStatusMenu(null);
                }}
                style={{ padding: '8px 12px', fontSize: '13px' }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Global Billing</h1>
          <p className={styles.subtitle}>Manage all sent invoices across the system</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' }}>
        <button 
          onClick={() => {
            setCurrentTab('active');
            setSelectedIds([]);
            setIsBulkStatusOpen(false);
          }}
          style={{ 
            background: currentTab === 'active' ? '#F3F4F6' : 'none', 
            border: 'none', 
            color: currentTab === 'active' ? '#111827' : '#6B7280',
            fontWeight: '500',
            fontSize: '15px',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { if(currentTab !== 'active') { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.color = '#111827'; } }}
          onMouseLeave={(e) => { if(currentTab !== 'active') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6B7280'; } }}
        >
          All Invoices
        </button>
        <button 
          onClick={() => {
            setCurrentTab('deleted');
            setSelectedIds([]);
            setIsBulkStatusOpen(false);
          }}
          style={{ 
            background: currentTab === 'deleted' ? '#F3F4F6' : 'none', 
            border: 'none', 
            color: currentTab === 'deleted' ? '#111827' : '#6B7280',
            fontWeight: '500',
            fontSize: '15px',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { if(currentTab !== 'deleted') { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.color = '#111827'; } }}
          onMouseLeave={(e) => { if(currentTab !== 'deleted') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6B7280'; } }}
        >
          Recently Deleted
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search invoice, client, or user..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className={styles.shortcutKey}>{searchShortcutLabel}</div>
        </div>
        
        <div className={styles.actions}>
          {currentTab === 'deleted' && (
            <button 
              className={styles.clearAllBtn}
              onClick={() => setShowClearConfirmModal(true)}
              disabled={invoices.length === 0}
              title="Clear All Recently Deleted Invoices"
            >
              <Trash2 size={16} /> Clear All
            </button>
          )}

          {/* User Filter Icon Button with Tooltip */}
          <button 
            className={`${styles.userIconButton} ${userFilter !== 'All' ? styles.userIconButtonActive : ''}`}
            onClick={() => {
              setTempSelectedUserId(userFilter);
              setIsUserModalOpen(true);
              setIsFilterOpen(false);
              setIsMonthFilterOpen(false);
            }}
            title={userFilter === 'All' ? "Select User" : `Filtered by: ${users.find(u => u.id === userFilter)?.name || 'User'}`}
            aria-label="Select User"
          >
            <User size={18} />
            {userFilter !== 'All' && <span className={styles.activeFilterDot} />}
          </button>

          {/* Status Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              className={styles.actionBtn}
              onClick={() => { setIsFilterOpen(!isFilterOpen); setIsMonthFilterOpen(false); }}
            >
              <Filter size={16} /> {statusFilter === 'All' ? 'Filter Status' : statusFilter}
            </button>
            
            {isFilterOpen && (
              <div className={styles.filterDropdown}>
                {['All', ...STATUS_OPTIONS].map(status => (
                  <div 
                    key={status} 
                    className={styles.filterOption}
                    onClick={() => {
                      setStatusFilter(status);
                      setIsFilterOpen(false);
                    }}
                  >
                    {status}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Month Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              className={styles.actionBtn}
              onClick={() => { setIsMonthFilterOpen(!isMonthFilterOpen); setIsFilterOpen(false); }}
            >
              <ArrowUpDown size={16} /> {monthFilter === 'All Months' ? 'Sort By Month' : monthFilter}
            </button>
            
            {isMonthFilterOpen && (
              <div className={styles.filterDropdown} style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {MONTHS.map(month => (
                  <div 
                    key={month} 
                    className={styles.filterOption}
                    onClick={() => {
                      setMonthFilter(month);
                      setIsMonthFilterOpen(false);
                    }}
                  >
                    {month}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Select Button to toggle Selection Mode */}
          <button 
            className={`${styles.actionBtn} ${isSelectionMode ? styles.actionBtnActive : ''}`}
            onClick={() => {
              if (isSelectionMode) {
                setIsSelectionMode(false);
                setSelectedIds([]);
              } else {
                setIsSelectionMode(true);
              }
            }}
            title={isSelectionMode ? "Cancel selection" : "Select multiple invoices"}
          >
            <CheckSquare size={16} /> {isSelectionMode ? 'Cancel Selection' : 'Select'}
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className={styles.bulkActionBar}>
          <div className={styles.bulkActionInfo}>
            <span className={styles.bulkCountBadge}>
              <CheckSquare size={15} /> {selectedIds.length} Selected
            </span>
          </div>

          <div className={styles.bulkActionButtons}>
            {currentTab === 'active' ? (
              <>
                <div style={{ position: 'relative' }}>
                  <button 
                    className={styles.bulkStatusBtn}
                    onClick={() => setIsBulkStatusOpen(!isBulkStatusOpen)}
                    type="button"
                  >
                    Change Status <ChevronDown size={14} />
                  </button>
                  {isBulkStatusOpen && (
                    <div className={styles.bulkStatusDropdown}>
                      {STATUS_OPTIONS.map(status => (
                        <div 
                          key={status} 
                          className={styles.filterOption}
                          onClick={() => handleBulkStatusChange(status)}
                        >
                          {status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  className={styles.bulkActionSecondaryBtn}
                  onClick={handleBulkDownload}
                  type="button"
                  title="Download selected invoice PDFs"
                >
                  <Download size={15} /> Download ({selectedIds.length})
                </button>

                <button 
                  className={styles.bulkActionDangerBtn}
                  onClick={() => setShowBulkTrashConfirmModal(true)}
                  type="button"
                  title="Move selected invoices to Recently Deleted"
                >
                  <Trash2 size={15} /> Move to Trash ({selectedIds.length})
                </button>
              </>
            ) : (
              <>
                <button 
                  className={styles.bulkRestoreBtn}
                  onClick={handleBulkRestoreConfirm}
                  type="button"
                  title="Restore selected invoices to active"
                >
                  <RotateCcw size={15} /> Restore Selected ({selectedIds.length})
                </button>

                <button 
                  className={styles.bulkActionDangerBtn}
                  onClick={() => setShowBulkDeleteConfirmModal(true)}
                  type="button"
                  title="Permanently delete selected invoices"
                >
                  <Trash2 size={15} /> Delete Selected ({selectedIds.length})
                </button>
              </>
            )}

            <button 
              className={styles.bulkDeselectBtn}
              onClick={() => { 
                setSelectedIds([]); 
                setIsBulkStatusOpen(false); 
                setIsSelectionMode(false);
              }}
              type="button"
              title="Clear selection and exit select mode"
            >
              <X size={14} /> Deselect
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {isSelectionMode && (
                <th className={styles.checkboxCell}>
                  <input 
                    ref={masterCheckboxRef}
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={invoices.length > 0 && selectedIds.length === invoices.length}
                    onChange={toggleSelectAll}
                    title={selectedIds.length === invoices.length ? "Deselect All" : "Select All Invoices"}
                  />
                </th>
              )}
              <th>Invoice Name</th>
              <th>Creator / User</th>
              <th>Invoice ID</th>
              <th className={styles.dateCol}>
                <span className={styles.dateShift}>Date</span>
              </th>
              <th>Amount</th>
              <th>Payment Status</th>
              <th className={styles.actionCell}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isSelectionMode ? 8 : 7} style={{ textAlign: 'center', padding: '2rem' }}>Loading invoices...</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={isSelectionMode ? 8 : 7} style={{ textAlign: 'center', padding: '2rem' }}>
                  {currentTab === 'deleted' ? 'No recently deleted invoices found.' : 'No invoices found.'}
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr 
                  key={invoice.id} 
                  className={`${styles.tableRow} ${selectedIds.includes(invoice.id) ? (currentTab === 'deleted' ? styles.selectedRowDeleted : styles.selectedRowActive) : ''}`}
                >
                  {isSelectionMode && (
                    <td 
                      className={styles.checkboxCell} 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectOne(invoice.id);
                      }}
                    >
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={selectedIds.includes(invoice.id)}
                        onChange={() => toggleSelectOne(invoice.id)}
                      />
                    </td>
                  )}
                  <td>
                    <div className={styles.clientInfo}>
                      <span className={styles.clientName}>{invoice.invoice_no || 'N/A'}</span>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const creator = getInvoiceCreator(invoice);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          {creator.avatarUrl ? (
                            <img 
                              src={creator.avatarUrl} 
                              alt={creator.name} 
                              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }} 
                            />
                          ) : (
                            <div style={{ 
                              width: '28px', 
                              height: '28px', 
                              borderRadius: '50%', 
                              backgroundColor: '#E5E7EB', 
                              color: '#1F2937', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: '11px', 
                              fontWeight: '600',
                              flexShrink: 0,
                              border: '1px solid #D1D5DB'
                            }}>
                              {getFirstLetterOfFirstName(creator.name, creator.email)}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {creator.name}
                            </span>
                            {creator.role && (
                              <span style={{ fontSize: '11px', color: '#6B7280' }}>
                                {creator.role}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className={styles.invoiceId}>{invoice.idyll_tracks_id || 'N/A'}</td>
                  <td className={styles.dateCol}>
                    <span className={`${styles.date} ${styles.dateShift}`}>
                      {invoice.due_date || new Date(invoice.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className={styles.amount}>
                    {invoice.currency || '₹'}{(Number(invoice.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    {renderStatusDropdown(invoice)}
                  </td>
                  <td className={styles.actionCell}>
                    <div style={{ position: 'relative' }}>
                      <button 
                        className={styles.moreBtn} 
                        onClick={() => setActiveMenu(activeMenu === invoice.id ? null : invoice.id)}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeMenu === invoice.id && (
                        <div className={styles.actionDropdown}>
                          {invoice.pdf_url && (
                            <button 
                              onClick={() => {
                                setActiveMenu(null);
                                window.open(invoice.pdf_url, '_blank');
                              }}
                            >
                              <ExternalLink size={14} /> Open
                            </button>
                          )}
                          {invoice.pdf_url && (
                            <button 
                              className={styles.downloadOption}
                              onClick={() => {
                                setActiveMenu(null);
                                handleForceDownload(invoice.pdf_url, `${invoice.invoice_no || 'Invoice'}.pdf`);
                              }}
                            >
                              <Download size={14} /> Download
                            </button>
                          )}
                          
                          {currentTab === 'active' ? (
                            <button 
                              className={styles.deleteOption}
                              onClick={() => {
                                setActiveMenu(null);
                                setInvoiceToDelete(invoice);
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          ) : (
                            <>
                              <button 
                                className={styles.deleteOption}
                                onClick={() => {
                                  setActiveMenu(null);
                                  handleRestoreInvoice(invoice.id);
                                }}
                                style={{ color: '#10B981' }}
                              >
                                <Undo2 size={14} /> Restore
                              </button>
                              <button 
                                className={styles.deleteOption}
                                onClick={() => {
                                  setActiveMenu(null);
                                  setInvoiceToDelete(invoice);
                                }}
                                style={{ color: '#EF4444' }}
                              >
                                <Trash2 size={14} /> Delete Permanently
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <span className={styles.pageInfo}>Page {currentPage} of {totalPages}</span>
        
        <div className={styles.pageControls}>
          <button 
            className={styles.pageBtn} 
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          ><ChevronsLeft size={14} /></button>
          
          <button 
            className={styles.pageBtn} 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          ><ChevronLeft size={14} /></button>
          
          <button className={`${styles.pageNumber} ${styles.active}`}>{currentPage}</button>
          
          <button 
            className={styles.pageBtn}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          ><ChevronRight size={14} /></button>
          
          <button 
            className={styles.pageBtn}
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          ><ChevronsRight size={14} /></button>
        </div>

        <div className={styles.pageSize}>
          Total {totalCount} invoices
        </div>
      </div>
      
      {/* Single Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{currentTab === 'deleted' ? 'Permanently Delete Invoice?' : 'Move to Recently Deleted?'}</h3>
              <button onClick={() => setInvoiceToDelete(null)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <p className={styles.modalBody}>
              {currentTab === 'deleted' ? (
                <>
                  Are you sure you want to permanently delete invoice <strong>{invoiceToDelete.invoice_no || invoiceToDelete.title}</strong>? 
                  <br/><br/>
                  This action cannot be undone. The invoice will be permanently removed from the database.
                </>
              ) : (
                <>
                  Are you sure you want to move invoice <strong>{invoiceToDelete.invoice_no || invoiceToDelete.title}</strong> to <strong>Recently Deleted</strong>?
                </>
              )}
            </p>
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setInvoiceToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmDeleteBtn} 
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : currentTab === 'deleted' ? 'Yes, Delete Permanently' : 'Yes, Move to Deleted'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move to Trash (Active Tab) Confirmation Modal */}
      {showBulkTrashConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Move Selected Invoices to Trash?</h3>
              <button onClick={() => setShowBulkTrashConfirmModal(false)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <p className={styles.modalBody}>
              Are you sure you want to move <strong>{selectedIds.length}</strong> selected invoice(s) to Recently Deleted?
              <br/><br/>
              You can restore them anytime from the Recently Deleted tab.
            </p>
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setShowBulkTrashConfirmModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmDeleteBtn} 
                onClick={handleBulkTrashConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Moving...' : `Move ${selectedIds.length} Invoices to Trash`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Selected Confirmation Modal */}
      {showBulkDeleteConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Delete Selected Invoices?</h3>
              <button onClick={() => setShowBulkDeleteConfirmModal(false)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <p className={styles.modalBody}>
              Are you sure you want to permanently delete <strong>{selectedIds.length}</strong> selected invoice(s)?
              <br/><br/>
              This action cannot be undone. The selected invoices will be permanently removed from the database.
            </p>
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setShowBulkDeleteConfirmModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmDeleteBtn} 
                onClick={handleBulkDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : `Yes, Delete ${selectedIds.length} Invoices`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Clear All Recently Deleted?</h3>
              <button onClick={() => setShowClearConfirmModal(false)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <p className={styles.modalBody}>
              Are you sure you want to permanently delete <strong>ALL</strong> recently deleted invoices?
              <br/><br/>
              This will completely remove all deleted invoices from the database. This action cannot be undone.
            </p>
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setShowClearConfirmModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmDeleteBtn} 
                onClick={handleClearAllConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Clearing...' : 'Yes, Delete All Invoices'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Selection Filter Modal */}
      {isUserModalOpen && (
        <div className={styles.userModalOverlay} onClick={() => setIsUserModalOpen(false)}>
          <div className={styles.userModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.userModalHeader}>
              <div>
                <h3 className={styles.userModalHeaderTitle}>Select User</h3>
                <p className={styles.userModalHeaderSub}>Filter invoices submitted by a specific user</p>
              </div>
              <button 
                className={styles.userModalCloseBtn}
                onClick={() => setIsUserModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.userModalBody}>
              {/* All Users Row */}
              <div 
                className={`${styles.userRowCard} ${tempSelectedUserId === 'All' ? styles.userRowCardSelected : ''}`}
                onClick={() => setTempSelectedUserId('All')}
              >
                <div className={styles.userRowLeft}>
                  <div className={styles.userRowAvatarFallback} style={{ backgroundColor: '#F3F4F6' }}>
                    <Users size={18} color="#4B5563" />
                  </div>
                  <div className={styles.userRowMeta}>
                    <span className={styles.userRowDisplayName}>All Users</span>
                    <span className={styles.userRowFullName}>Show invoices submitted by all users</span>
                  </div>
                </div>
                <div className={`${styles.userRowRadio} ${tempSelectedUserId === 'All' ? styles.userRowRadioSelected : ''}`}>
                  {tempSelectedUserId === 'All' && <div className={styles.userRowRadioInner} />}
                </div>
              </div>

              <div className={styles.userSectionLabel}>Workspace Users</div>

              {/* Individual Users Rows */}
              {users
                .filter(u => u.status === 'Approved' || !u.status)
                .map(u => {
                  const isSelected = tempSelectedUserId === u.id;
                  const displayName = u.displayName || u.name || 'User';
                  const fullName = u.fullName && u.fullName !== displayName ? u.fullName : (u.name !== displayName ? u.name : u.email);

                  return (
                    <div 
                      key={u.id}
                      className={`${styles.userRowCard} ${isSelected ? styles.userRowCardSelected : ''}`}
                      onClick={() => setTempSelectedUserId(u.id)}
                    >
                      <div className={styles.userRowLeft}>
                        {u.avatarUrl ? (
                          <img 
                            src={u.avatarUrl} 
                            alt={displayName} 
                            className={styles.userRowAvatar} 
                          />
                        ) : (
                          <div className={styles.userRowAvatarFallback}>
                            {getFirstLetterOfFirstName(displayName, u.email)}
                          </div>
                        )}
                        <div className={styles.userRowMeta}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span className={styles.userRowDisplayName}>{displayName}</span>
                            {u.role && (
                              <span className={styles.userRowRoleBadge}>{u.role}</span>
                            )}
                          </div>
                          <span className={styles.userRowFullName}>{fullName}</span>
                        </div>
                      </div>
                      <div className={`${styles.userRowRadio} ${isSelected ? styles.userRowRadioSelected : ''}`}>
                        {isSelected && <div className={styles.userRowRadioInner} />}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className={styles.userModalFooter}>
              {userFilter !== 'All' ? (
                <button 
                  type="button"
                  className={styles.userModalClearBtn}
                  onClick={() => {
                    setTempSelectedUserId('All');
                    setUserFilter('All');
                    setIsUserModalOpen(false);
                  }}
                >
                  Clear Filter
                </button>
              ) : <div />}

              <div className={styles.userModalFooterBtns}>
                <button 
                  type="button"
                  className={styles.userModalCancelBtn}
                  onClick={() => setIsUserModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className={styles.userModalApplyBtn}
                  onClick={() => {
                    setUserFilter(tempSelectedUserId);
                    setIsUserModalOpen(false);
                  }}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingView;
