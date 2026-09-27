/**
 * Utility functions for user profile pictures and fallback initials.
 */

/**
 * Returns the uppercase first letter of the user's first name only.
 * If full name is provided (e.g. "Harsh Verma"), it extracts "Harsh" and returns "H".
 * If only email is provided (e.g. "harsh98901@gmail.com"), it extracts "Harsh" and returns "H".
 */
export const getFirstLetterOfFirstName = (name?: string | null, email?: string | null): string => {
  if (name && name.trim()) {
    // Split by whitespace to extract first name
    const firstName = name.trim().split(/[\s,]+/)[0];
    if (firstName && firstName.length > 0) {
      const match = firstName.match(/[a-zA-Z0-9]/);
      if (match) {
        return match[0].toUpperCase();
      }
      return firstName.charAt(0).toUpperCase();
    }
  }

  if (email && email.trim()) {
    const localPart = email.trim().split('@')[0];
    const firstWord = localPart.split(/[._-]/)[0];
    if (firstWord && firstWord.length > 0) {
      const match = firstWord.match(/[a-zA-Z0-9]/);
      if (match) {
        return match[0].toUpperCase();
      }
      return firstWord.charAt(0).toUpperCase();
    }
    return localPart.charAt(0).toUpperCase();
  }

  return 'U';
};

export const isAvatarExplicitlyRemoved = (user: any): boolean => {
  if (!user) return false;
  return Boolean(user.user_metadata?.avatar_removed === true && !user.user_metadata?.avatar_url);
};

/**
 * Checks if the user authenticated using Google.
 */
export const isGoogleAccount = (user: any): boolean => {
  if (!user) return false;
  return Boolean(
    user.app_metadata?.provider === 'google' ||
    user.app_metadata?.providers?.includes('google') ||
    user.identities?.some((i: any) => i.provider === 'google')
  );
};

/**
 * Extracts Google account profile picture from Supabase user metadata or identities,
 * even if currently removed (for re-fetching purposes).
 */
export const extractGoogleAvatarUrl = (user: any, sessionUser?: any): string => {
  const u = user || sessionUser;
  if (!u) return '';

  // 1. Permanent cache in user_metadata
  if (u.user_metadata?.google_avatar_url) {
    return u.user_metadata.google_avatar_url;
  }
  if (sessionUser?.user_metadata?.google_avatar_url) {
    return sessionUser.user_metadata.google_avatar_url;
  }

  // 2. Identity data from Google provider
  const googleIdentity = 
    u.identities?.find((i: any) => i.provider === 'google') ||
    sessionUser?.identities?.find((i: any) => i.provider === 'google');

  if (googleIdentity?.identity_data?.avatar_url) {
    return googleIdentity.identity_data.avatar_url;
  }
  if (googleIdentity?.identity_data?.picture) {
    return googleIdentity.identity_data.picture;
  }

  // 3. User metadata picture (standard Google OAuth claim)
  if (u.user_metadata?.picture) {
    return u.user_metadata.picture;
  }
  if (sessionUser?.user_metadata?.picture) {
    return sessionUser.user_metadata.picture;
  }

  // 4. Fallback: if avatar_url contains Google user content CDN
  if (typeof u.user_metadata?.avatar_url === 'string' && u.user_metadata.avatar_url.includes('googleusercontent.com')) {
    return u.user_metadata.avatar_url;
  }
  if (typeof sessionUser?.user_metadata?.avatar_url === 'string' && sessionUser.user_metadata.avatar_url.includes('googleusercontent.com')) {
    return sessionUser.user_metadata.avatar_url;
  }

  return '';
};

/**
 * Extracts Google account profile picture from Supabase user metadata or identities.
 * Returns empty if avatar was explicitly removed.
 */
export const getGoogleAvatarUrl = (user: any): string => {
  if (!user) return '';
  if (isAvatarExplicitlyRemoved(user)) return '';
  return extractGoogleAvatarUrl(user);
};
