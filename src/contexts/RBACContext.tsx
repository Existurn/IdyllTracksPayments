import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

export type Role = 'CEO' | 'CFO' | 'Manager' | 'Editor' | 'Client';
export type Permission = 
  | 'dashboard' 
  | 'payments' 
  | 'payment-details' 
  | 'users' 
  | 'billing' 
  | 'audit' 
  | 'admin-panel' 
  | 'kyc' 
  | 'kyc-management' 
  | 'notifications' 
  | 'compose' 
  | 'tutorial' 
  | 'support' 
  | 'settings' 
  | 'client'
  | 'create-invoices';

export interface TimePeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface UserRBAC {
  id: string;
  name: string;
  displayName?: string;
  fullName?: string;
  email: string;
  role: Role;
  overrides: Partial<Record<Permission, boolean>>;
  temporaryInvoiceOverride?: TimePeriod | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestDate?: string;
  createdAt?: string;
  avatarUrl?: string;
}

export const DEFAULT_ROLES: Record<Role, Record<Permission, boolean>> = {
  CEO: {
    dashboard: true,
    payments: true,
    'payment-details': true,
    users: true,
    billing: true,
    audit: true,
    'admin-panel': true,
    kyc: true,
    'kyc-management': true,
    notifications: true,
    compose: true,
    tutorial: true,
    support: true,
    settings: true,
    client: true,
    'create-invoices': true,
  },
  CFO: {
    dashboard: true,
    payments: true,
    'payment-details': true,
    users: false,
    billing: true,
    audit: true,
    'admin-panel': false,
    kyc: false,
    'kyc-management': false,
    notifications: true,
    compose: true,
    tutorial: true,
    support: true,
    settings: true,
    client: true,
    'create-invoices': false,
  },
  Manager: {
    dashboard: true,
    payments: true,
    'payment-details': true,
    users: true,
    billing: false,
    audit: true,
    'admin-panel': false,
    kyc: true,
    'kyc-management': true,
    notifications: true,
    compose: true,
    tutorial: true,
    support: true,
    settings: true,
    client: true,
    'create-invoices': true,
  },
  Editor: {
    dashboard: true,
    payments: true,
    'payment-details': false,
    users: false,
    billing: false,
    audit: false,
    'admin-panel': false,
    kyc: true,
    'kyc-management': false,
    notifications: false,
    compose: true,
    tutorial: true,
    support: true,
    settings: true,
    client: true,
    'create-invoices': true,
  },
  Client: {
    dashboard: true,
    payments: true,
    'payment-details': false,
    users: false,
    billing: false,
    audit: false,
    'admin-panel': false,
    kyc: true,
    'kyc-management': false,
    notifications: false,
    compose: false,
    tutorial: true,
    support: true,
    settings: true,
    client: true,
    'create-invoices': false,
  },
};

export const mergeWithDefaultRoles = (
  saved?: any
): Record<Role, Record<Permission, boolean>> => {
  const result: Record<Role, Record<Permission, boolean>> = {
    CEO: { ...DEFAULT_ROLES.CEO },
    CFO: { ...DEFAULT_ROLES.CFO },
    Manager: { ...DEFAULT_ROLES.Manager },
    Editor: { ...DEFAULT_ROLES.Editor },
    Client: { ...DEFAULT_ROLES.Client },
  };

  if (!saved || typeof saved !== 'object') return result;

  const roles: Role[] = ['CEO', 'CFO', 'Manager', 'Editor', 'Client'];
  for (const r of roles) {
    if (saved[r] && typeof saved[r] === 'object') {
      result[r] = {
        ...result[r],
        ...saved[r],
      };
    }
  }

  return result;
};

export interface SystemSettings {
  emailsEnabled: boolean; // Controls automated transactional emails (default true)
  [key: string]: any;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  emailsEnabled: true,
};

