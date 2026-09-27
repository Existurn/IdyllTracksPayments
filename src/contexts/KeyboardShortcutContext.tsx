import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export type OperatingSystem = 'mac' | 'windows';

interface KeyboardShortcutContextType {
  os: OperatingSystem;
  setOS: (os: OperatingSystem) => void;
  searchShortcutLabel: string;
  isSearchShortcut: (e: KeyboardEvent | React.KeyboardEvent) => boolean;
}

const STORAGE_KEY = 'idyll_os_preference';

const detectDefaultOS = (): OperatingSystem => {
  if (typeof window === 'undefined') return 'mac';
  try {
    const platform = (
      (navigator as any).userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent ||
      ''
    ).toLowerCase();
    return platform.includes('win') ? 'windows' : 'mac';
  } catch {
    return 'mac';
  }
};

const KeyboardShortcutContext = createContext<KeyboardShortcutContextType | undefined>(undefined);

export const KeyboardShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [os, setOSState] = useState<OperatingSystem>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'mac' || stored === 'windows') {
        return stored;
      }
      return detectDefaultOS();
    }
    return 'mac';
  });

  // Sync with Supabase user metadata on mount / auth state change
  useEffect(() => {
    let isMounted = true;
    const fetchUserOS = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          const remoteOS = user.user_metadata?.os_preference;
          if (remoteOS === 'mac' || remoteOS === 'windows') {
            setOSState(remoteOS);
            localStorage.setItem(STORAGE_KEY, remoteOS);
          }
        }
      } catch (err) {
        console.error('Error fetching OS preference:', err);
      }
    };

    fetchUserOS();
    return () => {
      isMounted = false;
    };
  }, []);

  const setOS = useCallback(async (newOS: OperatingSystem) => {
    setOSState(newOS);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newOS);
    }
    try {
      await supabase.auth.updateUser({
        data: { os_preference: newOS }
      });
    } catch (err) {
      console.error('Error updating OS preference in user metadata:', err);
    }
  }, []);

  const searchShortcutLabel = os === 'mac' ? '⌘K' : 'Ctrl + K';

  const isSearchShortcut = useCallback((e: KeyboardEvent | React.KeyboardEvent) => {
    const key = e.key?.toLowerCase();
    if (key !== 'k') return false;

    if (os === 'mac') {
      // Must use Command (metaKey) and not Ctrl
      return Boolean(e.metaKey && !e.ctrlKey && !e.altKey);
    } else {
      // Must use Ctrl (ctrlKey) and not Command/Meta
      return Boolean(e.ctrlKey && !e.metaKey && !e.altKey);
    }
  }, [os]);

  return (
    <KeyboardShortcutContext.Provider
      value={{
        os,
        setOS,
        searchShortcutLabel,
        isSearchShortcut
      }}
    >
      {children}
    </KeyboardShortcutContext.Provider>
  );
};

export const useKeyboardShortcut = (): KeyboardShortcutContextType => {
  const context = useContext(KeyboardShortcutContext);
  if (!context) {
    throw new Error('useKeyboardShortcut must be used within a KeyboardShortcutProvider');
  }
  return context;
};
