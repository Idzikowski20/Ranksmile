const nextJest = require('next/jest');
require('dotenv').config({ path: './.env.local' });

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Git worktrees live inside the repo, so every checked-out branch's copy of
  // every test was being collected and run alongside the real one.
  // testPathIgnorePatterns stops them running; modulePathIgnorePatterns keeps
  // haste-map from indexing them at all, which is what makes each worktree's
  // __mocks__/{ai,data,utils} a "duplicate manual mock" of the real one.
  // Playwright specs under e2e/ are run by Playwright, not Jest — collecting them
  // here only produced ESM import crashes.
  testPathIgnorePatterns: ['/node_modules/', '/\\.next/', '/\\.worktrees/', '/\\.claude/worktrees/', '/e2e/'],
  modulePathIgnorePatterns: ['<rootDir>/\\.worktrees/', '<rootDir>/\\.claude/worktrees/'],
  // if using TypeScript with a baseUrl set to the root directory then you need the below for alias' to work
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // `ai` SDK is pure ESM with a heavy provider tree Jest can't load; stub its
    // identity-passthrough `tool()` (see __mocks__/ai.ts).
    '^ai$': '<rootDir>/__mocks__/ai.ts',
    // Same reason — @ai-sdk provider packages are ESM-only (see __mocks__/@ai-sdk/*).
    '^@ai-sdk/deepseek$': '<rootDir>/__mocks__/@ai-sdk/deepseek.ts',
    '^@ai-sdk/google$': '<rootDir>/__mocks__/@ai-sdk/google.ts',
    // Under jsdom Jest resolves uuid's ESM "browser" export and chokes on its
    // `export` syntax. Pin the CJS build. (Scoped map — a global "node" export
    // condition would break @emotion's React integration.)
    '^uuid$': '<rootDir>/node_modules/uuid/dist/index.js',
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async

module.exports = createJestConfig(customJestConfig);
