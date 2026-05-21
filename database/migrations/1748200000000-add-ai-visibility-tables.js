// Migration: Adds durable article analysis tables for AI Search visibility.

module.exports = {
   up: async (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         const tables = await queryInterface.showAllTables();

         if (!tables.includes('article_competitors')) {
            await queryInterface.createTable('article_competitors', {
               id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
               article_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
               url: { type: Sequelize.DataTypes.TEXT, allowNull: false },
               domain: { type: Sequelize.DataTypes.TEXT },
               title: { type: Sequelize.DataTypes.TEXT },
               snippet: { type: Sequelize.DataTypes.TEXT },
               word_count: { type: Sequelize.DataTypes.INTEGER },
               heading_count: { type: Sequelize.DataTypes.INTEGER },
               headings_json: { type: Sequelize.DataTypes.TEXT },
               entities_json: { type: Sequelize.DataTypes.TEXT },
               terms_json: { type: Sequelize.DataTypes.TEXT },
               created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
            }, { transaction: t });
            await queryInterface.addIndex('article_competitors', ['article_id'], { transaction: t });
         }

         if (!tables.includes('article_terms')) {
            await queryInterface.createTable('article_terms', {
               id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
               article_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
               term: { type: Sequelize.DataTypes.TEXT, allowNull: false },
               term_type: { type: Sequelize.DataTypes.STRING, defaultValue: 'topic' },
               source: { type: Sequelize.DataTypes.STRING, defaultValue: 'serp' },
               current_count: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
               target_min: { type: Sequelize.DataTypes.INTEGER, defaultValue: 1 },
               target_max: { type: Sequelize.DataTypes.INTEGER, defaultValue: 3 },
               importance: { type: Sequelize.DataTypes.FLOAT, defaultValue: 0 },
               created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
            }, { transaction: t });
            await queryInterface.addIndex('article_terms', ['article_id'], { transaction: t });
         }

         if (!tables.includes('ai_visibility_runs')) {
            await queryInterface.createTable('ai_visibility_runs', {
               id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
               article_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
               target_keyword: { type: Sequelize.DataTypes.TEXT },
               score: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
               prompts_total: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
               prompts_cited: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
               competitor_citations: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
               summary_json: { type: Sequelize.DataTypes.TEXT },
               created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
            }, { transaction: t });
            await queryInterface.addIndex('ai_visibility_runs', ['article_id'], { transaction: t });
         }

         if (!tables.includes('ai_visibility_citations')) {
            await queryInterface.createTable('ai_visibility_citations', {
               id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
               run_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
               prompt: { type: Sequelize.DataTypes.TEXT, allowNull: false },
               answer: { type: Sequelize.DataTypes.TEXT },
               cited_url: { type: Sequelize.DataTypes.TEXT },
               cited_domain: { type: Sequelize.DataTypes.TEXT },
               is_own_domain: { type: Sequelize.DataTypes.BOOLEAN, defaultValue: false },
               is_competitor: { type: Sequelize.DataTypes.BOOLEAN, defaultValue: false },
               sentiment: { type: Sequelize.DataTypes.STRING },
               created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
            }, { transaction: t });
            await queryInterface.addIndex('ai_visibility_citations', ['run_id'], { transaction: t });
         }

         if (!tables.includes('article_versions')) {
            await queryInterface.createTable('article_versions', {
               id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
               article_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
               version_type: { type: Sequelize.DataTypes.STRING, allowNull: false },
               content: { type: Sequelize.DataTypes.TEXT },
               score_data: { type: Sequelize.DataTypes.TEXT },
               created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
            }, { transaction: t });
            await queryInterface.addIndex('article_versions', ['article_id'], { transaction: t });
         }
      });
   },

   down: async (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         const tables = await queryInterface.showAllTables();
         if (tables.includes('article_versions')) await queryInterface.dropTable('article_versions', { transaction: t });
         if (tables.includes('ai_visibility_citations')) await queryInterface.dropTable('ai_visibility_citations', { transaction: t });
         if (tables.includes('ai_visibility_runs')) await queryInterface.dropTable('ai_visibility_runs', { transaction: t });
         if (tables.includes('article_terms')) await queryInterface.dropTable('article_terms', { transaction: t });
         if (tables.includes('article_competitors')) await queryInterface.dropTable('article_competitors', { transaction: t });
      });
   },
};
