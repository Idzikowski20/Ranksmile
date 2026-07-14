import type { Transaction } from 'sequelize';

jest.mock('../../database/database', () => ({
  default: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
}));

import db from '../../database/database';
import { replaceArticleTerms, replaceCompetitors } from '../../lib/articleAnalysisStorage';

type QueryRunner = (
  sql: string,
  options?: { replacements?: unknown[]; transaction?: Transaction },
) => Promise<unknown>;

type TransactionRunner = (
  callback: (transaction: Transaction) => Promise<void>,
) => Promise<void>;

const queryMock = db.query as unknown as jest.MockedFunction<QueryRunner>;
const transactionMock = db.transaction as unknown as jest.MockedFunction<TransactionRunner>;
const transaction = { id: 'tx' } as unknown as Transaction;

describe('articleAnalysisStorage', () => {
  beforeEach(() => {
    queryMock.mockReset();
    transactionMock.mockReset();
    queryMock.mockResolvedValue(undefined);
    transactionMock.mockImplementation(async (callback) => callback(transaction));
  });

  it('clears stale article terms when the replacement list is empty', async () => {
    await replaceArticleTerms(12, [], 'old content');

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith(
      'DELETE FROM article_terms WHERE article_id = ?',
      { replacements: [12], transaction },
    );
  });

  it('propagates term insert failures instead of marking analysis successful', async () => {
    const failure = new Error('insert failed');
    queryMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure);

    await expect(replaceArticleTerms(
      12,
      [{ term: 'critical keyword', target_count: 3 }],
      'critical keyword appears twice: critical keyword',
    )).rejects.toThrow('insert failed');

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][0]).toBe('DELETE FROM article_terms WHERE article_id = ?');
    expect(String(queryMock.mock.calls[1][0])).toContain('INSERT INTO article_terms');
  });

  it('propagates competitor insert failures instead of dropping existing rows silently', async () => {
    const failure = new Error('competitor insert failed');
    queryMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure);

    await expect(replaceCompetitors(12, [{
      url: 'https://example.com/ranking-page',
      domain: 'example.com',
      title: 'Ranking page',
      snippet: 'Competitor snippet',
    }])).rejects.toThrow('competitor insert failed');

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][0]).toBe('DELETE FROM article_competitors WHERE article_id = ?');
    expect(String(queryMock.mock.calls[1][0])).toContain('INSERT INTO article_competitors');
  });
});
