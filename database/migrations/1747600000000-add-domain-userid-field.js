// Migration: Adds userId field to domain table for multi-tenant user isolation.
// Existing domains (userId = NULL) remain visible to all authenticated users.

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const domainTableDefinition = await queryInterface.describeTable('domain');
            if (domainTableDefinition && !domainTableDefinition.userId) {
               await queryInterface.addColumn(
                  'domain',
                  'userId',
                  { type: Sequelize.DataTypes.STRING, allowNull: true, defaultValue: null },
                  { transaction: t },
               );
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   down: (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const domainTableDefinition = await queryInterface.describeTable('domain');
            if (domainTableDefinition && domainTableDefinition.userId) {
               await queryInterface.removeColumn('domain', 'userId', { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
