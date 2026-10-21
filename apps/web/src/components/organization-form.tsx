"use client";

import { useId, useState, type FormEvent } from "react";
import { createOrganization, updateOrganization, type Organization } from "@/lib/organizations";

export function OrganizationForm({ existing, onComplete }: { existing?: Organization; onComplete: (organization: Organization) => void }) {
  const id = useId();
  const canEdit = !existing || existing.role === "OWNER" || existing.role === "ADMIN";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      const input = { name: String(data.get("name") ?? ""), slug: String(data.get("slug") ?? "") };
      onComplete(existing ? await updateOrganization(existing.id, input) : await createOrganization(input));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setPending(false); }
  }

  const inputClass = "mt-2 w-full rounded-lg border border-input bg-card text-card-foreground px-3 py-2.5 outline-offset-4 focus:outline-2 focus:outline-ring disabled:opacity-60";
  return <form className="max-w-xl space-y-5" onSubmit={submit} aria-busy={pending}>
    <div>
      <label htmlFor={`${id}-name`} className="block text-sm font-medium">Organization name</label>
      <input className={inputClass} id={`${id}-name`} name="name" defaultValue={existing?.name} required minLength={2} maxLength={80} disabled={!canEdit || pending} />
    </div>
    <div>
      <label htmlFor={`${id}-slug`} className="block text-sm font-medium">Organization slug</label>
      <input className={inputClass} id={`${id}-slug`} name="slug" defaultValue={existing?.slug} required minLength={3} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*"
        aria-describedby={`${id}-slug-help`} disabled={!canEdit || pending} autoCapitalize="none" spellCheck={false} />
      <p id={`${id}-slug-help`} className="mt-2 text-sm text-muted-foreground">3–48 lowercase letters, numbers and single hyphens. The slug must be unique.</p>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-400 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
    {canEdit ? <button className="rounded-lg bg-blue-700 px-4 py-2.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60" disabled={pending}>
      {pending ? "Please wait…" : existing ? "Save changes" : "Create organization"}
    </button> : <p role="status" className="text-sm text-muted-foreground">Your role allows viewing these settings. An owner or admin can edit them.</p>}
  </form>;
}
