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
  // if using TypeScript with a baseUrl set to the root directory then you need the below for alias' to work
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@neondatabase/auth/next$': '<rootDir>/__mocks__/neondatabase-auth.ts',
    // `ai` SDK is pure ESM with a heavy provider tree Jest can't load; stub its
    // identity-passthrough `tool()` (see __mocks__/ai.ts).
    '^ai$': '<rootDir>/__mocks__/ai.ts',
    // sequelize's uuid dependency is pure ESM; stub the esm-browser entry
    '^uuid/dist/esm-browser/index\\.js$': '<rootDir>/__mocks__/uuid.js',
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async

module.exports = createJestConfig(customJestConfig);
