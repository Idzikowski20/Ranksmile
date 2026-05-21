// Migration: Stores Google Search Console OAuth accounts per Neon Auth user.

module.exports = {
   up: async (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         const tables = await queryInterface.showAllTables();

         if (!tables.includes('gsc_account')) {
            await queryInterface.createTable('gsc_account', {
               ID: {
                  type: Sequelize.DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
                  allowNull: false,
               },
               userId: {
                  type: Sequelize.DataTypes.STRING,
                  allowNull: false,
               },
               google_sub: {
                  type: Sequelize.DataTypes.STRING,
                  allowNull: false,
               },
               email: {
                  type: Sequelize.DataTypes.STRING,
                  allowNull: false,
               },
               refresh_token: {
                  type: Sequelize.DataTypes.TEXT,
                  allowNull: false,
               },
               picture: {
                  type: Sequelize.DataTypes.TEXT,
                  allowNull: true,
                  defaultValue: '',
               },
               connected_at: {
                  type: Sequelize.DataTypes.STRING,
                  allowNull: true,
                  defaultValue: '',
               },
               scopes: {
                  type: Sequelize.DataTypes.STRING,
                  allowNull: true,
                  defaultValue: '',
               },
            }, { transaction: t });

            await queryInterface.addIndex('gsc_account', ['userId'], { transaction: t });
            await queryInterface.addIndex('gsc_account', ['userId', 'google_sub'], { unique: true, transaction: t });
         }
      });
   },

   down: async (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         const tables = await queryInterface.showAllTables();
         if (tables.includes('gsc_account')) await queryInterface.dropTable('gsc_account', { transaction: t });
      });
   },
};
