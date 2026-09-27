import React from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: React.ReactNode;
  activePage: string;
  onPageChange: (page: string) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, activePage, onPageChange }) => {
  return (
    <div className={styles.appContainer}>
      <Sidebar activePage={activePage} onPageChange={onPageChange} />
      <div className={styles.mainContent}>
        <Header />
        <main className={styles.pageContent}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
