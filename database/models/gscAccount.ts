import { Table, Model, Column, DataType, PrimaryKey, Index } from 'sequelize-typescript';

@Table({
  timestamps: false,
  tableName: 'gsc_account',
})
class GscAccount extends Model {
  @PrimaryKey
  @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
  ID!: number;

  @Index({ unique: true, name: 'gsc_account_user_google' })
  @Column({ type: DataType.STRING, allowNull: false })
  userId!: string;

  @Index({ unique: true, name: 'gsc_account_user_google' })
  @Column({ type: DataType.STRING, allowNull: false })
  google_sub!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  email!: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  refresh_token!: string;

  @Column({ type: DataType.TEXT, allowNull: true, defaultValue: '' })
  picture!: string;

  @Column({ type: DataType.STRING, allowNull: true, defaultValue: '' })
  connected_at!: string;

  @Column({ type: DataType.STRING, allowNull: true, defaultValue: '' })
  scopes!: string;
}

export default GscAccount;
