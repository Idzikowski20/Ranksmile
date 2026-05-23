import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

@Table({
  timestamps: true,
  tableName: 'article_keywords',
})
class ArticleKeyword extends Model {
  @PrimaryKey
  @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  article_id!: number;

  @Column({ type: DataType.STRING, allowNull: false })
  keyword!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  gsc_volume_range!: string | null;

  @Column({ type: DataType.DECIMAL(5, 2), allowNull: true })
  gsc_position!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  ads_monthly_volume!: number | null;

  @Column({ type: DataType.STRING, allowNull: true })
  ads_competition!: string | null;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: true })
  ads_cpc!: number | null;

  @Column({ type: DataType.DECIMAL(3, 2), allowNull: true })
  relevance_score!: number | null;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_covered!: boolean;

  @Column({ type: DataType.STRING, defaultValue: 'gsc' })
  source!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  uid!: string;
}

export default ArticleKeyword;
