"use client";

/**
 * ConnectPanel — the GitHub × wallet connection checklist.
 *
 * STATE MATRIX
 * ────────────
 * GitHub and the wallet are two independent, async, differently-failure-prone
 * flows, so the real state space is 2 × 3 (wallet: none / local-only /
 * linked) plus a pending axis for each side's async resolution. Every cell
 * renders something honest:
 *
 *   ┌──────────────┬─────────────────────┬──────────────────────┐
 *   │              │ no wallet           │ wallet linked        │
 *   ├──────────────┼─────────────────────┼──────────────────────┤
 *   │ no GitHub    │ both CTAs           │ wallet unlinked:     │
 *   │              │                     │ amber, GitHub CTA    │
 *   ├──────────────┼─────────────────────┼──────────────────────┤
 *   │ GitHub       │ wallet CTA enabled, │ both complete,       │
 *   │              │ "finish setup"      │ celebration          │
 *   └──────────────┴─────────────────────┴──────────────────────┘
 *   plus a "connected in browser, never saved to the profile" state that is
 *   a *failure* mode, not a success mode, and looks like one.
 *
 * ORDERING POLICY (deliberate, and enforced in the UI)
 * ───────────────────────────────────────────────────
 * GitHub sign-in is required **before** wallet connection, and the wallet
 * connect control is disabled until it happens. Rationale: the payout address
 * is written server-side keyed to the authenticated user
 * (`PATCH /users/:id/stellar-address`), so a wallet connected while signed out
 * is only a local Freighter permission grant that the backend never learns
 * about. Previously `connect()` returned that address as a success value, the
 * UI showed an identical green "Connected" banner, and the user had no way to
 * re-trigger the link or even to disconnect — leaving payouts pointed nowhere
 * with no UI affordance to fix it.
 *
 * The alternative (support either order) was rejected: it makes "connected"
 * mean two different things depending on how the user got there, and one of
 * those meanings is not durable. A pre-auth wallet is instead surfaced as an
 * explicit, recoverable state rather than a silent one.
 *
 * This panel is also resumable by construction: it derives every cell from
 * `AuthContext` + `WalletContext` real state, so returning to /connect days
 * later in any partial state renders the truth, never a fresh-start
 * assumption.
 */

import { Code2, Wallet as WalletIcon, CheckCircle2, Loader2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GITHUB_OAUTH_URL } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { messages, t } from "@/lib/messages";

