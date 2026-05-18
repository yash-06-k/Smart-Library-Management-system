const SESSION_USER_KEY = 'SLMS_SESSION_USER';

export function setSessionUser(user) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user) {
    clearSessionUser();
    return;
  }

  try {
    sessionStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({
        _id: user._id || '',
        firebase_uid: user.firebase_uid || '',
        email: user.email || '',
        role: user.role || '',
      })
    );
  } catch {
    // Ignore storage errors to keep auth flow non-blocking.
  }
}

export function clearSessionUser() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(SESSION_USER_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function getSessionUser() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getSessionUserRole() {
  return getSessionUser()?.role || '';
}

export function isLibrarianSession() {
  return getSessionUserRole() === 'librarian';
}
