import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, Clock, FileText, FileBadge, ArrowRight, Sparkles, Calendar, ChevronDown, Check } from 'lucide-react';
import NotificationCarousel from './NotificationCarousel';
import WelcomeTourModal from './WelcomeTourModal';
import styles from './Dashboard.module.css';
import { supabase } from '../../lib/supabaseClient';
import { fetchUserKyc, type KycRecord } from '../../utils/kycService';

interface PeriodOption {
  key: string;
  label: string;
  months: { name: string; monthIndex: number; yearOffset: number }[];
}

const PERIOD_OPTIONS: PeriodOption[] = [
  {
    key: 'H1',
    label: 'First 6 Months (Jan – Jun)',
    months: [
      { name: 'Jan', monthIndex: 0, yearOffset: 0 },
      { name: 'Feb', monthIndex: 1, yearOffset: 0 },
      { name: 'Mar', monthIndex: 2, yearOffset: 0 },
      { name: 'Apr', monthIndex: 3, yearOffset: 0 },
      { name: 'May', monthIndex: 4, yearOffset: 0 },
      { name: 'Jun', monthIndex: 5, yearOffset: 0 },
    ]
  },
  {
    key: 'H2',
    label: 'Second 6 Months (Jul – Dec)',
    months: [
      { name: 'Jul', monthIndex: 6, yearOffset: 0 },
      { name: 'Aug', monthIndex: 7, yearOffset: 0 },
      { name: 'Sep', monthIndex: 8, yearOffset: 0 },
      { name: 'Oct', monthIndex: 9, yearOffset: 0 },
      { name: 'Nov', monthIndex: 10, yearOffset: 0 },
      { name: 'Dec', monthIndex: 11, yearOffset: 0 },
    ]
  }
];

