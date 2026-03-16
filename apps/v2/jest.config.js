const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["<rootDir>/**/*.test.ts"],
  collectCoverageFrom: ["<rootDir>/lib/repositories/**/*.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/.next/"],
};

module.exports = createJestConfig(customJestConfig);
