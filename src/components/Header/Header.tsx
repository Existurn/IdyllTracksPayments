import { Bell, Clock, Calendar, CalendarDays } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRBAC } from '../../contexts/RBACContext';
import { fetchUserNotifications, clearUserNotifications } from '../../utils/notifications';
import styles from './Header.module.css';

const Header: React.FC = () => {
  const { currentUser } = useRBAC();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [showDate, setShowDate] = useState(true);
  const [showTime, setShowTime] = useState(true);
  const [showDay, setShowDay] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadNotifications = async (uid: string) => {
    try {
      const data = await fetchUserNotifications(uid);
      const unreadOnly = data.filter(n => !n.is_read);
      if (unreadOnly.length > 0) {
        setNotifications(unreadOnly.map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: new Date(n.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        })));
      } else {
        setNotifications([]);
      }
    } catch (e) {
      console.warn('[Header] Error loading notifications:', e);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadNotifications(user.id);

        if (user.user_metadata) {
          if (user.user_metadata.full_name) {
            setUserName(user.user_metadata.full_name);
          } else if (user.email) {
            const parts = user.email.split('@')[0].split(/[._-]/);
            const name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            setUserName(name);
          }
          if (user.user_metadata.time_format) {
            setTimeFormat(user.user_metadata.time_format);
          }
          if (user.user_metadata.show_date !== undefined) setShowDate(user.user_metadata.show_date);
          if (user.user_metadata.show_time !== undefined) setShowTime(user.user_metadata.show_time);
          if (user.user_metadata.show_day !== undefined) setShowDay(user.user_metadata.show_day);
        } else if (user.email) {
          const parts = user.email.split('@')[0].split(/[._-]/);
          const name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          setUserName(name);
        }
      }
    };
    
    fetchUser();
    
    const handleNewNotif = () => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) loadNotifications(user.id);
      });
    };

    window.addEventListener('profile-updated', fetchUser);
    window.addEventListener('new-notification', handleNewNotif);
    return () => {
      window.removeEventListener('profile-updated', fetchUser);
      window.removeEventListener('new-notification', handleNewNotif);
    };
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h'
  }).toUpperCase();

  const day = String(currentTime.getDate()).padStart(2, '0');
  const month = String(currentTime.getMonth() + 1).padStart(2, '0');
  const year = currentTime.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;

  const formattedDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <header className={styles.header}>
      <div className={styles.greeting} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
        <span>Hello, What's up today?</span>
        <strong style={{ marginLeft: '4px' }}>{currentUser?.name || userName}</strong> 
        <img src="/waving-hand.png" alt="Wave" className={styles.wave} style={{ marginLeft: '2px', width: '22px', height: '22px' }} />
      </div>
      
      <div className={styles.actions} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#6B7280', fontSize: '0.9em', fontWeight: '500' }}>
          {showDay && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CalendarDays size={16} />
              <span>{formattedDay}</span>
            </div>
          )}
          {showDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} />
              <span>{formattedDate}</span>
            </div>
          )}
          {showTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} />
              <span>{formattedTime}</span>
            </div>
          )}
        </div>
        
        <div style={{ position: 'relative' }}>
          <button 
            className={styles.iconBtn}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          >
            <Bell size={20} />
            {notifications.length > 0 && <span className={styles.badge}></span>}
          </button>

          {isNotificationsOpen && (
            <>
              <div 
                onClick={() => setIsNotificationsOpen(false)} 
                style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
              />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: '320px', backgroundColor: 'white', border: '1px solid #E5E7EB',
                borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                zIndex: 100, overflow: 'hidden', display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111827' }}>Notifications</h3>
                  {notifications.length > 0 && (
                    <button 
                      onClick={() => {
                        if (userId) clearUserNotifications(userId);
                        setNotifications([]);
                      }}
                      style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
                
                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
                      No new notifications
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                           onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                           onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{notif.title}</span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{notif.time}</span>
                        </div>
                        <span style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.4' }}>{notif.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