const getInvoiceDate = (inv: any): { year: number; month: number } | null => {
  const dateValue = inv.payment_date || inv.due_date || inv.created_at || inv.invoice_data?.date;
  if (!dateValue) return null;

  if (typeof dateValue === 'string') {
    const isoMatch = dateValue.match(/^(\d{4})-(\d{2})/);
    if (isoMatch) {
      return {
        year: parseInt(isoMatch[1], 10),
        month: parseInt(isoMatch[2], 10) - 1
      };
    }
    const dmyMatch = dateValue.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (dmyMatch) {
      return {
        year: parseInt(dmyMatch[3], 10),
        month: parseInt(dmyMatch[2], 10) - 1
      };
    }
  }

  const d = new Date(dateValue);
  if (!isNaN(d.getTime())) {
    return {
      year: d.getFullYear(),
      month: d.getMonth()
    };
  }

  return null;
};

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const [loading, setLoading] = useState(true);
  
  // Real data state
  const [metrics, setMetrics] = useState({ totalInvoicesCount: 0, paid: 0, pending: 0 });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [userInvoices, setUserInvoices] = useState<any[]>([]);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(() => {
    return new Date().getMonth() < 6 ? 'H1' : 'H2';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [kycRecord, setKycRecord] = useState<KycRecord | null>(null);
  const [isKycRequested, setIsKycRequested] = useState(false);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const selectedPeriod = useMemo(() => {
    return PERIOD_OPTIONS.find(p => p.key === selectedPeriodKey) || PERIOD_OPTIONS[1];
  }, [selectedPeriodKey]);

  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return selectedPeriod.months.map(m => {
      const targetMonth = m.monthIndex;
      const targetYear = currentYear + (m.yearOffset || 0);

      let earnings = 0;
      userInvoices.forEach(inv => {
        if (inv.status?.toLowerCase() === 'paid') {
          const d = getInvoiceDate(inv);
          if (d && d.month === targetMonth) {
            if (d.year === targetYear || !d.year || Math.abs(d.year - targetYear) === 0) {
              earnings += Number(inv.amount) || 0;
            }
          }
        }
      });

      return {
        name: m.name,
        earnings
      };
    });
  }, [selectedPeriod, userInvoices]);

  const periodTotal = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.earnings, 0);
  }, [chartData]);

  const yAxisConfig = useMemo(() => {
    const maxVal = Math.max(...chartData.map(d => d.earnings), 0);
    if (maxVal <= 100000) {
      return {
        domain: [0, 100000],
        ticks: [0, 20000, 40000, 60000, 80000, 100000]
      };
    }
    const ceiling = Math.ceil(maxVal / 50000) * 50000;
    const step = ceiling / 5;
    return {
      domain: [0, ceiling],
      ticks: [0, step, step * 2, step * 3, step * 4, ceiling]
    };
  }, [chartData]);

  useEffect(() => {
    let currentUid: string | null = null;

    const checkKyc = async (uid: string) => {
      try {
        const { record } = await fetchUserKyc(uid);
        setKycRecord(record);
        const requested = record?.status === 'Requested' || record?.status === 'Action Required' || record?.status === 'Resubmission Required';
        setIsKycRequested(Boolean(requested));
      } catch (err) {
        console.warn('[Dashboard] Error checking KYC status:', err);
      }
    };

    const checkProfileStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const meta = user.user_metadata || {};
          const hasDisplayName = Boolean(meta.full_name && meta.full_name.trim());
          const hasFullName = Boolean(meta.legal_full_name && meta.legal_full_name.trim());

          // Profile is incomplete if either Display Name or Full Name is missing
          const incomplete = !hasDisplayName || !hasFullName;
          setIsProfileIncomplete(incomplete);
        }
      } catch (err) {
        console.warn('[Dashboard] Error checking profile status:', err);
      }
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        currentUid = user.id;
        checkKyc(user.id);
        checkProfileStatus();
      }
    });

    const handleKycStatusUpdate = () => {
      if (currentUid) {
        checkKyc(currentUid);
      } else {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            currentUid = user.id;
            checkKyc(user.id);
          }
        });
      }
    };

    const handleProfileUpdate = () => {
      checkProfileStatus();
    };

    try {
      const hasSeenTour = localStorage.getItem('has_seen_welcome_tour');
      if (!hasSeenTour) {
        setShowWelcomeTour(true);
      }
    } catch {
      // ignore localStorage restrictions
    }

    const handleOpenTour = () => setShowWelcomeTour(true);
    window.addEventListener('open-welcome-tour', handleOpenTour);

    window.addEventListener('kyc-status-updated', handleKycStatusUpdate);
    window.addEventListener('profile-updated', handleProfileUpdate);

    const kycChannel = supabase
      .channel('dashboard-kyc-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_records' }, () => {
        handleKycStatusUpdate();
      })
      .subscribe();

    return () => {
      window.removeEventListener('kyc-status-updated', handleKycStatusUpdate);
      window.removeEventListener('profile-updated', handleProfileUpdate);
      window.removeEventListener('open-welcome-tour', handleOpenTour);
      supabase.removeChannel(kycChannel);
    };
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's invoices (created by or owned by the logged in user)
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .or(`creator_id.eq.${user.id},owner_id.eq.${user.id}`)
        .neq('is_deleted', true)
        .order('created_at', { ascending: false });

      let fetchedInvoices: any[] = invoices || [];
      if (error) {
        // Fallback client-filtered query
        const { data: allData } = await supabase
          .from('invoices')
          .select('*')
          .neq('is_deleted', true)
          .order('created_at', { ascending: false });
        fetchedInvoices = (allData || []).filter(
          (inv: any) => (inv.creator_id && inv.creator_id === user.id) || (inv.owner_id && inv.owner_id === user.id)
        );
      }

      // Calculate Metrics
      let paid = 0;
      let pending = 0;
      const totalInvoicesCount = fetchedInvoices.length;

      fetchedInvoices.forEach((inv: any) => {
        const amount = Number(inv.amount) || 0;
        const statusLower = (inv.status || '').toLowerCase();
        if (statusLower === 'paid') {
          paid += amount;
        } else if (statusLower === 'pending' || statusLower === 'in process') {
          pending += amount;
        }
      });

      setUserInvoices(fetchedInvoices);

      setMetrics({
        totalInvoicesCount,
        paid,
        pending
      });

      // Recent Payments (top 5)
      setRecentPayments(fetchedInvoices.slice(0, 5));
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Automatically update chart whenever an invoice is added, updated, or marked as Paid
    const subscription = supabase
      .channel('public:dashboard_invoices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const handleUpdate = () => {
      fetchDashboardData();
    };
    window.addEventListener('invoices-updated', handleUpdate);

    return () => {
      supabase.removeChannel(subscription);
      window.removeEventListener('invoices-updated', handleUpdate);
    };
  }, [fetchDashboardData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    // Handle YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <style>{`
          .skeleton {
            background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
            background-size: 200% 100%;
            animation: pulse 1.5s infinite linear;
            border-radius: 8px;
          }
          @keyframes pulse {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>

        <section className={styles.metricsGrid}>
          {[1, 2, 3].map(i => (
            <div key={i} className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <div className="skeleton" style={{ width: '100px', height: '20px' }}></div>
                <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '50%' }}></div>
              </div>
              <div className="skeleton" style={{ width: '60px', height: '36px', marginTop: '16px' }}></div>
            </div>
          ))}
        </section>

        <section className={styles.chartSection}>
          <div className="skeleton" style={{ width: '180px', height: '24px', marginBottom: '24px' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '320px' }}></div>
        </section>

        <section className={styles.recentPaymentsSection}>
          <div className="skeleton" style={{ width: '150px', height: '24px', marginBottom: '24px' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '200px' }}></div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <NotificationCarousel />

      {isProfileIncomplete && (
        <div className={styles.welcomeBannerCard}>
          <div className={styles.welcomeBannerLeft}>
            <div className={styles.welcomeBannerTextContent}>
              <div className={styles.welcomeBannerHeaderRow}>
                <span className={styles.welcomeBannerTitle}>
                  Welcome to Idyll Track Payments
                </span>
              </div>
              <p className={styles.welcomeBannerMessage}>
                Please complete your profile settings to get started. Your Display Name and Full Name are required to complete your account setup and access the platform.
              </p>
            </div>
          </div>
          <div className={styles.welcomeBannerAction}>
            <button 
              type="button" 
              className={styles.welcomeBannerButton}
              onClick={() => onPageChange?.('settings')}
            >
              <span>Complete Profile Settings</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {isKycRequested && (
        <div className={styles.kycBannerCard}>
          <div className={styles.kycBannerLeft}>
            <div className={styles.kycBannerIconWrapper}>
              <FileBadge size={22} className={styles.kycBannerIcon} />
            </div>
            <div className={styles.kycBannerTextContent}>
              <div className={styles.kycBannerHeaderRow}>
                <span className={styles.kycBannerTitle}>
                  {kycRecord?.status === 'Action Required'
                    ? 'KYC Action Required by Finance Team'
                    : kycRecord?.status === 'Resubmission Required'
                    ? 'KYC Resubmission Requested by Finance Team'
                    : 'KYC Requested by the Finance Team'}
                </span>
                <span className={styles.kycBannerTag}>Action Required</span>
              </div>
              <p className={styles.kycBannerMessage}>
                {kycRecord?.status === 'Action Required'
                  ? 'The finance team has flagged an action item on your identity verification. Please review and update your KYC.'
                  : kycRecord?.status === 'Resubmission Required'
                  ? 'The finance team has requested a document resubmission. Please upload an updated Aadhaar card copy to proceed.'
                  : 'Identity verification has been requested by the finance team. Please complete your KYC verification to continue processing payments without interruption.'}
              </p>
            </div>
          </div>
          <div className={styles.kycBannerAction}>
            <button 
              type="button" 
              className={styles.kycBannerButton}
              onClick={() => onPageChange?.('kyc')}
            >
              <span>Go to KYC Page</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <h3 className={styles.metricTitle}>Total Invoices</h3>
            <FileText size={24} className={styles.metricIcon} />
          </div>
          <p className={styles.metricValue}>{metrics.totalInvoicesCount}</p>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <h3 className={styles.metricTitle}>Total Earnings</h3>
            <Wallet size={24} className={styles.metricIcon} />
          </div>
          <p className={styles.metricValue}>{formatCurrency(metrics.paid)}</p>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <h3 className={styles.metricTitle}>Pending Amount</h3>
            <Clock size={24} className={styles.metricIcon} />
          </div>
          <p className={styles.metricValue}>{formatCurrency(metrics.pending)}</p>
        </div>
      </section>

      <section className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h2 className={styles.sectionTitle}>Earnings Overview (Paid)</h2>
            <div className={styles.chartSummaryBadge}>
              <span className={styles.chartSummaryLabel}>Period Total:</span>
              <span className={styles.chartSummaryValue}>{formatCurrency(periodTotal)}</span>
            </div>
          </div>

          <div className={styles.customDropdownContainer} ref={dropdownRef}>
            <button
              type="button"
              className={`${styles.customDropdownTrigger} ${isDropdownOpen ? styles.customDropdownTriggerActive : ''}`}
              onClick={() => setIsDropdownOpen(prev => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
            >
              <Calendar size={15} className={styles.calendarIcon} />
              <span className={styles.dropdownSelectedLabel}>{selectedPeriod.label}</span>
              <ChevronDown 
                size={14} 
                className={`${styles.selectorChevron} ${isDropdownOpen ? styles.selectorChevronRotated : ''}`} 
              />
            </button>

            {isDropdownOpen && (
              <div className={styles.customDropdownMenu} role="listbox">
                {PERIOD_OPTIONS.map(opt => {
                  const isSelected = opt.key === selectedPeriodKey;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`${styles.customDropdownItem} ${isSelected ? styles.customDropdownItemActive : ''}`}
                      onClick={() => {
                        setSelectedPeriodKey(opt.key);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <span className={styles.dropdownItemLabel}>{opt.label}</span>
                      {isSelected && <Check size={14} className={styles.dropdownCheckIcon} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 10 }} barSize={44}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light, #E5E7EB)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-secondary, #6B7280)', fontSize: 13, fontWeight: 500 }} 
                dy={10} 
              />
              <YAxis 
                domain={yAxisConfig.domain}
                ticks={yAxisConfig.ticks}
                width={85}
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-secondary, #6B7280)', fontSize: 12 }} 
                dx={-6} 
                tickFormatter={(val) => val === 0 ? '₹0' : `₹${val.toLocaleString('en-IN')}`}
              />
              <Tooltip 
                cursor={{ fill: 'var(--bg-hover, rgba(0, 0, 0, 0.04))' }}
                contentStyle={{ 
                  backgroundColor: 'var(--bg-surface, #FFFFFF)', 
                  color: 'var(--text-primary, #111827)', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-default, #E5E7EB)', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                  padding: '8px 14px' 
                }}
                itemStyle={{ color: 'var(--text-primary, #111827)', fontWeight: 600 }}
                labelStyle={{ color: 'var(--text-secondary, #6B7280)', marginBottom: '4px' }}
                formatter={(value: any) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, 'Paid Amount']}
              />
              <Bar dataKey="earnings" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.earnings > 0 ? "var(--text-primary, #111827)" : "transparent"} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={styles.paymentsSection}>
        <h2 className={styles.sectionTitle}>Recent Payments</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Invoice Name</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                    No recent payments found.
                  </td>
                </tr>
              ) : (
                recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className={styles.projectCell}>{payment.invoice_no || 'N/A'}</td>
                    <td className={styles.amountCell}>{formatCurrency(payment.amount)}</td>
                    <td className={styles.dateCell}>{formatDate(payment.due_date || payment.created_at)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${payment.status === 'Paid' ? styles.statusPaid : (payment.status === 'Pending' || payment.status === 'In Process' ? styles.statusPending : '')}`}>
                        <span className={styles.statusDot}></span>
                        {payment.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {recentPayments.length > 0 && (
          <div className={styles.viewAllContainer}>
            <button className={styles.viewAllBtn} onClick={() => { window.history.pushState(null, '', '/payments'); window.dispatchEvent(new PopStateEvent('popstate')); }}>View All Payments</button>
          </div>
        )}
      </section>

      {/* Welcome Tour Modal */}
      <WelcomeTourModal 
        isOpen={showWelcomeTour} 
        onClose={() => setShowWelcomeTour(false)} 
      />
    </div>
  );
};

export default Dashboard;
