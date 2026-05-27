// jest.config.ts
import type { Config } from "jest";

const config: Config = {
  // Ensures Jest injects 'describe', 'expect', etc. into the global environment
  injectGlobals: true,
  // If using ts-jest
  preset: 'ts-jest',
  testEnvironment:  "bun",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    // Strip .js extensions from imports (TypeScript ESM -> Jest CJS interop)
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM:       true,
        tsconfig:     "./tsconfig.json",
      },
    ],
  },
  // Show each test name in CI output
  verbose: true,
  // Clear all mocks before every test (no cross-test pollution)
  clearMocks:    true,
  restoreMocks:  true,
  resetMocks:    true,
  // Test file locations
  testMatch: ["**/__tests__/**/*.test.ts"],
  // Coverage (run with --coverage flag)
  collectCoverageFrom: [
    "lib/ssentezo/**/*.ts",
    "!lib/ssentezo/**/__tests__/**",
    "!lib/ssentezo/**/hooks/**",  // hooks require jsdom environment
  ],
  // coverageThresholds: {
  //   global: {
  //     lines:      90,
  //     functions:  90,
  //     branches:   80,
  //     statements: 90,
  //   },
  // },
};

export default config;
