import React, { useState, useEffect } from 'react';
import { Lottie } from 'lottie-react';
import { supabase } from '../../lib/supabaseClient';
import notificationBellAnimation from '../../assets/notification-bell.json';
import { 
  fetchActiveGeneralNotifications, 
  type GeneralNotification 
} from '../../utils/notifications';
import styles from './NotificationCarousel.module.css';

export const NotificationCarousel: React.FC = () => {
  const [notifications, setNotifications] = useState<GeneralNotification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const loadActive = async () => {
      const active = await fetchActiveGeneralNotifications();
      setNotifications(active);
    };

    loadActive();

    // 1. Listen for immediate local updates (when published/edited in Notifications Management)
    const handleUpdate = () => {
      loadActive();
    };
    window.addEventListener('general-notifications-updated', handleUpdate);

    // 2. Real-time Supabase postgres_changes subscription
    const channel = supabase
      .channel('public:general_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'general_notifications' }, () => {
        loadActive();
      })
      .subscribe();

    // 3. Periodic fallback poll every 15s to automatically transition scheduled/expired notifications
    const pollTimer = setInterval(loadActive, 15000);

    return () => {
      window.removeEventListener('general-notifications-updated', handleUpdate);
      supabase.removeChannel(channel);
      clearInterval(pollTimer);
    };
  }, []);

  // 10-second sequential cycling if multiple notifications exist
  useEffect(() => {
    if (notifications.length <= 1) return;

    const cycleTimer = setInterval(() => {
      // 1. Trigger fade out
      setIsFading(true);

      // 2. Switch index and fade in after 500ms
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % notifications.length);
        setIsFading(false);
      }, 500);
    }, 10000); // 10 seconds display time

    return () => clearInterval(cycleTimer);
  }, [notifications.length]);

  if (notifications.length === 0) {
    return null;
  }

  const current = notifications[currentIndex] || notifications[0];

  return (
    <div className={styles.carouselWrapper}>
      <div className={styles.bannerCard}>
        <div className={styles.bannerLeft}>
          <div className={styles.bellIconWrapper}>
            <Lottie 
              src={notificationBellAnimation}
              autoplay
              loop
              style={{ width: 44, height: 44 }}
            />
          </div>

          <div className={`${styles.textContent} ${isFading ? styles.fadeOut : styles.fadeIn}`}>
            <span className={styles.title}>{current.title}</span>
            <p className={styles.message}>{current.message}</p>
          </div>
        </div>

        {notifications.length > 1 && (
          <div className={styles.indicators}>
            {notifications.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`${styles.dot} ${idx === currentIndex ? styles.activeDot : ''}`}
                onClick={() => {
                  setIsFading(true);
                  setTimeout(() => {
                    setCurrentIndex(idx);
                    setIsFading(false);
                  }, 300);
                }}
                title={`Notification ${idx + 1}`}
              />
            ))}
            <span className={styles.counterBadge}>
              {currentIndex + 1}/{notifications.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCarousel;
