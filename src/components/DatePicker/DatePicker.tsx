import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import styles from './DatePicker.module.css';

interface DatePickerProps {
  date?: Date;
  onSelect: (date: Date | undefined) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ date, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState<Date>(date || new Date());
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;

    const triggerRect = wrapperRef.current.getBoundingClientRect();
    const popoverEl = popoverRef.current;
    const popoverWidth = popoverEl?.offsetWidth || 340;
    const popoverHeight = popoverEl?.offsetHeight || 340;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const margin = 16; // Consistent margin from screen edges

    // Check available space on both sides
    const spaceRight = viewportWidth - triggerRect.left - margin;
    const spaceLeft = triggerRect.right - margin;

    let targetLeft: number;

    // Determine direction:
    // If opening to the right fits AND opening to the left does not fit
    if (spaceRight >= popoverWidth && spaceLeft < popoverWidth) {
      targetLeft = triggerRect.left;
    }
    // If opening to the right does NOT fit, but opening to the left fits
    else if (spaceRight < popoverWidth && spaceLeft >= popoverWidth) {
      targetLeft = triggerRect.right - popoverWidth;
    }
    // If both directions have sufficient space
    else if (spaceRight >= popoverWidth && spaceLeft >= popoverWidth) {
      // If the trigger button is closer to the right side of the screen,
      // open toward the left to maintain ideal distance from screen edge
      if (triggerRect.left + triggerRect.width / 2 > viewportWidth / 2) {
        targetLeft = triggerRect.right - popoverWidth;
      } else {
        targetLeft = triggerRect.left;
      }
    }
    // If neither fits completely (narrow screens, small mobile/tablet viewports, high browser zoom levels)
    else {
      // Align to whichever side gives more space
      if (spaceLeft >= spaceRight) {
        targetLeft = triggerRect.right - popoverWidth;
      } else {
        targetLeft = triggerRect.left;
      }
    }

    // Clamp strictly within viewport boundaries with consistent margin
    const minLeft = margin;
    const maxLeft = Math.max(margin, viewportWidth - margin - popoverWidth);
    targetLeft = Math.max(minLeft, Math.min(targetLeft, maxLeft));

    // Convert to relative coordinate inside .wrapper
    const relativeLeft = targetLeft - triggerRect.left;

    // Check vertical available space
    const spaceBelow = viewportHeight - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;
    const openAbove = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    setPopoverStyle({
      left: `${relativeLeft}px`,
      right: 'auto',
      top: openAbove ? 'auto' : 'calc(100% + 8px)',
      bottom: openAbove ? 'calc(100% + 8px)' : 'auto',
      maxWidth: `calc(100vw - ${margin * 2}px)`,
    });
  }, []);

  // Update positioning when opening or on resize/scroll
  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleWindowChange = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    const rafId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      cancelAnimationFrame(rafId);
    };
  }, [isOpen, updatePosition, month]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    if (!isOpen && wrapperRef.current) {
      // Calculate immediate initial placement to eliminate any possible render flash
      const triggerRect = wrapperRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const margin = 16;
      const popoverWidth = 340;

      const spaceRight = viewportWidth - triggerRect.left - margin;
      const spaceLeft = triggerRect.right - margin;

      let targetLeft: number;
      if (spaceRight >= popoverWidth && spaceLeft < popoverWidth) {
        targetLeft = triggerRect.left;
      } else if (spaceRight < popoverWidth && spaceLeft >= popoverWidth) {
        targetLeft = triggerRect.right - popoverWidth;
      } else if (spaceRight >= popoverWidth && spaceLeft >= popoverWidth) {
        targetLeft = (triggerRect.left + triggerRect.width / 2 > viewportWidth / 2)
          ? triggerRect.right - popoverWidth
          : triggerRect.left;
      } else {
        targetLeft = spaceLeft >= spaceRight
          ? triggerRect.right - popoverWidth
          : triggerRect.left;
      }

      const minLeft = margin;
      const maxLeft = Math.max(margin, viewportWidth - margin - popoverWidth);
      targetLeft = Math.max(minLeft, Math.min(targetLeft, maxLeft));

      setPopoverStyle({
        left: `${targetLeft - triggerRect.left}px`,
        right: 'auto',
        top: 'calc(100% + 8px)',
        bottom: 'auto',
        maxWidth: `calc(100vw - ${margin * 2}px)`,
      });
    }
    setIsOpen(!isOpen);
  };

  const handleClear = () => {
    onSelect(undefined);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    onSelect(today);
    setMonth(today);
    setIsOpen(false);
  };

  const formattedDate = date ? format(date, 'EEE, d MMMM yyyy') : 'Select date';

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button 
        className={styles.triggerBtn} 
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <CalendarIcon size={16} className={styles.icon} />
        <span>{formattedDate}</span>
      </button>

      {isOpen && (
        <div ref={popoverRef} className={styles.popover} style={popoverStyle}>
          <DayPicker
            mode="single"
            selected={date}
            onSelect={(d) => {
              onSelect(d);
              setIsOpen(false);
            }}
            month={month}
            onMonthChange={setMonth}
            showOutsideDays
            className={styles.calendar}
          />
          <div className={styles.footer}>
            <button className={styles.footerBtn} onClick={handleClear}>Clear</button>
            <button className={styles.footerBtn} onClick={handleToday}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