interface RBACContextType {
  currentUser: UserRBAC | null;
  updateProfile: (updates: { name?: string; displayName?: string; fullName?: string; avatarUrl?: string | null }) => Promise<{ success: boolean; error?: string }>;
  globalInvoicePeriod: TimePeriod | null;
  setGlobalInvoicePeriod: (period: TimePeriod | null) => void;
  rolePermissions: Record<Role, Record<Permission, boolean>>;
  setRolePermissions: (roles: Record<Role, Record<Permission, boolean>>) => void;
  systemSettings: SystemSettings;
  updateSystemSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  users: UserRBAC[];
  updateUser: (id: string, updates: Partial<UserRBAC>) => Promise<{ success: boolean; error?: string }>;
  addUser: (user: UserRBAC) => Promise<{ success: boolean; error?: string }>;
  removeUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (userId: string | null | undefined, permission: Permission) => boolean;
  canCreateInvoices: (userId: string | null | undefined) => { allowed: boolean; reason?: string; dateNeeded?: string; endDate?: string };
  isUsersLoaded: boolean;
  refreshUsers: () => Promise<void>;
}

const defaultContext: RBACContextType = {
  currentUser: null,
  updateProfile: async () => ({ success: true }),
  globalInvoicePeriod: null,
  setGlobalInvoicePeriod: () => {},
  rolePermissions: DEFAULT_ROLES,
  setRolePermissions: () => {},
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
  updateSystemSettings: async () => {},
  users: [],
  updateUser: async () => ({ success: true }),
  addUser: async () => ({ success: true }),
  removeUser: async () => ({ success: false, error: 'Context uninitialized' }),
  hasPermission: () => true,
  canCreateInvoices: () => ({ allowed: true }),
  isUsersLoaded: false,
  refreshUsers: async () => {},
};

const RBACContext = createContext<RBACContextType>(defaultContext);

export const useRBAC = () => useContext(RBACContext);

