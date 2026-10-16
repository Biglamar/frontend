import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/**/types.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  // Runs after the test framework is installed — this is where jest-dom matchers are registered
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Resolve the @/ path alias defined in tsconfig.json
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
    // react-markdown (#89) and its remark/unified/mdast dependency tree
    // ship ESM-only .js — Jest's default CJS require() can't load them
    // straight from node_modules. Transforms just enough (import/export ->
    // require/module.exports) via inline Babel options rather than a root
    // babel.config.js/.babelrc, which would make Next.js silently fall
    // back from its default SWC compiler to Babel for the actual app
    // build — this config only ever runs under Jest.
    "^.+\\.js$": [
      "babel-jest",
      { plugins: ["@babel/plugin-transform-modules-commonjs"] },
    ],
  },
  // react-markdown's dependency tree (remark/rehype/unified/hast/mdast/
  // micromark, and each of *their* sub-dependencies) is too deep to name
  // exhaustively as a positive allowlist — new transitive packages kept
  // surfacing one at a time. A blanket transformIgnorePatterns: [] avoided
  // that maintenance cost but transformed the entirety of node_modules on
  // every test run, including plain-CommonJS packages (clsx,
  // tailwind-merge, ...) that never needed it, adding unnecessary overhead
  // to every run (#251). This negative-lookahead instead names the ESM-only
  // families that actually need transforming, by package-name prefix
  // rather than exact name, so a new transitive dependency within one of
  // these families still gets covered without a per-package addition.
  transformIgnorePatterns: [
    "node_modules/(?!(react-markdown|remark-.*|rehype-.*|unified|hast-.*|mdast-.*|micromark.*|vfile.*|unist-.*|bail|is-plain-obj|trough|zwitch|longest-streak|ccount|escape-string-regexp|markdown-table|trim-lines|decode-named-character-reference|character-entities.*|devlop|space-separated-tokens|comma-separated-tokens|property-information|web-namespaces|html-void-elements|stringify-entities|html-url-attributes|inline-style-parser|estree-util-is-identifier-name|style-to-object)/)",
  ],
};

export default config;