export function ConnectPanel() {
  const { user, loading: authLoading } = useAuth();
  const {
    address,
    network,
    connecting,
    error,
    initializing: walletInitializing,
    linkState,
    connect,
    disconnect,
  } = useWallet();

  const githubDone = user !== null;
  const walletDone = linkState === "linked";
  const walletConnectedLocally = linkState === "local";
  const everythingDone = githubDone && walletDone;

  const walletMismatch = walletConnectedLocally && Boolean(user?.stellarAddress) && user?.stellarAddress !== address;
  // The wallet connect control is gated on GitHub sign-in, per the ordering
  // policy documented above.
  const walletBlocked = !githubDone;
  const showSpinner = authLoading || walletInitializing;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          {messages["connect.eyebrow"]}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
          {messages["connect.title"]}
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {messages["connect.intro"]}
        </p>
      </div>

      <ol aria-label={messages["connect.progressLabel"]} className="space-y-2">
        <StepRow label={messages["connect.step.github"]} state={githubStep(showSpinner, githubDone)} />
        <StepRow
          label={messages["connect.step.wallet"]}
          state={walletStep(showSpinner, walletDone, walletConnectedLocally)}
        />
      </ol>

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
            <Code2 aria-hidden="true" className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {messages["connect.github.name"]}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {messages["connect.github.description"]}
            </p>
          </div>
        </div>
        {authLoading ? (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {messages["connect.github.checking"]}
          </p>
        ) : user ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
            {t("connect.github.signedIn", { username: user.username })}
          </div>
        ) : (
          /* A raw <a> is required (cross-origin full-page navigation out of
             Next.js), so the anchor is the interactive element and the
             styled span inside replaces the Button component — nesting a
             <button> inside an <a> is nested interactive content and
             announced as a link containing a button. */
          <a
            href={GITHUB_OAUTH_URL}
            className="mt-4 flex h-10 w-full items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {messages["connect.github.cta"]}
          </a>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
            <WalletIcon aria-hidden="true" className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {messages["connect.wallet.name"]}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {messages["connect.wallet.description"]}
            </p>
          </div>
        </div>

        {walletInitializing ? (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {messages["connect.wallet.checking"]}
          </p>
        ) : walletDone ? (
          <>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
              {t("connect.wallet.linked", {
                address: `${address?.slice(0, 4)}...${address?.slice(-4)}`,
                network: network ?? "",
              })}
            </div>
            <Button
              className="mt-3"
              variant="ghost"
              size="sm"
              onClick={disconnect}
            >
              {messages["connect.wallet.disconnect"]}
            </Button>
          </>
        ) : walletBlocked ? (
          /* Signed out: connecting now would produce a local-only grant that
             the backend never records, so the control is disabled with the
             reason stated rather than allowed to mislead. */
          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900">
            <p className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <Link2Off aria-hidden="true" className="h-4 w-4 shrink-0" />
              {messages["connect.wallet.blockedTitle"]}
            </p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {messages["connect.wallet.blockedBody"]}
            </p>
            <Button className="mt-3" variant="outline" size="sm" disabled>
              {messages["connect.wallet.cta"]}
            </Button>
          </div>
        ) : (
          /* Signed in, wallet not yet durably linked. The connect control
             stays available here (unlike the local-only branch below) because
             re-running it is exactly how the profile write gets retried. */
          <>
            {walletConnectedLocally && (
              <div
                role="alert"
                className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30"
              >
                <p className="flex items-center gap-2 font-medium">
                  <Link2Off aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {messages["connect.wallet.localOnlyTitle"]}
                </p>
                <p className="mt-1">{messages["connect.wallet.localOnlyBody"]}</p>
              </div>
            )}
            {walletMismatch && (
              <div
                role="alert"
                className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30"
              >
                <p className="font-medium">{messages["connect.wallet.mismatchTitle"]}</p>
                <p className="mt-1">
                  {t("connect.wallet.mismatchBody", {
                    address: `${address?.slice(0, 4)}...${address?.slice(-4)}`,
                    onFile: `${user?.stellarAddress?.slice(0, 4)}...${user?.stellarAddress?.slice(-4)}`,
                  })}
                </p>
              </div>
            )}
            <Button
              className="mt-4 w-full"
              variant="outline"
              onClick={connect}
              loading={connecting}
            >
              {connecting ? messages["connect.wallet.connecting"] : messages["connect.wallet.cta"]}
            </Button>
            {walletConnectedLocally && (
              <Button
                className="mt-2 w-full"
                variant="ghost"
                size="sm"
                onClick={disconnect}
              >
                {messages["connect.wallet.disconnect"]}
              </Button>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </Card>

      {everythingDone && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-500/25 dark:bg-emerald-500/10"
        >
          <p className="font-medium text-emerald-800 dark:text-emerald-200">
            {messages["connect.completeTitle"]}
          </p>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300/90">
            {messages["connect.completeBody"]}
          </p>
        </div>
      )}
    </div>
  );
}

type StepState = "pending" | "working" | "done" | "attention";

function githubStep(working: boolean, done: boolean): StepState {
  if (done) return "done";
  return working ? "working" : "pending";
}

function walletStep(working: boolean, done: boolean, localOnly: boolean): StepState {
  if (done) return "done";
  if (localOnly) return "attention";
  return working ? "working" : "pending";
}

function StepRow({ label, state }: { label: string; state: StepState }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {state === "done" && (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      )}
      {state === "working" && (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
      )}
      {state === "attention" && (
        <Link2Off className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      )}
      {state === "pending" && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-700"
        />
      )}
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
      <span className="sr-only">
        {state === "done"
          ? messages["connect.step.done"]
          : state === "attention"
            ? messages["connect.step.needsLinking"]
            : messages["connect.step.pending"]}
      </span>
    </li>
  );
}
