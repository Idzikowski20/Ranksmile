import { Table, Model, Column, DataType, PrimaryKey, Unique } from 'sequelize-typescript';

@Table({
  timestamps: false,
  tableName: 'domain',
})

class Domain extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Unique
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: true, unique: true })
   domain!: string;

   @Unique
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: true, unique: true })
   slug!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   keywordCount!: number;

   @Column({ type: DataType.STRING, allowNull: true })
   lastUpdated!: string;

   @Column({ type: DataType.STRING, allowNull: true })
   added!: string;

   @Column({ type: DataType.STRING, allowNull: true, defaultValue: JSON.stringify([]) })
   tags!: string;

   @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: true })
   notification!: boolean;

   @Column({ type: DataType.STRING, allowNull: true, defaultValue: 'daily' })
   notification_interval!: string;

   @Column({ type: DataType.STRING, allowNull: true, defaultValue: '' })
   notification_emails!: string;

   @Column({ type: DataType.STRING, allowNull: true })
   search_console!: string;

   @Column({ type: DataType.STRING, allowNull: true, defaultValue: '' })
   scrape_strategy!: string;

   @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
   scrape_pagination_limit!: number;

   @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
   scrape_smart_full_fallback!: boolean;

   @Column({ type: DataType.STRING, allowNull: true, defaultValue: '' })
   subdomain_matching!: string;

   @Column({ type: DataType.TEXT, allowNull: true, defaultValue: '' })
   brand_voice!: string;

   // Auth0 user ID — null oznacza domenę "wspólną" (legacy / nie przypisaną)
   @Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
   userId!: string | null;

   // Tenancy scope — FK to workspaces.id (null = unassigned/legacy, pre-tenancy)
   @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
   workspace_id!: number | null;

   // Traffic goal JSON: { percentage, period, startDate, baseClicks }
   @Column({ type: DataType.TEXT, allowNull: true, defaultValue: null })
   traffic_goal!: string | null;
}

export default Domain;
