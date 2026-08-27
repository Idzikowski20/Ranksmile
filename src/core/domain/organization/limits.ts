/**
 * Limits shared by the organization API and every form that writes to it.
 *
 * Kept apart from `lib/organization.ts` because that module imports the Sequelize
 * instance — pulling it into a client component would drag the DB layer into the
 * browser bundle.
 */

/** Longest organization name the API will store; the forms stop typing there too. */
const ORG_NAME_MAX_LENGTH = 80;

/**
 * Largest logo a form may accept, in bytes.
 *
 * The picked file is posted as a base64 data URL, which inflates it by ~4/3, so this
 * has to stay comfortably under the route's own `bodyParser.sizeLimit` (6 MB) — at the
 * previous 5 MB cap a 4.6 MB image passed client validation and then failed on submit.
 */
export const ORG_LOGO_MAX_BYTES = 4 * 1024 * 1024;

/** Human-readable form of `ORG_LOGO_MAX_BYTES`, so hints can't drift from the check. */
export const ORG_LOGO_MAX_LABEL = '4 MB';

export default ORG_NAME_MAX_LENGTH;
