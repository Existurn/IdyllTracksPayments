import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, MoreVertical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Edit2, X, Download, ExternalLink, HelpCircle, Info } from 'lucide-react';
import styles from './InvoiceTable.module.css';
import { supabase } from '../../lib/supabaseClient';
import { logAction } from '../../utils/auditLogger';
import { useKeyboardShortcut } from '../../contexts/KeyboardShortcutContext';
import { useRBAC } from '../../contexts/RBACContext';

import mastercardLogo from '../../assets/payment-methods/Mastercard Logo.png';
import paypalLogo from '../../assets/payment-methods/Paypal Logo.png';
import upiLogo from '../../assets/payment-methods/Upi Logo.png';
import visaLogo from '../../assets/payment-methods/Visa Logo.png';
import wireTransferLogo from '../../assets/payment-methods/Wire Transfer Logo.png';
import fampayLogo from '../../assets/payment-methods/Fampay Logo.png';
import wiseLogo from '../../assets/payment-methods/Wise Logo.png';
import disappointedImg from '../../assets/disappointed.gif';

interface InvoiceTableProps {
  onAddInvoice?: () => void;
  onEditInvoice?: (id: string) => void;
}

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

const PAYMENT_LOGOS: Record<string, string> = {
  'Mastercard': mastercardLogo,
  'PayPal': paypalLogo,
  'UPI': upiLogo,
  'Visa': visaLogo,
  'Wire Transfer': wireTransferLogo,
  'Fampay': fampayLogo,
  'Wise': wiseLogo,
};

