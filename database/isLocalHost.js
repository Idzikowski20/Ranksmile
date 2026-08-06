/**
 * Shared local-database check for the Sequelize runtime connection (`database.ts`),
 * the sequelize-cli migration config (`config.js`) and the local auth server.
 *
 * CommonJS on purpose: `config.js` is loaded by sequelize-cli through plain `require`.
 *
 * Only Neon needs SSL — a local Postgres (docker or the embedded dev cluster) serves
 * no certificate and rejects the connection outright when `ssl.require` is set.
 */

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  // WHATWG `URL` keeps the brackets on IPv6 hosts; `::1` is accepted too for callers
  // that pass a bare hostname rather than one parsed out of a DSN.
  '[::1]',
  '::1',
]);

/**
 * @param {string} raw connection string
 * @returns {boolean} true when the DSN points at this machine
 */
function isLocalPostgresUrl(raw) {
  try {
    const { hostname } = new URL(raw);
    return LOCAL_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

module.exports = { isLocalPostgresUrl };
