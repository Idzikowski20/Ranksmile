// eslint-disable-next-line no-unused-vars
import 'isomorphic-fetch';
import './styles/globals.css';
import '@testing-library/jest-dom';
import { enableFetchMocks } from 'jest-fetch-mock';
// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom

if (typeof window !== 'undefined') {
   window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
   });
}

global.ResizeObserver = require('resize-observer-polyfill');

// jsdom's AbortSignal lacks the static timeout() (Node 17.3+/browsers have it);
// lib fetch calls pass `signal: AbortSignal.timeout(ms)` for hang protection.
if (typeof AbortSignal.timeout !== 'function') {
   AbortSignal.timeout = (ms) => {
      const c = new AbortController();
      setTimeout(() => c.abort(new Error(`TimeoutError: ${ms}ms`)), ms);
      return c.signal;
   };
}

// Enable Fetch Mocking
enableFetchMocks();
