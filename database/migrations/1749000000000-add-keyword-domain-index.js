// Migration: index keyword.domain — the primary filter for nearly every keyword read
// (dashboard, refresh, notify, search console). Without it each listing full-scans the
// keyword table, which grows with total keywords across all tenants.

module.exports = {
   up: (queryInterface) => queryInterface.sequelize.transaction(async (t) => {
      try {
         await queryInterface.addIndex('keyword', ['domain'], { name: 'idx_keyword_domain', transaction: t });
      } catch (error) {
         console.log('error :', error);
      }
   }),
   down: (queryInterface) => queryInterface.sequelize.transaction(async (t) => {
      try {
         await queryInterface.removeIndex('keyword', 'idx_keyword_domain', { transaction: t });
      } catch (error) {
         console.log('error :', error);
      }
   }),
};
