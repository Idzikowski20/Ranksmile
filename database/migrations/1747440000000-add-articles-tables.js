// Migration: Adds articles, site_context and publish_targets tables for SEO Autopilot module.

module.exports = {
   up: async (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tables = await queryInterface.showAllTables();

            if (!tables.includes('site_context')) {
               await queryInterface.createTable('site_context', {
                  id: {
                     type: Sequelize.DataTypes.INTEGER,
                     primaryKey: true,
                     autoIncrement: true,
                     allowNull: false,
                  },
                  domain_id: {
                     type: Sequelize.DataTypes.INTEGER,
                     allowNull: false,
                  },
                  url: {
                     type: Sequelize.DataTypes.TEXT,
                     allowNull: false,
                  },
                  title: { type: Sequelize.DataTypes.TEXT },
                  description: { type: Sequelize.DataTypes.TEXT },
                  tone: { type: Sequelize.DataTypes.STRING },
                  language: { type: Sequelize.DataTypes.STRING, defaultValue: 'pl' },
                  topics: { type: Sequelize.DataTypes.TEXT },
                  analyzed_at: { type: Sequelize.DataTypes.DATE },
                  created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
               }, { transaction: t });
            }

            if (!tables.includes('articles')) {
               await queryInterface.createTable('articles', {
                  id: {
                     type: Sequelize.DataTypes.INTEGER,
                     primaryKey: true,
                     autoIncrement: true,
                     allowNull: false,
                  },
                  domain_id: {
                     type: Sequelize.DataTypes.INTEGER,
                     allowNull: false,
                  },
                  title: { type: Sequelize.DataTypes.TEXT, allowNull: false },
                  slug: { type: Sequelize.DataTypes.TEXT },
                  content: { type: Sequelize.DataTypes.TEXT },
                  status: { type: Sequelize.DataTypes.STRING, defaultValue: 'draft' },
                  target_keyword: { type: Sequelize.DataTypes.TEXT },
                  meta_title: { type: Sequelize.DataTypes.TEXT },
                  meta_description: { type: Sequelize.DataTypes.TEXT },
                  meta_url: { type: Sequelize.DataTypes.TEXT },
                  schema_json: { type: Sequelize.DataTypes.TEXT },
                  score_data: { type: Sequelize.DataTypes.TEXT },
                  word_count: { type: Sequelize.DataTypes.INTEGER },
                  published_at: { type: Sequelize.DataTypes.DATE },
                  publish_target: { type: Sequelize.DataTypes.STRING },
                  publish_url: { type: Sequelize.DataTypes.TEXT },
                  scheduled_for: { type: Sequelize.DataTypes.DATE },
                  created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
                  updated_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
               }, { transaction: t });

               await queryInterface.addIndex('articles', ['domain_id'], { transaction: t });
               await queryInterface.addIndex('articles', ['status'], { transaction: t });
               await queryInterface.addIndex('articles', ['scheduled_for'], { transaction: t });
            }

            if (!tables.includes('publish_targets')) {
               await queryInterface.createTable('publish_targets', {
                  id: {
                     type: Sequelize.DataTypes.INTEGER,
                     primaryKey: true,
                     autoIncrement: true,
                     allowNull: false,
                  },
                  domain_id: {
                     type: Sequelize.DataTypes.INTEGER,
                     allowNull: false,
                  },
                  type: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  url: { type: Sequelize.DataTypes.TEXT, allowNull: false },
                  api_key: { type: Sequelize.DataTypes.TEXT },
                  created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
               }, { transaction: t });
            }

         } catch (error) {
            console.log('Articles migration error:', error);
            throw error;
         }
      });
   },

   down: async (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tables = await queryInterface.showAllTables();
            if (tables.includes('publish_targets')) await queryInterface.dropTable('publish_targets', { transaction: t });
            if (tables.includes('articles')) await queryInterface.dropTable('articles', { transaction: t });
            if (tables.includes('site_context')) await queryInterface.dropTable('site_context', { transaction: t });
         } catch (error) {
            console.log('Articles migration rollback error:', error);
         }
      });
   },
};
