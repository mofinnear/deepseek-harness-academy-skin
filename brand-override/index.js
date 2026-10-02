/**
 * Host half of the local DSH logo override.
 *
 * All presentation lives in the browser half (`./client`), reached through the
 * `dsh.client` manifest field. This half only needs to be a valid Loader seat so
 * `dsh-client-modules` sees the row, scans the `dsh.client` declaration, and
 * serves `/plugins/@local/dsh-logo/client.js`.
 */

/** Stable plugin name for logs. */
export const name = 'local-dsh-logo';

/** No host services: the browser half needs only the slot registry. */
export const inject = [];

/**
 * Announce the override on the host so a successful load is visible in the
 * harness log even before the page reloads.
 */
export function apply() {
  console.log('[local-dsh-logo] brand override plugin mounted (browser half serves /plugins/@local/dsh-logo/client.js)');
}
