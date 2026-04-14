/**
 * Set window.location.search in Jest jsdom without assigning window.location
 * (non-configurable in jsdom 22+).
 *
 * @param {string} search - Query string including leading `?`, or '' to clear
 */
export function setUrlSearch(search) {
  const path = window.location.pathname || '/';
  if (search === '') {
    window.history.replaceState({}, '', path);
    return;
  }
  const qs = search.startsWith('?') ? search : `?${search}`;
  window.history.replaceState({}, '', `${path}${qs}`);
}
