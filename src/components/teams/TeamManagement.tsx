"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiPatch } from "@/lib/api-client";
import { generateIdempotencyKey } from "@/lib/idempotency";

/**
 * Team management components for creating teams, editing splits,
 * and assigning teams to bounties (#640).
 */

interface TeamMember {
  address: string;
  percentage: number;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

export function CreateTeamButton({ onCreated }: { onCreated?: (team: Team) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([
    { address: "", percentage: 100 },
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function addMember() {
    setMembers([...members, { address: "", percentage: 0 }]);
  }

  function removeMember(index: number) {
    setMembers(members.filter((_, i) => i !== index));
  }

  function updateMember(index: number, field: keyof TeamMember, value: string | number) {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  }

  function validateSplits(): boolean {
    const total = members.reduce((sum, m) => sum + (m.percentage || 0), 0);
    return total === 100 && members.every((m) => m.address.trim() && m.percentage > 0);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Team name is required.");
      return;
    }
    if (!validateSplits()) {
      setError("All members must have an address and the splits must total 100%.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const team = await apiPost<Team>("/teams", {
        name: name.trim(),
        members: members.map((m) => ({
          address: m.address.trim(),
          percentage: m.percentage,
        })),
        idempotencyKey: generateIdempotencyKey(),
      });
      setSuccess(true);
      setOpen(false);
      setName("");
      setMembers([{ address: "", percentage: 100 }]);
      onCreated?.(team);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Create team
      </button>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Create Team
          </h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Team name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="e.g. Frontend Team"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Members
              </label>
              {members.map((member, i) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={member.address}
                    onChange={(e) => updateMember(i, "address", e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="G... wallet address"
                  />
                  <input
                    type="number"
                    value={member.percentage}
                    onChange={(e) => updateMember(i, "percentage", parseInt(e.target.value) || 0)}
                    className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    min="0"
                    max="100"
                  />
                  <span className="text-xs text-slate-500">%</span>
                  {members.length > 1 && (
                    <button
                      onClick={() => removeMember(i)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addMember}
                className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                + Add member
              </button>
              <p className="mt-1 text-xs text-slate-500">
                Total: {members.reduce((s, m) => s + (m.percentage || 0), 0)}%
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={pending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {pending ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          Team created successfully!
        </p>
      )}
    </div>
  );
}

export function EditTeamSplitsButton({
  team,
  onUpdate,
}: {
  team: Team;
  onUpdate?: (team: Team) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>(team.members);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMember(index: number, field: keyof TeamMember, value: string | number) {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  }

  function addMember() {
    setMembers([...members, { address: "", percentage: 0 }]);
  }

  function removeMember(index: number) {
    setMembers(members.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const total = members.reduce((sum, m) => sum + (m.percentage || 0), 0);
    if (total !== 100) {
      setError("Splits must total 100%.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const updated = await apiPatch<Team>(`/teams/${team.id}/splits`, {
        members: members.map((m) => ({
          address: m.address.trim(),
          percentage: m.percentage,
        })),
        idempotencyKey: generateIdempotencyKey(),
      });
      setOpen(false);
      onUpdate?.(updated);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update splits.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Edit splits
      </button>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Edit Team Splits — {team.name}
          </h3>
          <div className="mt-3 space-y-3">
            {members.map((member, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={member.address}
                  onChange={(e) => updateMember(i, "address", e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="number"
                  value={member.percentage}
                  onChange={(e) => updateMember(i, "percentage", parseInt(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  min="0"
                  max="100"
                />
                <span className="text-xs text-slate-500">%</span>
                {members.length > 1 && (
                  <button
                    onClick={() => removeMember(i)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addMember}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              + Add member
            </button>
            <p className="text-xs text-slate-500">
              Total: {members.reduce((s, m) => s + (m.percentage || 0), 0)}%
            </p>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={pending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {pending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AssignTeamToBountyButton({
  teamId,
  teamName,
  bountyId,
  bountyTitle,
}: {
  teamId: string;
  teamName: string;
  bountyId: string;
  bountyTitle: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAssign() {
    setError(null);
    setPending(true);
    try {
      await apiPost(`/teams/${teamId}/assign/${bountyId}`, {
        idempotencyKey: generateIdempotencyKey(),
      });
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign team.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleAssign}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {pending ? "Assigning..." : `Assign ${teamName} to ${bountyTitle}`}
      </button>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="mt-1 text-sm text-green-600 dark:text-green-400">
          Team assigned successfully!
        </p>
      )}
    </div>
  );
}
