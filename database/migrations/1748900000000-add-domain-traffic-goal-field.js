// Migration: Adds traffic_goal JSON field to domain table for storing click growth goals.

module.exports = {
   up: async (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         const tableDescription = await queryInterface.describeTable('domain');
         if (!tableDescription.traffic_goal) {
            await queryInterface.addColumn('domain', 'traffic_goal', {
               type: Sequelize.DataTypes.TEXT,
               allowNull: true,
               defaultValue: null,
            }, { transaction: t });
         }
      });
   },

   down: async (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         const tableDescription = await queryInterface.describeTable('domain');
         if (tableDescription.traffic_goal) {
            await queryInterface.removeColumn('domain', 'traffic_goal', { transaction: t });
         }
      });
   },
};
