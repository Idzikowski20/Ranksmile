// Migration: Adds ranking_score and ranking_signals columns to articles table
// for X-Algorithm scoring integration.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (t) => {
      try {
        await queryInterface.addColumn('articles', 'ranking_score', {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: true,
          defaultValue: null,
        }, { transaction: t });

        await queryInterface.addColumn('articles', 'ranking_signals', {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        }, { transaction: t });

        console.log('Added ranking_score and ranking_signals columns to articles');
      } catch (error) {
        console.log('Ranking score columns migration error:', error.message);
        // Columns may already exist — non-fatal
      }
    });
  },

  down: async (queryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      try {
        await queryInterface.removeColumn('articles', 'ranking_signals', { transaction: t });
        await queryInterface.removeColumn('articles', 'ranking_score', { transaction: t });
      } catch (error) {
        console.log('Ranking score columns rollback error:', error.message);
      }
    });
  },
};
