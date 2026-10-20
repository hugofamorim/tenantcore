export function navigateAfterAuth(path: "/account" | "/login") {
  // Cookie changes through the API proxy do not invalidate Next's Router Cache.
  window.location.replace(path);
}
