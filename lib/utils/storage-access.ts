// Some browser configurations (Chrome private/incognito with strict site
// settings, some enterprise policies) deny access to sessionStorage and
// localStorage entirely — reading/writing throws SecurityError instead of
// just being empty. Supabase's browser client needs this storage to manage
// auth sessions, so we check up front and show the user what to do instead
// of letting the app crash.
export function isWebStorageAccessible(): boolean {
  try {
    const testKey = '__zenju_storage_test__'
    window.sessionStorage.setItem(testKey, '1')
    window.sessionStorage.removeItem(testKey)
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

export function isChrome(): boolean {
  const ua = window.navigator.userAgent
  return /Chrome/.test(ua) && !/Edg|OPR|Brave/.test(ua)
}
