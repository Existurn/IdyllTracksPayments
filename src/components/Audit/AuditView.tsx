import React, { useEffect, useRef, useState, useMemo, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShieldCheck, User, Trash2 } from 'lucide-react';
import styles from './AuditView.module.css';
import { supabase } from '../../lib/supabaseClient';
import { showToast } from '../../utils/notifications';
import { useKeyboardShortcut } from '../../contexts/KeyboardShortcutContext';

const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isUserFilterOpen, setIsUserFilterOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<any>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { searchShortcutLabel, isSearchShortcut } = useKeyboardShortcut();

  // Handle keyboard shortcut for search
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

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, actionFilter, userFilter]);

  // Fetch unique users for the user filter dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('performed_by, performed_by_email');
      
      if (data) {
        const uniqueUsers = Array.from(new Set(data.map(d => JSON.stringify({ id: d.performed_by, email: d.performed_by_email }))))
                                 .map(str => JSON.parse(str as string))
                                 .filter(u => u.id && u.email);
        setAvailableUsers(uniqueUsers);
      }
    };
    fetchUsers();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      // Action filter
      if (actionFilter !== 'All') {
        query = query.eq('action', actionFilter);
      }

      // User filter
      if (userFilter !== 'All') {
        query = query.eq('performed_by', userFilter);
      }

      // Search
      if (debouncedSearch.trim() !== '') {
        query = query.or(`action.ilike.%${debouncedSearch}%,details.ilike.%${debouncedSearch}%,performed_by_email.ilike.%${debouncedSearch}%`);
      }

      // Pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      query = query.order('created_at', { ascending: false }).range(from, to);
        
      const { data, error, count } = await query;
        
      if (error) throw error;
      setLogs(data || []);
      if (count !== null) setTotalCount(count);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      showToast("Error loading audit logs. Have you created the audit_logs table?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, debouncedSearch, actionFilter, userFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const ACTION_OPTIONS = ['Login', 'Invoice Created', 'Status Change', 'Payment Updated', 'Account Deleted', 'User Approved'];

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to permanently delete ALL audit logs? This action cannot be undone.")) return;
    
    try {
      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
      if (error) throw error;
      
      setLogs([]);
      setTotalCount(0);
      setCurrentPage(1);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'All audit logs have been cleared.' }));
    } catch (err) {
      console.error("Failed to clear logs", err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Failed to clear audit logs.' }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <h1 className={styles.title}>Audit Logs</h1>
            <p className={styles.subtitle}>Track changes to invoices across the system</p>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search invoice, client, or user email..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className={styles.shortcutKey}>{searchShortcutLabel}</div>
        </div>
        
        <div className={styles.actions}>
          <button 
            onClick={handleClearLogs}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 12px', 
              backgroundColor: '#FEF2F2', 
              color: '#EF4444', 
              border: '1px solid #FECACA', 
              borderRadius: '6px', 
              fontSize: '13px', 
              fontWeight: '500', 
              cursor: 'pointer' 
            }}
          >
            <Trash2 size={16} /> Clear Logs
          </button>
          
          {/* User Filter */}
          <div style={{ position: 'relative' }}>
            <button 
              className={styles.actionBtn}
              onClick={() => { setIsUserFilterOpen(!isUserFilterOpen); setIsFilterOpen(false); }}
            >
              <User size={16} /> {userFilter === 'All' ? 'All Users' : availableUsers.find(u => u.id === userFilter)?.email || 'User'}
            </button>
            
            {isUserFilterOpen && (
              <div className={styles.filterDropdown} style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <div 
                  className={styles.filterOption}
                  onClick={() => { setUserFilter('All'); setIsUserFilterOpen(false); }}
                >
                  All Users
                </div>
                {availableUsers.map(u => (
                  <div 
                    key={u.id} 
                    className={styles.filterOption}
                    onClick={() => { setUserFilter(u.id); setIsUserFilterOpen(false); }}
                  >
                    {u.email}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Filter */}
          <div style={{ position: 'relative' }}>
            <button 
              className={styles.actionBtn}
              onClick={() => { setIsFilterOpen(!isFilterOpen); setIsUserFilterOpen(false); }}
            >
              <Filter size={16} /> {actionFilter === 'All' ? 'Filter Action' : actionFilter}
            </button>
            
            {isFilterOpen && (
              <div className={styles.filterDropdown}>
                {['All', ...ACTION_OPTIONS].map(action => (
                  <div 
                    key={action} 
                    className={styles.filterOption}
                    onClick={() => {
                      setActionFilter(action);
                      setIsFilterOpen(false);
                    }}
                  >
                    {action}
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
              <th>Action</th>
              <th>Details</th>
              <th>Performed By</th>
              <th>Date / Time <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '4px' }} /></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Loading audit logs...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className={styles.tableRow}>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      backgroundColor: log.action.includes('Deleted') || log.action.includes('Reject') ? '#FEE2E2' : log.action.includes('Create') || log.action.includes('Approve') ? '#DEF7EC' : '#F3F4F6',
                      color: log.action.includes('Deleted') || log.action.includes('Reject') ? '#991B1B' : log.action.includes('Create') || log.action.includes('Approve') ? '#065F46' : '#374151'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.details || 'N/A'}</td>
                  <td>{log.performed_by_email || '-'}</td>
                  <td className={styles.date}>{formatDateTime(log.created_at)}</td>
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
          Total {totalCount} logs
        </div>
      </div>
    </div>
  );
};

export default function AuditViewWrapper() {
  return (
    <ErrorBoundary>
      <AuditView />
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: 'red' }}>
          <h1>Something went wrong in AuditView.</h1>
          <pre>{this.state.error?.message}</pre>
          <pre style={{ fontSize: '12px', marginTop: '20px' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
