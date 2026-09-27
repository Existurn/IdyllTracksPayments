import React from 'react';
import styles from './DancingDotsLoader.module.css';

interface DancingDotsLoaderProps {
  size?: number;
  color?: string;
  gap?: number;
  borderRadius?: number | string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export const DancingDotsLoader: React.FC<DancingDotsLoaderProps> = ({
  size = 8,
  color = '#000000',
  gap = 6,
  borderRadius = '2px',
  className = '',
  style = {},
  ariaLabel = 'Loading...',
}) => {
  const dotStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    backgroundColor: color,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
  };

  return (
    <div
      className={`${styles.loaderWrapper} ${className}`}
      style={{ gap: `${gap}px`, ...style }}
      role="status"
      aria-label={ariaLabel}
    >
      <span className={styles.dot} style={dotStyle} />
      <span className={styles.dot} style={dotStyle} />
      <span className={styles.dot} style={dotStyle} />
    </div>
  );
};

export default DancingDotsLoader;
