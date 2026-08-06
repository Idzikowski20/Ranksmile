/**
 * Longest organization name the API will store; the settings form stops typing there too.
 *
 * Kept apart from `lib/organization.ts` because that module imports the Sequelize
 * instance — pulling it into a client component would drag the DB layer into the
 * browser bundle.
 */
const ORG_NAME_MAX_LENGTH = 80;

export default ORG_NAME_MAX_LENGTH;