const InvoiceTable: React.FC<InvoiceTableProps> = ({ onAddInvoice, onEditInvoice: _onEditInvoice }) => {
  const { users, hasPermission } = useRBAC();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const found = users.find(u => u.id === user.id);
        const resolvedUser = found || { id: user.id, email: user.email, role: 'Client' };
        setCurrentUser(resolvedUser);
        fetchInvoices(user.id, true);
      } else {
        setLoading(false);
      }
    });
  }, []);

  // Realtime subscription for invoices table
  useEffect(() => {
    const subscription = supabase
      .channel('public:invoice_table_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchInvoices(undefined, false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [monthFilter, setMonthFilter] = useState('All Months');
  const [isMonthFilterOpen, setIsMonthFilterOpen] = useState(false);
  
  const MONTHS = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  // Action Menu State
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  // Delete Modal State
  const [invoiceToDelete, setInvoiceToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Info Modal State
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Easter Egg State
  const [statusClicks, setStatusClicks] = useState(0);
  const [showFunnyModal, setShowFunnyModal] = useState(false);

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

  // Lock background scrolling when modals are open
  useEffect(() => {
    if (isInfoOpen || Boolean(invoiceToDelete) || showFunnyModal) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [isInfoOpen, invoiceToDelete, showFunnyModal]);

  const fetchInvoices = async (targetUserId?: string, showSpinner = false) => {
    if (showSpinner || isFirstLoadRef.current || invoices.length === 0) {
      setLoading(true);
    }
    try {
      let uid = targetUserId || currentUser?.id;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        uid = user?.id;
      }

      if (!uid) {
        setInvoices([]);
        setLoading(false);
        return;
      }

      // Query only invoices created by or owned by the logged-in user
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .or(`creator_id.eq.${uid},owner_id.eq.${uid}`)
        .neq('is_deleted', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn("Falling back to client-filtered query:", error.message);
        const { data: allData, error: fallbackError } = await supabase
          .from('invoices')
          .select('*')
          .neq('is_deleted', true)
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;

        // Strict isolation: only invoices where current user is creator or owner
        const userInvoices = (allData || []).filter(
          inv => (inv.creator_id && inv.creator_id === uid) || (inv.owner_id && inv.owner_id === uid)
        );
        setInvoices(userInvoices);
      } else {
        // Enforce strict local isolation guarantee
        const userInvoices = (data || []).filter(
          inv => (inv.creator_id && inv.creator_id === uid) || (inv.owner_id && inv.owner_id === uid)
        );
        setInvoices(userInvoices);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
      isFirstLoadRef.current = false;
    }
  };

  // Filtering and Searching Logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      // Status Filter
      if (statusFilter !== 'All' && invoice.status !== statusFilter) {
        return false;
      }
      
      // Month Filter
      if (monthFilter !== 'All Months') {
        const monthIndex = MONTHS.indexOf(monthFilter) - 1; // 0 for Jan, 1 for Feb
        const dateString = invoice.created_at || invoice.due_date;
        if (dateString) {
          const invoiceDate = new Date(dateString);
          if (invoiceDate.getMonth() !== monthIndex) {
            return false;
          }
        } else {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          invoice.invoice_no,
          invoice.title,
          invoice.client_name,
          invoice.due_date || new Date(invoice.created_at).toLocaleDateString(),
          invoice.payment_method,
          invoice.status,
          String(invoice.amount)
        ];
        
        const matchesSearch = searchFields.some(field => 
          field && String(field).toLowerCase().includes(query)
        );
        
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  }, [invoices, searchQuery, statusFilter, monthFilter]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  const currentInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, monthFilter]);

const deleteInvoiceStorageFiles = async (pdfUrls: (string | null | undefined)[]) => {
  const filePaths = pdfUrls
    .filter((url): url is string => !!url && typeof url === 'string')
    .map(url => {
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

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      if (invoiceToDelete.pdf_url) {
        await deleteInvoiceStorageFiles([invoiceToDelete.pdf_url]);
      }

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceToDelete.id);

      if (error) throw error;
      
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));
      await logAction('Invoice Deleted', `Permanently deleted invoice ${invoiceToDelete.invoice_no || invoiceToDelete.id}`);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: "Invoice permanently deleted." }));
      setInvoiceToDelete(null);
    } catch (error: any) {
      console.error("Error deleting invoice:", error);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: error?.message || "Failed to delete invoice. Please try again." }));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusClick = () => {
    const newCount = statusClicks + 1;
    setStatusClicks(newCount);
    
    if (newCount === 4) {
      setShowFunnyModal(true);
      setStatusClicks(0);
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: "You can't change the status by yourself. It is managed by the finance team." }));
    }
  };

  const renderStatusBadge = (rawStatus: string) => {
    let status = rawStatus || 'Pending';
    if (status === 'Need Changes And Rejected') status = 'Rejected';
    if (status === 'In Process') status = 'In Progress';

    let colorClass = '';
    switch(status) {
      case 'Paid': colorClass = styles.statusPaid; break;
      case 'Pending': colorClass = styles.statusPending; break;
      case 'In Progress': colorClass = styles.statusInProgress; break;
      case 'Rejected': colorClass = styles.statusRejected; break;
      default: colorClass = styles.statusDefault;
    }
    
    return (
      <span className={`${styles.statusBadge} ${colorClass}`}>
        <span className={styles.statusDot}></span>
        {status}
      </span>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className={styles.title} style={{ marginBottom: 0 }}>Invoices</h1>
            <button 
              onClick={() => setIsInfoOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%', transition: 'background-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Important Information"
            >
              <Info size={20} />
            </button>
          </div>
          <p className={styles.subtitle} style={{ marginTop: '4px' }}>Manage your created invoices</p>
        </div>
        <button className={styles.addBtn} onClick={onAddInvoice}>
          <span className={styles.plusIcon}>+</span>Create New Invoice
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search invoices..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className={styles.shortcutKey}>{searchShortcutLabel}</div>
        </div>
        
        <div className={styles.actions}>
          <div style={{ position: 'relative' }}>
            <button 
              className={styles.actionBtn}
              onClick={() => { setIsFilterOpen(!isFilterOpen); setIsMonthFilterOpen(false); }}
            >
              <Filter size={16} /> {statusFilter === 'All' ? 'Filter' : statusFilter}
            </button>
            
            {isFilterOpen && (
              <div className={styles.filterDropdown}>
                {['All', 'Pending', 'In Progress', 'Paid', 'Rejected'].map(status => (
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
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Invoice Name</th>
              <th>Invoice ID</th>
              <th>Date</th>
              <th>Payment Via</th>
              <th>Status</th>
              <th>Amount</th>
              <th className={styles.actionCell}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading invoices...</td>
              </tr>
            ) : currentInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No invoices found.</td>
              </tr>
            ) : (
              currentInvoices.map((invoice) => (
                <tr key={invoice.id} className={styles.tableRow}>
                  <td>
                    <div className={styles.clientInfo}>
                      <div className={styles.clientDetails}>
                        <span className={styles.clientName}>{invoice.invoice_no || 'N/A'}</span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.invoiceId}>{invoice.idyll_tracks_id || 'N/A'}</td>
                  <td className={styles.date}>{invoice.due_date || new Date(invoice.created_at).toLocaleDateString()}</td>
                  <td>
                    {invoice.payment_method ? (
                      <div className={styles.paymentMethod}>
                        {PAYMENT_LOGOS[invoice.payment_method] ? (
                          <img 
                            src={PAYMENT_LOGOS[invoice.payment_method]} 
                            alt={invoice.payment_method} 
                            className={styles.paymentLogoImg} 
                            title={invoice.payment_method} 
                          />
                        ) : (
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>{invoice.payment_method}</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--gray-400)' }}>Not Set</span>
                    )}
                  </td>
                  <td onClick={handleStatusClick} style={{ cursor: 'pointer' }}>
                    {renderStatusBadge(invoice.status || 'Pending')}
                  </td>
                  <td className={styles.amount}>
                    {invoice.currency === '₹' ? '₹' : '$'}{(invoice.amount || 0).toFixed(2)}
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
                          <button 
                            className={styles.deleteOption}
                            onClick={() => {
                              setActiveMenu(null);
                              const oneHour = 60 * 60 * 1000;
                              // Admins, CEOs, CFOs, Managers, or users with billing access have full delete permissions at any time
                              const isPrivileged = currentUser?.role === 'CEO' || currentUser?.role === 'CFO' || currentUser?.role === 'Manager' || (currentUser?.id && hasPermission(currentUser.id, 'billing'));
                              const isWithinOneHour = !invoice.created_at || (new Date().getTime() - new Date(invoice.created_at).getTime() <= oneHour);

                              if (!isPrivileged && !isWithinOneHour) {
                                window.dispatchEvent(new CustomEvent('show-toast', { detail: "You don't have delete permissions. You can only delete an invoice for up to one hour after its creation." }));
                                return;
                              }
                              setInvoiceToDelete(invoice);
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
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
          Total {filteredInvoices.length} invoices
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Delete Invoice?</h3>
              <button onClick={() => setInvoiceToDelete(null)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <p className={styles.modalBody}>
              Are you sure you want to delete invoice <strong>{invoiceToDelete.invoice_no || invoiceToDelete.title}</strong>? 
              <br/><br/>
              This invoice will be permanently deleted from the database.
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
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {isInfoOpen && (
        <div className={styles.infoModalOverlay} onClick={() => setIsInfoOpen(false)}>
          <div className={styles.infoModalContent} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setIsInfoOpen(false)}
              className={styles.infoModalCloseBtn}
              title="Close"
              aria-label="Close"
            >
              <X size={22} />
            </button>
            <h3 className={styles.infoModalTitle}>Invoices</h3>
            <p className={styles.infoModalSubtitle}>Please read the following information carefully before creating an invoice or submitting payment details.</p>
            
            <h4 className={styles.infoSectionTitle}>Invoice Creation</h4>
            <ul className={styles.infoList}>
              <li>Please enter all invoice and payment details carefully and accurately.</li>
              <li>Make sure the first letter of names, addresses, and other relevant details is capitalized correctly.</li>
              <li>Double-check all information before submitting an invoice.</li>
              <li>Please avoid creating multiple or unnecessary invoices at the same time. Create invoices only when required.</li>
              <li>Once an invoice is created, you will have access to delete it only within <strong>1 hour of creation</strong>.</li>
              <li>After 1 hour, the invoice cannot be deleted or modified. Please review everything carefully before the 1-hour period expires.</li>
            </ul>

            <h4 className={styles.infoSectionTitle}>Payment Information</h4>
            <div className={styles.infoTextGroup}>
              <p>You are responsible for providing accurate payment information, including the recipient's name, bank details, UPI details, account information, and any other required information.</p>
              <p>Please check all details carefully before submitting them. Once a payment has been processed based on the information you provided, we cannot be held responsible for incorrect information entered by you.</p>
              <p>If you provide incorrect payment details and the payment is successfully sent to the wrong recipient, <strong>we cannot guarantee a refund or recovery of the payment</strong>. You are responsible for verifying the information before submitting it.</p>
            </div>

            <h4 className={styles.infoSectionTitle}>KYC Verification</h4>
            <div className={styles.infoTextGroup}>
              <p>KYC verification may be required before certain payments or transactions can be processed. If KYC is requested, you must complete the verification process and provide the required information or documents.</p>
              <p>Payments may be delayed or unavailable until the required KYC verification has been completed.</p>
            </div>

            <h4 className={styles.infoSectionTitle}>Important</h4>
            <div className={styles.infoTextGroup}>
              <p>Please review every detail carefully before submitting an invoice or payment request. Once submitted or processed, certain information may no longer be editable, and payments made using incorrect information may not be recoverable.</p>
              <p className={styles.infoImportantNotice}>We are not responsible for losses, delays, or payment errors resulting from incorrect or incomplete information provided by you.</p>
            </div>
          </div>
        </div>
      )}

      {/* Funny Modal Easter Egg */}
      {showFunnyModal && (
        <div className={styles.modalOverlay} onClick={() => setShowFunnyModal(false)}>
          <div className={styles.funnyModalContent} onClick={e => e.stopPropagation()}>
            <div style={{ overflow: 'hidden', borderRadius: '12px', marginBottom: '24px', width: '100%' }}>
              <img src={disappointedImg} alt="Disappointed" style={{ width: '100%', display: 'block' }} />
            </div>
            <p style={{ fontSize: '18px', color: '#111827', fontWeight: '500', lineHeight: '1.5', margin: 0 }}>
              Bro’s clicking the status like it’s going to change and magically credit money to your account 💀. It’s managed by the Financial Team, not you 😂
            </p>
            <button 
              onClick={() => setShowFunnyModal(false)}
              style={{ marginTop: '24px', padding: '10px 24px', backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
            >
              My Bad
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceTable;
