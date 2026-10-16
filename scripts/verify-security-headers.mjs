#!/usr/bin/env node
// Boots the production build and asserts the security headers from
// next.config.ts (#50) are present on real HTTP responses — configuration
// presence alone doesn't prove Next.js actually applies it to a given
// route, so this hits the app over the network the same way a browser
// would.
//
// Usage: npm run build && node scripts/verify-security-headers.mjs

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// scripts/verify-security-headers.mjs -> project root is one level up.
const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

// Resolved directly rather than going through `npx next start`: npx spawns
// the real `next` binary as a nested child process, and on Linux that
// grandchild doesn't reliably die when the immediate npx child is killed —
// the orphaned server keeps stdio pipes open, which keeps this script's
// Node process alive indefinitely even after the check itself is done.
// Invoking the binary this project already depends on directly sidesteps
// that extra process layer entirely.
const NEXT_BIN = fileURLToPath(
  new URL("node_modules/.bin/next", `file://${PROJECT_ROOT}`),
);

const EXPECTED_HEADERS = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=86400",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

// A representative spread: the static homepage, a dynamic route, the OAuth
// callback page specifically named in the issue, a non-page asset route,
// and a 404 — headers must apply to all of them, not just happy-path pages.
const ROUTES_TO_CHECK = [
  "/",
  "/issues",
  "/auth/callback",
  "/robots.txt",
  "/this-route-does-not-exist",
];

// Rejects as soon as the server process exits, rather than only on a
// timeout — without this, a port conflict or a crash on startup makes the
// script silently burn the full 30s timeout instead of failing immediately
// with the actual reason.
function waitForServer(url, timeoutMs, server) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    let settled = false;
    const onExit = (code) => {
      if (settled) return;
      settled = true;
      reject(new Error(`Server process exited early (code ${code}) before it started responding`));
    };
    server.once("exit", onExit);

    const attempt = async () => {
      if (settled) return;
      try {
        await fetch(url);
        settled = true;
        server.off("exit", onExit);
        resolve();
      } catch {
        if (settled) return;
        if (Date.now() > deadline) {
          settled = true;
          server.off("exit", onExit);
          reject(new Error(`Server did not start within ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, 200);
      }
    };
    attempt();
  });
}

// Kills the whole process group, not just the immediate child. `detached:
// true` (POSIX) puts the child in its own group; a negative pid signals
// the entire group, so a server process's own children (if any) die too
// instead of being orphaned.
function killServerGroup(server) {
  if (server.exitCode !== null || server.signalCode !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

async function main() {
  const server = spawn(NEXT_BIN, ["start", "-p", String(PORT)], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  let serverOutput = "";
  server.stdout.on("data", (chunk) => (serverOutput += chunk.toString()));
  server.stderr.on("data", (chunk) => (serverOutput += chunk.toString()));

  const failures = [];

  try {
    await waitForServer(BASE_URL, 30_000, server);

    for (const route of ROUTES_TO_CHECK) {
      const response = await fetch(`${BASE_URL}${route}`);
      for (const [headerName, expectedValue] of Object.entries(EXPECTED_HEADERS)) {
        const actualValue = response.headers.get(headerName);
        if (actualValue !== expectedValue) {
          failures.push(
            `${route}: expected "${headerName}: ${expectedValue}", got ${
              actualValue === null ? "(missing)" : `"${headerName}: ${actualValue}"`
            }`,
          );
        }
      }
    }
  } catch (err) {
    console.error(serverOutput);
    throw err;
  } finally {
    killServerGroup(server);
  }

  if (failures.length > 0) {
    console.error("Security header verification failed:\n");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `All security headers present and correct on ${ROUTES_TO_CHECK.length} routes.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Belt-and-braces: guarantees this process terminates even if some
    // handle from the spawned server (or its process group) is still
    // technically open, which is exactly the failure mode this script
    // exists to avoid inflicting on CI.
    process.exit(process.exitCode ?? 0);
  });
