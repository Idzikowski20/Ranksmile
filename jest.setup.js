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
      // Native aborts with a DOMException named TimeoutError — match it so code
      // branching on err.name behaves the same under the polyfill.
      setTimeout(() => c.abort(new DOMException(`signal timed out after ${ms}ms`, 'TimeoutError')), ms);
      return c.signal;
   };
}

// jsdom omits these Node globals; @aws-sdk / @smithy reference them at import time.
const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

// Enable Fetch Mocking
enableFetchMocks();

// Each test FILE gets its own directory for the file-backed WIE stores (pattern store, DNA
// snapshots, outcomes, eval history). setupFilesAfterEnv runs once per file, so this both
// isolates suites Jest runs in parallel workers — they shared data/*.json and one suite's
// writes surfaced in another's assertions — and keeps a test run out of the real data dir.
const os = require('os');
const nodePath = require('path');
const { mkdtempSync, rmSync } = require('fs');

const wieDataDir = mkdtempSync(nodePath.join(os.tmpdir(), 'ranksmile-wie-'));
process.env.WIE_DATA_DIR = wieDataDir;

// Delete the directory we created, not whatever the variable happens to hold at teardown.
// A test that points WIE_DATA_DIR elsewhere and does not restore it (a crash mid-test is
// enough) would otherwise have this recursively remove that path instead.
afterAll(() => {
   try { rmSync(wieDataDir, { recursive: true, force: true }); } catch { /* tmp dir, best effort */ }
});
