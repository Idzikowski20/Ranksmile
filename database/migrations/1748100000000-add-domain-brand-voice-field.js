// Migration: Adds brand_voice field to domain table for AI prompt personalisation.

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tableDefinition = await queryInterface.describeTable('domain');
            if (tableDefinition && !tableDefinition.brand_voice) {
               await queryInterface.addColumn(
                  'domain',
                  'brand_voice',
                  { type: Sequelize.DataTypes.TEXT, allowNull: true, defaultValue: '' },
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
            const tableDefinition = await queryInterface.describeTable('domain');
            if (tableDefinition && tableDefinition.brand_voice) {
               await queryInterface.removeColumn('domain', 'brand_voice', { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
