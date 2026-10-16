#!/usr/bin/env node
// Proves the build-time env validation from src/lib/env.ts actually does
// what it claims when run through a real `next build`, not just in
// isolation — an invalid/missing NEXT_PUBLIC_STELLAR_NETWORK or
// NEXT_PUBLIC_API_URL must fail the build with a clear error (#26), and a
// valid config must still build successfully.
//
// Usage: node scripts/verify-env-validation.mjs

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const NEXT_BIN = fileURLToPath(
  new URL("node_modules/.bin/next", `file://${PROJECT_ROOT}`),
);

// Base env with both validated variables stripped out, regardless of
// what's set in the environment this script runs in — every case below
// sets exactly what it wants to test, nothing inherited.
function baseEnv() {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_STELLAR_NETWORK;
  delete env.NEXT_PUBLIC_API_URL;
  return env;
}

const CASES = [
  {
    name: "missing NEXT_PUBLIC_STELLAR_NETWORK fails the build",
    env: {},
    expectSuccess: false,
    expectedMessageFragment: "NEXT_PUBLIC_STELLAR_NETWORK is not set",
  },
  {
    name: 'invalid NEXT_PUBLIC_STELLAR_NETWORK ("MAINNET") fails the build',
    env: { NEXT_PUBLIC_STELLAR_NETWORK: "MAINNET" },
    expectSuccess: false,
    expectedMessageFragment: "is not a valid Stellar network",
  },
  {
    name: "invalid NEXT_PUBLIC_API_URL fails the build",
    env: {
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_API_URL: "not-a-url",
    },
    expectSuccess: false,
    expectedMessageFragment: "is not a valid URL",
  },
  {
    name: "valid NEXT_PUBLIC_STELLAR_NETWORK=TESTNET builds successfully",
    env: { NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET" },
    expectSuccess: true,
  },
  {
    // The case above only exercises validateApiUrl's empty/undefined ->
    // DEFAULT_API_BASE_URL fallback path, never its actual URL-parsing
    // success path — a regression that broke validation for any
    // explicitly-set, valid URL while leaving the default path untouched
    // would pass every case above undetected (#205).
    name: "valid custom NEXT_PUBLIC_API_URL builds successfully",
    env: {
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_API_URL: "https://api.example.com",
    },
    expectSuccess: true,
  },
  {
    // PUBLIC is the production-critical network value — a regression that
    // broke the build specifically for "PUBLIC" while leaving "TESTNET"
    // working would pass every case above undetected.
    name: "valid NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC builds successfully",
    env: { NEXT_PUBLIC_STELLAR_NETWORK: "PUBLIC" },
    expectSuccess: true,
  },
  {
    // validateApiUrl explicitly rejects javascript:/file:/non-http(s)
    // schemes (#204), but the existing "not-a-url" case only tests an
    // unparseable URL — not a well-formed URL with a disallowed scheme.
    name: 'rejected URL scheme (javascript:) fails the build',
    env: {
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_API_URL: "javascript:alert(1)",
    },
    expectSuccess: false,
    expectedMessageFragment: 'uses the "javascript:" scheme',
  },
];

function runBuild(envOverrides) {
  return new Promise((resolve, reject) => {
    const child = spawn(NEXT_BIN, ["build"], {
      cwd: PROJECT_ROOT,
      env: { ...baseEnv(), ...envOverrides },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk.toString()));
    child.stderr.on("data", (chunk) => (output += chunk.toString()));

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("next build timed out after 120s"));
    }, 120_000);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code, output });
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function main() {
  const failures = [];

  for (const testCase of CASES) {
    process.stdout.write(`- ${testCase.name} ... `);
    const { exitCode, output } = await runBuild(testCase.env);
    const succeeded = exitCode === 0;

    if (succeeded !== testCase.expectSuccess) {
      failures.push(
        `${testCase.name}: expected ${testCase.expectSuccess ? "success" : "failure"}, got exit code ${exitCode}\n${output.slice(-2000)}`,
      );
      console.log("FAIL");
      continue;
    }

    if (testCase.expectedMessageFragment && !output.includes(testCase.expectedMessageFragment)) {
      failures.push(
        `${testCase.name}: expected output to contain "${testCase.expectedMessageFragment}", but it didn't\n${output.slice(-2000)}`,
      );
      console.log("FAIL");
      continue;
    }

    console.log("ok");
  }

  if (failures.length > 0) {
    console.error("\nEnv validation verification failed:\n");
    for (const failure of failures) {
      console.error(`--- ${failure}\n`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${CASES.length} env validation scenarios behaved correctly.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
