"use client";

import { useState, useCallback } from "react";
import { GitBranch, RefreshCw, ExternalLink, CheckCircle2, XCircle } from "lucide-react";

interface SyncedRepo {
  owner: string;
  repo: string;
  issueCount: number;
  syncedAt: string;
}

interface SyncState {
  status: "idle" | "syncing" | "success" | "error";
  message?: string;
  syncedRepos: SyncedRepo[];
}

export function GitHubSyncPanel() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [state, setState] = useState<SyncState>({
    status: "idle",
    syncedRepos: [],
  });

  const handleSync = useCallback(async () => {
    if (!owner.trim() || !repo.trim()) return;

    setState((prev) => ({ ...prev, status: "syncing", message: undefined }));
    try {
      let nextPage: string | null = null;
      let totalSynced = 0;

      // Follow pagination until all issues are synced
      do {
        const params = new URLSearchParams();
        if (nextPage) params.set("nextPage", nextPage);

        const url = `/api/github/sync/${encodeURIComponent(owner.trim())}/${encodeURIComponent(repo.trim())}${params.toString() ? `?${params}` : ""}`;
        const res = await fetch(url, { method: "POST" });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Sync failed (${res.status})`);
        }

        const data = await res.json();
        totalSynced += data.synced ?? 0;
        nextPage = data.nextPage ?? null;
      } while (nextPage);

      setState((prev) => ({
        status: "success",
        message: `Synced ${totalSynced} issues from ${owner.trim()}/${repo.trim()}`,
        syncedRepos: [
          ...prev.syncedRepos,
          {
            owner: owner.trim(),
            repo: repo.trim(),
            issueCount: totalSynced,
            syncedAt: new Date().toISOString(),
          },
        ],
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        message: err instanceof Error ? err.message : "Sync failed",
      }));
    }
  }, [owner, repo]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Connect repository
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Sync GitHub issues to create bounties and milestones from them.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="owner (e.g. mergefi)"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          aria-label="Repository owner"
        />
        <input
          type="text"
          placeholder="repo (e.g. frontend)"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          aria-label="Repository name"
        />
        <button
          onClick={handleSync}
          disabled={state.status === "syncing" || !owner.trim() || !repo.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.status === "syncing" ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {state.status === "syncing" ? "Syncing..." : "Sync issues"}
        </button>
      </div>

      {state.message && (
        <div
          role="status"
          className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          }`}
        >
          {state.status === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {state.message}
        </div>
      )}

      {state.syncedRepos.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Synced repositories
          </h3>
          <ul className="mt-2 space-y-2">
            {state.syncedRepos.map((r) => (
              <li
                key={`${r.owner}/${r.repo}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800"
              >
                <span className="font-medium text-slate-900 dark:text-white">
                  {r.owner}/{r.repo}
                </span>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{r.issueCount} issues</span>
                  <span>{new Date(r.syncedAt).toLocaleTimeString()}</span>
                  <a
                    href={`https://github.com/${r.owner}/${r.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:text-indigo-600"
                    aria-label={`Open ${r.owner}/${r.repo} on GitHub`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
