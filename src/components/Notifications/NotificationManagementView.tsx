import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  PlusCircle, 
  Calendar, 
  Clock, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { 
  fetchAllGeneralNotifications, 
  createGeneralNotification, 
  updateGeneralNotification,
  deleteGeneralNotification, 
  type GeneralNotification 
} from '../../utils/notifications';
import { showToast } from '../../utils/notifications';
import styles from './NotificationManagementView.module.css';

export const NotificationManagementView: React.FC = () => {
  const [notifications, setNotifications] = useState<GeneralNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const getInitialFormState = () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekDate = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;

    return {
      title: '',
      message: '',
      startDate: today,
      startTime: currentTime,
      endDate: nextWeekDate,
      endTime: '23:59'
    };
  };

  const [formData, setFormData] = useState(getInitialFormState());

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAllGeneralNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('[Notifications] Error loading list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      showToast('Title and Message are required.');
      return;
    }

    const startAt = new Date(`${formData.startDate}T${formData.startTime}`);
    const endAt = new Date(`${formData.endDate}T${formData.endTime}`);

    if (endAt <= startAt) {
      showToast('End Date and Time must be after Start Date and Time.');
      return;
    }

    setPublishing(true);
    try {
      const result = await createGeneralNotification(formData);
      if (!result.success) {
        showToast(result.error || 'Failed to publish notification.');
        return;
      }

      showToast('Notification published successfully.');
      window.dispatchEvent(new CustomEvent('general-notifications-updated'));
      setFormData(getInitialFormState());
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error publishing notification');
    } finally {
      setPublishing(false);
    }
  };

  const handleReactivate = async (notif: GeneralNotification) => {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nextWeekDate = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;

      const result = await updateGeneralNotification(notif.id, {
        startDate: today,
        startTime: currentTime,
        endDate: nextWeekDate,
        endTime: '23:59'
      });

      if (!result.success) {
        showToast(result.error || 'Failed to re-activate notification.');
        return;
      }

      showToast('Notification re-activated! Now live on Dashboard.');
      window.dispatchEvent(new CustomEvent('general-notifications-updated'));
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error re-activating');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteGeneralNotification(id);
      if (!result.success) {
        showToast(result.error || 'Failed to delete notification.');
        return;
      }
      showToast('Notification removed.');
      window.dispatchEvent(new CustomEvent('general-notifications-updated'));
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting');
    }
  };

  const now = new Date();

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Notifications Management</h1>
        <p className={styles.subtitle}>
          Create and schedule general dashboard announcements with automated start and expiration times.
        </p>
      </div>

      <div className={styles.layoutGrid}>
        {/* Create / Schedule Notification Form */}
        <div className={styles.formCard}>
          <h2 className={styles.formHeading}>Publish Dashboard Notification</h2>
          <form onSubmit={handlePublish} className={styles.form}>
            {/* Title */}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="title">
                Title <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                className={styles.input}
                placeholder="e.g., Scheduled Maintenance"
                value={formData.title}
                onChange={handleChange}
              />
            </div>

            {/* Message */}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="message">
                Message <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                className={styles.textarea}
                placeholder="Write the notification message to display on user dashboards..."
                value={formData.message}
                onChange={handleChange}
              />
            </div>

            {/* Start Date & Time */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Start Date & Time</label>
              <div className={styles.dateTimeRow}>
                <input
                  type="date"
                  name="startDate"
                  required
                  className={styles.input}
                  value={formData.startDate}
                  onChange={handleChange}
                />
                <input
                  type="time"
                  name="startTime"
                  required
                  className={styles.input}
                  value={formData.startTime}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* End Date & Time */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>End Date & Time (Expiration)</label>
              <div className={styles.dateTimeRow}>
                <input
                  type="date"
                  name="endDate"
                  required
                  className={styles.input}
                  value={formData.endDate}
                  onChange={handleChange}
                />
                <input
                  type="time"
                  name="endTime"
                  required
                  className={styles.input}
                  value={formData.endTime}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.publishBtn}
              disabled={publishing}
            >
              <PlusCircle size={16} />
              {publishing ? 'Publishing...' : 'Save / Publish Notification'}
            </button>
          </form>
        </div>

        {/* Existing Notifications List */}
        <div className={styles.listCard}>
          <div className={styles.listHeader}>
            <h2 className={styles.listHeading}>Broadcast History ({notifications.length})</h2>
          </div>

          <div className={styles.itemsContainer}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.emptyList}>
                <Bell size={36} strokeWidth={1.5} color="#9CA3AF" />
                <p style={{ margin: '12px 0 0 0', fontWeight: 500, color: '#111827' }}>
                  No notifications created yet
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                  Notifications you publish will appear here and cycle sequentially on the Dashboard.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const startAt = new Date(notif.start_at);
                const endAt = new Date(notif.end_at);
                const isActive = now >= startAt && now <= endAt;
                const isScheduled = now < startAt;
                const isExpired = now > endAt;

                return (
                  <div key={notif.id} className={styles.notifItem}>
                    <div className={styles.notifContent}>
                      <div className={styles.notifHeaderRow}>
                        <span className={styles.notifTitle}>{notif.title}</span>
                        {isActive && (
                          <span className={`${styles.statusPill} ${styles.activePill}`}>
                            Active
                          </span>
                        )}
                        {isScheduled && (
                          <span className={`${styles.statusPill} ${styles.scheduledPill}`}>
                            Scheduled
                          </span>
                        )}
                        {isExpired && (
                          <span className={`${styles.statusPill} ${styles.expiredPill}`}>
                            Expired
                          </span>
                        )}
                      </div>

                      <p className={styles.notifMessage}>{notif.message}</p>

                      <div className={styles.notifTimeframe}>
                        <Calendar size={13} />
                        <span>
                          {startAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                          {startAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {' — '}
                          {endAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                          {endAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {isExpired && (
                        <button
                          type="button"
                          className={styles.reactivateBtn}
                          onClick={() => handleReactivate(notif)}
                          title="Re-activate this notification for the next 7 days"
                        >
                          <RefreshCw size={12} />
                          Re-activate (+7 days)
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(notif.id)}
                        title="Delete Notification"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationManagementView;