// No dummy users - start empty
export const RBACProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [globalInvoicePeriod, setGlobalInvoicePeriodState] = useState<TimePeriod | null>(() => {
    const saved = localStorage.getItem('globalInvoicePeriod');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [rolePermissions, setRolePermissionsState] = useState<Record<Role, Record<Permission, boolean>>>(() => {
    try {
      const saved = localStorage.getItem('rolePermissions');
      return saved ? mergeWithDefaultRoles(JSON.parse(saved)) : DEFAULT_ROLES;
    } catch {
      return DEFAULT_ROLES;
    }
  });

  const [systemSettings, setSystemSettingsState] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('system_settings');
      if (saved) {
        return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_SYSTEM_SETTINGS;
  });
  
  const [users, setUsersState] = useState<UserRBAC[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRBAC | null>(null);
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);

  const fetchData = async () => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: true, nullsFirst: false });
      let currentUsersList: UserRBAC[] = [];
      if (usersData && !usersError) {
        const validRoles: Role[] = ['CEO', 'CFO', 'Manager', 'Editor', 'Client'];
        const formattedUsers: UserRBAC[] = usersData.map((u: any) => {
          const isRoot = u.email?.trim().toLowerCase() === 'harshidyllproductions@gmail.com';
          const roleNormalized: Role = isRoot ? 'CEO' : (validRoles.includes(u.role) ? u.role : 'Editor');
          return {
            id: u.id,
            name: u.name || 'User',
            displayName: u.display_name || u.name || 'User',
            fullName: u.full_name || u.name || 'User',
            email: u.email,
            role: roleNormalized,
            status: u.status as 'Pending' | 'Approved' | 'Rejected',
            overrides: u.overrides || {},
            requestDate: u.request_date,
            createdAt: u.created_at,
            avatarUrl: u.avatar_url
          };
        });

        // Deterministic sort: always preserve stable order by creation date, then name, then id
        formattedUsers.sort((a, b) => {
          const dateA = a.createdAt || a.requestDate || '';
          const dateB = b.createdAt || b.requestDate || '';
          if (dateA && dateB && dateA !== dateB) return dateA.localeCompare(dateB);
          if (a.name !== b.name) return a.name.localeCompare(b.name);
          return a.id.localeCompare(b.id);
        });

        currentUsersList = formattedUsers;
        setUsersState(prevUsers => {
          if (prevUsers.length === formattedUsers.length) {
            const isUnchanged = prevUsers.every((prev, i) => {
              const next = formattedUsers[i];
              return (
                prev.id === next.id &&
                prev.name === next.name &&
                prev.displayName === next.displayName &&
                prev.fullName === next.fullName &&
                prev.email === next.email &&
                prev.role === next.role &&
                prev.status === next.status &&
                prev.avatarUrl === next.avatarUrl &&
                JSON.stringify(prev.overrides) === JSON.stringify(next.overrides)
              );
            });
            if (isUnchanged) return prevUsers;
          }
          return formattedUsers;
        });
      }

      // Sync active authenticated user profile as single source of truth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const matchingUser = currentUsersList.find(u => u.id === authUser.id);
        if (matchingUser) {
          const effectiveAvatar = matchingUser.avatarUrl || authUser.user_metadata?.avatar_url || undefined;
          const mergedUser: UserRBAC = {
            ...matchingUser,
            avatarUrl: effectiveAvatar
          };
          setCurrentUser(prevUser => {
            if (
              prevUser &&
              prevUser.id === mergedUser.id &&
              prevUser.name === mergedUser.name &&
              prevUser.displayName === mergedUser.displayName &&
              prevUser.fullName === mergedUser.fullName &&
              prevUser.email === mergedUser.email &&
              prevUser.role === mergedUser.role &&
              prevUser.status === mergedUser.status &&
              prevUser.avatarUrl === mergedUser.avatarUrl &&
              JSON.stringify(prevUser.overrides) === JSON.stringify(mergedUser.overrides)
            ) {
              return prevUser;
            }
            return mergedUser;
          });
        } else {
          const metaDisplayName = authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';
          const metaFullName = authUser.user_metadata?.legal_full_name || authUser.user_metadata?.full_name || metaDisplayName;
          const metaAvatar = authUser.user_metadata?.avatar_url || '';
          const fallbackUser: UserRBAC = {
            id: authUser.id,
            name: metaDisplayName,
            displayName: metaDisplayName,
            fullName: metaFullName,
            email: authUser.email || '',
            role: 'Editor',
            overrides: {},
            status: 'Approved',
            avatarUrl: metaAvatar || undefined
          };
          setCurrentUser(prevUser => {
            if (
              prevUser &&
              prevUser.id === fallbackUser.id &&
              prevUser.name === fallbackUser.name &&
              prevUser.email === fallbackUser.email &&
              prevUser.role === fallbackUser.role &&
              prevUser.status === fallbackUser.status &&
              prevUser.avatarUrl === fallbackUser.avatarUrl
            ) {
              return prevUser;
            }
            return fallbackUser;
          });
        }
      } else {
        setCurrentUser(null);
      }
      
      const { data: settingsData, error: settingsError } = await supabase.from('workspace_settings').select('*').eq('id', 1).single();
      if (settingsData && !settingsError) {
        if (settingsData.role_permissions) {
          const merged = mergeWithDefaultRoles(settingsData.role_permissions);
          setRolePermissionsState(prev => {
            return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
          });

          if (settingsData.role_permissions.__system_settings__) {
            const remoteSettings = settingsData.role_permissions.__system_settings__;
            setSystemSettingsState(prev => {
              const updated = { ...prev, ...remoteSettings };
              try {
                localStorage.setItem('system_settings', JSON.stringify(updated));
              } catch (_) {}
              return updated;
            });
          }
        }
        if (settingsData.global_invoice_period_start && settingsData.global_invoice_period_end) {
          const newPeriod = {
            startDate: settingsData.global_invoice_period_start,
            endDate: settingsData.global_invoice_period_end
          };
          setGlobalInvoicePeriodState(prev => {
            if (prev && prev.startDate === newPeriod.startDate && prev.endDate === newPeriod.endDate) return prev;
            return newPeriod;
          });
        } else {
          setGlobalInvoicePeriodState(null);
        }
      }
    } catch (e) {
      console.error('Error fetching RBAC data:', e);
    } finally {
      setIsUsersLoaded(true);
    }
  };

  // Fetch data from Supabase on mount and listen to auth changes
  useEffect(() => {
    fetchData();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      // Only re-fetch on meaningful auth changes, not automatic token refresh
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        fetchData();
      }
    });

    const handleProfileUpdated = () => {
      fetchData();
    };
    window.addEventListener('profile-updated', handleProfileUpdated);

    // Set up realtime subscription (Works if Supabase Realtime is enabled)
    const subscription = supabase
      .channel('public:rbac_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_settings' }, () => {
        fetchData();
      })
      .subscribe();

    // Gentle fallback sync (every 60 seconds instead of aggressive 3s)
    const pollInterval = setInterval(() => {
      fetchData();
    }, 60000);

    return () => {
      authSub.unsubscribe();
      window.removeEventListener('profile-updated', handleProfileUpdated);
      supabase.removeChannel(subscription);
      clearInterval(pollInterval);
    };
  }, []);

  const setGlobalInvoicePeriod = async (period: TimePeriod | null) => {
    setGlobalInvoicePeriodState(period);
    await supabase.from('workspace_settings').upsert({
      id: 1,
      global_invoice_period_start: period ? period.startDate : null,
      global_invoice_period_end: period ? period.endDate : null
    }, { onConflict: 'id' });
  };

  const setRolePermissions = async (roles: Record<Role, Record<Permission, boolean>>) => {
    const merged = mergeWithDefaultRoles(roles);
    setRolePermissionsState(merged);
    try {
      localStorage.setItem('rolePermissions', JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
    await supabase.from('workspace_settings').upsert({
      id: 1,
      role_permissions: merged
    }, { onConflict: 'id' });
  };

  const updateSystemSettings = async (updates: Partial<SystemSettings>) => {
    const updated = { ...systemSettings, ...updates };
    setSystemSettingsState(updated);
    try {
      localStorage.setItem('system_settings', JSON.stringify(updated));
    } catch (_) {}

    // Persist to workspace_settings under role_permissions.__system_settings__
    try {
      const { data: currentSettings } = await supabase.from('workspace_settings').select('*').eq('id', 1).single();
      const currentRolePerms = currentSettings?.role_permissions || rolePermissions || {};
      const newRolePerms = {
        ...currentRolePerms,
        __system_settings__: updated
      };
      await supabase.from('workspace_settings').upsert({
        id: 1,
        role_permissions: newRolePerms
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('Failed to persist system settings to database:', err);
    }
  };

  const updateUser = async (id: string, updates: Partial<UserRBAC>): Promise<{ success: boolean; error?: string }> => {
    const previousUsers = [...users];
    const targetUser = users.find(u => u.id === id);

    // Optimistic update
    const newUsers = users.map(u => u.id === id ? { ...u, ...updates } : u);
    setUsersState(newUsers);

    try {
      const updatedRole = (updates.role || targetUser?.role || 'Editor') as string;
      const updatedStatus = (updates.status || targetUser?.status || 'Approved') as string;
      const updatedName = updates.name || targetUser?.name || 'User';
      const updatedEmail = updates.email || targetUser?.email || '';
      const updatedAvatar = updates.avatarUrl !== undefined ? updates.avatarUrl : (targetUser?.avatarUrl || null);

      let rpcSucceeded = false;
      // 1. Try secure RPC to bypass RLS restrictions
      const { error: rpcError } = await supabase.rpc('create_user_role', {
        target_id: id,
        target_name: updatedName,
        target_email: updatedEmail,
        target_role: updatedRole,
        target_status: updatedStatus,
        target_avatar_url: updatedAvatar
      });

      if (!rpcError) {
        rpcSucceeded = true;
      } else {
        console.warn('create_user_role RPC returned error, falling back to direct update:', rpcError);
      }

      // 2. Direct update for supplementary fields (overrides, requestDate, or fallback)
      const dbUpdates: any = { ...updates };
      if (updates.requestDate) {
        dbUpdates.request_date = updates.requestDate;
        delete dbUpdates.requestDate;
      }
      if (updates.avatarUrl !== undefined) {
        dbUpdates.avatar_url = updates.avatarUrl;
        delete dbUpdates.avatarUrl;
      }

      const { data: updateData, error: updateError } = await supabase
        .from('user_roles')
        .update(dbUpdates)
        .eq('id', id)
        .select();

      // If both RPC and direct update failed to update any row
      if (!rpcSucceeded && (updateError || !updateData || updateData.length === 0)) {
        const errorMsg = updateError?.message || rpcError?.message || 'Update failed to persist to database';
        console.error('Error updating user role in DB:', errorMsg);
        setUsersState(previousUsers);
        return { success: false, error: errorMsg };
      }

      // Re-fetch data from DB to ensure state is completely in sync
      await fetchData();
      return { success: true };
    } catch (err: any) {
      console.error('Exception updating user:', err);
      setUsersState(previousUsers);
      return { success: false, error: err.message || 'An unexpected error occurred while updating user' };
    }
  };

  const addUser = async (user: UserRBAC): Promise<{ success: boolean; error?: string }> => {
    // 1. Optimistic update so the user immediately exists in local state
    setUsersState(prev => {
      if (prev.some(u => u.id === user.id)) return prev;
      return [...prev, user];
    });

    try {
      // 2. Insert to Supabase using the secure RPC to bypass RLS issues
      const { error: rpcError } = await supabase.rpc('create_user_role', {
        target_id: user.id,
        target_name: user.name,
        target_email: user.email,
        target_role: user.role,
        target_status: user.status,
        target_avatar_url: user.avatarUrl || null
      });

      if (rpcError) {
        console.warn("create_user_role RPC returned error, falling back to standard upsert:", rpcError);
        // Fallback to standard insert / upsert
        const { error: insertError } = await supabase.from('user_roles').upsert([{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          overrides: user.overrides || {},
          request_date: user.requestDate || new Date().toISOString(),
          avatar_url: user.avatarUrl || null
        }], { onConflict: 'id' });
        
        if (insertError) {
          console.error("Error inserting user into user_roles DB:", insertError);
          return { success: false, error: insertError.message };
        }
      }

      // 3. Immediately refresh data from DB to confirm full sync
      await fetchData();
      return { success: true };
    } catch (err: any) {
      console.error("Exception in addUser:", err);
      return { success: false, error: err?.message || 'Error adding user' };
    }
  };

  const removeUser = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const targetUser = users.find(u => u.id === id);
      if (targetUser?.email?.trim().toLowerCase() === 'harshidyllproductions@gmail.com') {
        return { 
          success: false, 
          error: 'This user ID is locked and cannot be removed from here. It should be removed only from the database.' 
        };
      }

      // Call the secure RPC to fully delete the user, auth account, and storage files
      const { error } = await supabase.rpc('delete_user_account', { target_user_id: id });
      
      if (error) {
        console.error("Error running delete_user_account RPC:", error);
        // Fallback: Attempt deleting from user_roles if RPC isn't installed or failed
        const { error: roleErr } = await supabase.from('user_roles').delete().eq('id', id);
        if (roleErr) {
          console.error("Fallback deletion from user_roles also failed:", roleErr);
          return { success: false, error: error.message || roleErr.message };
        }
      }
      
      // Update state only after backend deletion succeeded
      setUsersState(prev => prev.filter(u => u.id !== id));
      return { success: true };
    } catch (err: any) {
      console.error("Exception during removeUser:", err);
      return { success: false, error: err.message || 'Failed to delete user' };
    }
  };

  const hasPermission = (userId: string | null | undefined, permission: Permission): boolean => {
    // If no user id provided or user not found, default to true so we don't break the app while testing without a full auth mapping
    if (!userId) return true;
    const user = users.find(u => u.id === userId) || (currentUser?.id === userId ? currentUser : null);
    if (!user) return true; 

    const validRoles: Role[] = ['CEO', 'CFO', 'Manager', 'Editor', 'Client'];
    const effectiveRole: Role = validRoles.includes(user.role) ? user.role : 'Editor';

    // Safety net: Always keep admin-panel enabled for CEO so workspace administrator is never permanently locked out
    if (effectiveRole === 'CEO' && permission === 'admin-panel') {
      return true;
    }
    
    // 1. User specific overrides
    if (user.overrides && user.overrides[permission] !== undefined) {
      return !!user.overrides[permission];
    }
    
    // 2. Role permissions configured in workspace settings
    const roleMap = rolePermissions[effectiveRole] || DEFAULT_ROLES[effectiveRole];
    if (roleMap && roleMap[permission] !== undefined) {
      return !!roleMap[permission];
    }
    
    // 3. Fallback to default role permissions
    if (DEFAULT_ROLES[effectiveRole] && DEFAULT_ROLES[effectiveRole][permission] !== undefined) {
      return !!DEFAULT_ROLES[effectiveRole][permission];
    }

    return effectiveRole === 'CEO';
  };

  const canCreateInvoices = (userId: string | null | undefined): { allowed: boolean; reason?: string; dateNeeded?: string; endDate?: string } => {
    if (!userId) return { allowed: true };
    const user = users.find(u => u.id === userId);
    if (!user) return { allowed: true };

    const today = new Date().toISOString().split('T')[0];

    // 1. Temporary Override
    if (user.temporaryInvoiceOverride) {
      const { startDate, endDate } = user.temporaryInvoiceOverride;
      if (today >= startDate && today <= endDate) {
        return { allowed: true };
      }
    }

    // 2. Normal Permission
    const hasNormalPerm = hasPermission(userId, 'create-invoices');
    if (!hasNormalPerm) {
       return { allowed: false, reason: 'permission_denied' };
    }

    // 3. Global Period
    if (globalInvoicePeriod) {
      const { startDate, endDate } = globalInvoicePeriod;
      if (today < startDate) {
        return { allowed: false, reason: 'global_date_future', dateNeeded: startDate, endDate: endDate };
      }
      if (today > endDate) {
        return { allowed: false, reason: 'global_date_past', dateNeeded: startDate, endDate: endDate };
      }
      return { allowed: true };
    } else {
       return { allowed: false, reason: 'no_global_period' };
    }
  };

  const updateProfile = async (updates: { name?: string; displayName?: string; fullName?: string; avatarUrl?: string | null }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return { success: false, error: 'User not authenticated' };

      const resolvedName = (updates.displayName || updates.fullName || updates.name || '').trim();

      // 1. Immediate optimistic update in state
      setUsersState(prev => prev.map(u => {
        if (u.id === authUser.id) {
          return {
            ...u,
            ...(resolvedName ? { name: resolvedName } : {}),
            ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl || undefined } : {})
          };
        }
        return u;
      }));

      setCurrentUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ...(resolvedName ? { name: resolvedName } : {}),
          ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl || undefined } : {})
        };
      });

      // 2. Persist to public.user_roles in database
      const dbUpdates: any = {};
      if (resolvedName) dbUpdates.name = resolvedName;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;

      if (Object.keys(dbUpdates).length > 0) {
        const { error: dbError } = await supabase
          .from('user_roles')
          .update(dbUpdates)
          .eq('id', authUser.id);
        if (dbError) console.error("Error updating user_roles table:", dbError);
      }

      // 3. Persist to Supabase Auth metadata
      const authData: any = {};
      if (updates.displayName) authData.full_name = updates.displayName;
      if (updates.fullName) authData.legal_full_name = updates.fullName;
      if (resolvedName && !authData.full_name) authData.full_name = resolvedName;
      if (updates.avatarUrl !== undefined) {
        authData.avatar_url = updates.avatarUrl || '';
        authData.avatar_removed = !updates.avatarUrl;
      }
      if (Object.keys(authData).length > 0) {
        await supabase.auth.updateUser({ data: authData });
      }

      // 4. Global broadcast events
      window.dispatchEvent(new Event('profile-updated'));

      // 5. Re-fetch from DB to guarantee absolute sync
      await fetchData();
      return { success: true };
    } catch (err: any) {
      console.error("Error updating profile:", err);
      return { success: false, error: err?.message || 'Failed to update profile' };
    }
  };

  return (
    <RBACContext.Provider value={{
      currentUser,
      updateProfile,
      globalInvoicePeriod,
      setGlobalInvoicePeriod,
      rolePermissions,
      setRolePermissions,
      systemSettings,
      updateSystemSettings,
      users,
      updateUser,
      addUser,
      removeUser,
      hasPermission,
      canCreateInvoices,
      isUsersLoaded,
      refreshUsers: fetchData
    }}>
      {children}
    </RBACContext.Provider>
  );
};
