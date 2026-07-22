import fs from 'fs';
import path from 'path';
import {
  getPipelineStage,
  isFlowProducerAllowed,
  isWorkerAllowedAtStage,
  parsePipelineStage,
} from '../../lib/pipeline/pipelineStage';
import { resetWorkerRegistry, listWorkers, getWorker } from '../../lib/workers/registry';

jest.mock('../../lib/ensurePipelineJobsTables', () => ({
  ensurePipelineJobsTables: jest.fn(async () => undefined),
  insertPipelineJob: jest.fn(async () => 1),
  findActiveJobByKey: jest.fn(async () => null),
  updatePipelineJob: jest.fn(async () => undefined),
  moveJobToDlq: jest.fn(async () => undefined),
}));

jest.mock('../../lib/pipeline/pipelineQueue', () => {
  class PipelineQueueDisabledError extends Error {
    queue: string;
    stage: string;
    constructor(queue: string, stage: string) {
      super(`disabled ${queue}`);
      this.queue = queue;
      this.stage = stage;
    }
  }
  return {
    enqueueJob: jest.fn(async () => ({
      accepted: true,
      status: 202,
      jobKey: 'x',
      jobId: 1,
      joinedExisting: false,
      queue: 'serp_crawl',
    })),
    PipelineQueueDisabledError,
  };
});

const ROOT = path.join(__dirname, '../..');

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walkTsFiles(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('v7 anti-pattern guards', () => {
  const prevStage = process.env.PIPELINE_STAGE;

  afterEach(() => {
    if (prevStage === undefined) delete process.env.PIPELINE_STAGE;
    else process.env.PIPELINE_STAGE = prevStage;
    resetWorkerRegistry();
  });

  describe('stage gate — not all workers in Etap 0', () => {
    it('defaults to stage 5 (full mode) with all workers', () => {
      delete process.env.PIPELINE_STAGE;
      resetWorkerRegistry();
      expect(getPipelineStage()).toBe('5');
      const ids = listWorkers().map((w) => w.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          'serp',
          'coverage',
          'live_score',
          'ner',
          'planner',
          'fingerprint',
          'diff',
          'embeddings',
        ]),
      );
    });

    it('stage 0 registers only serp, coverage, live_score', () => {
      process.env.PIPELINE_STAGE = '0';
      resetWorkerRegistry();
      expect(getPipelineStage()).toBe('0');
      const ids = listWorkers().map((w) => w.id).sort();
      expect(ids).toEqual(['coverage', 'live_score', 'serp']);
      expect(getWorker('ner')).toBeUndefined();
      expect(getWorker('planner')).toBeUndefined();
      expect(getWorker('embeddings')).toBeUndefined();
    });

    it('unlocks ner at 1.5 and planner at 2', () => {
      expect(isWorkerAllowedAtStage('ner', '1')).toBe(false);
      expect(isWorkerAllowedAtStage('ner', '1.5')).toBe(true);
      expect(isWorkerAllowedAtStage('planner', '1.5')).toBe(false);
      expect(isWorkerAllowedAtStage('planner', '2')).toBe(true);
      expect(isWorkerAllowedAtStage('diff', '2')).toBe(false);
      expect(isWorkerAllowedAtStage('diff', '3')).toBe(true);
      expect(isWorkerAllowedAtStage('embeddings', '4')).toBe(true);
    });

    it('seeds extended workers when PIPELINE_STAGE=2', () => {
      process.env.PIPELINE_STAGE = '2';
      resetWorkerRegistry();
      const ids = listWorkers().map((w) => w.id);
      expect(ids).toEqual(
        expect.arrayContaining(['serp', 'coverage', 'live_score', 'ner', 'planner', 'fingerprint']),
      );
      expect(ids).not.toContain('diff');
      expect(ids).not.toContain('embeddings');
    });
  });

  describe('FlowProducer not for Etap 0 two-step', () => {
    it('isFlowProducerAllowed is false below stage 2', () => {
      expect(isFlowProducerAllowed('0')).toBe(false);
      expect(isFlowProducerAllowed('1.5')).toBe(false);
      expect(isFlowProducerAllowed('2')).toBe(true);
    });

    it('enqueueAnalyzeDag throws below stage 2', async () => {
      process.env.PIPELINE_STAGE = '0';
      resetWorkerRegistry();
      const { enqueueAnalyzeDag, FlowProducerStageError } = await import(
        '../../lib/pipeline/flowProducer'
      );
      await expect(
        enqueueAnalyzeDag({ workspaceId: '1', keyword: 'test' }),
      ).rejects.toBeInstanceOf(FlowProducerStageError);
    });
  });

  describe('Corpus API — workers must not touch corpus tables directly', () => {
    it('workers and pipelineQueue do not SQL serp_corpora', () => {
      const files = [
        ...walkTsFiles(path.join(ROOT, 'lib/workers')),
        path.join(ROOT, 'lib/pipeline/pipelineQueue.ts'),
      ];
      const banned = [/serp_corpora/i, /INSERT\s+INTO\s+serp_/i, /FROM\s+serp_fingerprints/i];
      for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        for (const re of banned) {
          expect({ file: path.relative(ROOT, file), match: re.source, hit: re.test(src) }).toEqual(
            expect.objectContaining({ hit: false }),
          );
        }
      }
    });
  });

  describe('Worker → LLM only via Gateway', () => {
    it('workers do not call OpenAI/Anthropic/DeepSeek directly', () => {
      const files = walkTsFiles(path.join(ROOT, 'lib/workers'));
      const banned = [
        /api\.openai\.com/,
        /api\.deepseek\.com/,
        /api\.anthropic\.com/,
        /@ai-sdk\/deepseek/,
        /from ['"]openai['"]/,
      ];
      for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        for (const re of banned) {
          expect({ file: path.relative(ROOT, file), match: re.source, hit: re.test(src) }).toEqual(
            expect.objectContaining({ hit: false }),
          );
        }
      }
    });
  });

  describe('No Kafka / Temporal / RabbitMQ / Celery', () => {
    it('package.json dependencies exclude forbidden queue stacks', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const forbidden = [
        'kafkajs',
        'kafka-node',
        '@temporalio/client',
        '@temporalio/worker',
        'amqplib',
        'celery',
      ];
      for (const name of forbidden) {
        expect(deps[name]).toBeUndefined();
      }
      expect(deps.bullmq).toBeDefined();
      expect(deps.ioredis).toBeDefined();
    });
  });

  it('parsePipelineStage accepts 2b', () => {
    expect(parsePipelineStage('2b')).toBe('2b');
    expect(isFlowProducerAllowed('2b')).toBe(true);
  });
});
