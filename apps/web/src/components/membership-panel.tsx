"use client";

import { NativeSelect } from "@/components/ui/native-select";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  listAudit,
  listInvitations,
  listMembers,
  managementPath,
  membershipRequest,
  type AssignableRole,
  type AuditEvent,
  type Invitation,
  type Member,
  type Page,
} from "@/lib/members";
import type { Organization } from "@/lib/organizations";

export type ManagementSection = "members" | "invitations" | "audit";
const inputClass =
  "rounded-lg border border-input bg-card text-card-foreground px-3 py-2";
const buttonClass =
  "rounded-lg border border-input px-3 py-2 text-sm font-medium disabled:opacity-50";
const manages = (actor: string, target: string) =>
  actor === "OWNER"
    ? target !== "OWNER"
    : actor === "ADMIN" && (target === "MEMBER" || target === "VIEWER");
type Confirmation = {
  title: string;
  message: string;
  action: () => Promise<void>;
};

function ConfirmationDialog({
  value,
  pending,
  dismiss,
  confirm,
}: {
  value: Confirmation;
  pending: boolean;
  dismiss: () => void;
  confirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    dialog.current?.showModal();
    cancel.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) dismiss();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-input bg-card text-card-foreground p-6 backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-semibold">
        {value.title}
      </h2>
      <p className="mt-4 break-words">{value.message}</p>
      <div className="mt-6 flex gap-3">
        <button
          ref={cancel}
          className={buttonClass}
          disabled={pending}
          onClick={dismiss}
        >
          Cancel
        </button>
        <button
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={pending}
          onClick={confirm}
        >
          {pending ? "Please wait…" : "Confirm"}
        </button>
      </div>
    </dialog>
  );
}

function MemberRow({
  member,
  organization,
  userId,
  pending,
  confirm,
}: {
  member: Member;
  organization: Organization;
  userId: string;
  pending: boolean;
  confirm: (value: Confirmation) => void;
}) {
  const [role, setRole] = useState<AssignableRole>(
    member.role === "OWNER" ? "ADMIN" : member.role,
  );
  const roleId = useId();
  const editable =
    member.user.id !== userId && manages(organization.role, member.role);
  return (
    <tr className="border-t border-border">
      <td className="p-3">
        <p className="font-medium">{member.user.name}</p>
        <p className="text-sm text-muted-foreground">{member.user.email}</p>
      </td>
      <td className="p-3">
        <span className="rounded-full border border-input px-2 py-1 text-xs">
          {member.role}
        </span>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <>
              <label htmlFor={roleId} className="sr-only">
                Role for {member.user.email}
              </label>
              <NativeSelect
                id={roleId}
                className={inputClass}
                disabled={pending}
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as AssignableRole)
                }
              >
                {organization.role === "OWNER" && (
                  <option value="ADMIN">ADMIN</option>
                )}
                <option value="MEMBER">MEMBER</option>
                <option value="VIEWER">VIEWER</option>
              </NativeSelect>
              <button
                className={buttonClass}
                disabled={pending || role === member.role}
                onClick={() =>
                  confirm({
                    title: "Change member role",
                    message: `Change ${member.user.email} from ${member.role} to ${role}? Their permissions change immediately.`,
                    action: async () => {
                      await membershipRequest(
                        managementPath(organization.id, `members/${member.id}`),
                        "PATCH",
                        { role },
                      );
                    },
                  })
                }
              >
                Save role
              </button>
              <button
                className={buttonClass}
                disabled={pending}
                onClick={() =>
                  confirm({
                    title: "Remove member",
                    message: `Remove ${member.user.email} from this organization? They immediately lose access.`,
                    action: async () => {
                      await membershipRequest(
                        managementPath(organization.id, `members/${member.id}`),
                        "DELETE",
                      );
                    },
                  })
                }
              >
                Remove
              </button>
            </>
          )}
          {organization.role === "OWNER" &&
            member.user.id !== userId &&
            member.role !== "OWNER" && (
              <button
                className={buttonClass}
                disabled={pending}
                onClick={() =>
                  confirm({
                    title: "Transfer ownership",
                    message: `Transfer ownership to ${member.user.email}? You will become ADMIN and lose exclusive owner permissions.`,
                    action: async () => {
                      await membershipRequest(
                        managementPath(organization.id, "ownership-transfer"),
                        "POST",
                        { membershipId: member.id },
                      );
                      window.location.reload();
                    },
                  })
                }
              >
                Transfer ownership
              </button>
            )}
          {!editable && member.user.id === userId && (
            <span className="text-sm text-zinc-500">Your membership</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function MembershipPanel({
  organization,
  userId,
  section,
}: {
  organization: Organization;
  userId: string;
  section: ManagementSection;
}) {
  const [members, setMembers] = useState<Page<Member> | null>(null);
  const [invitations, setInvitations] = useState<Page<Invitation> | null>(null);
  const [events, setEvents] = useState<Page<AuditEvent> | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const emailId = useId();
  const roleId = useId();
  const searchId = useId();

  const load = useCallback(
    async (offset = 0, filter = "", append = false) => {
      if (section === "members") {
        const next = await listMembers(organization.id, offset, filter);
        setMembers((prior) =>
          append && prior
            ? {
                ...next,
                items: [
                  ...prior.items,
                  ...next.items.filter(
                    (row) => !prior.items.some((old) => old.id === row.id),
                  ),
                ],
              }
            : next,
        );
      }
      if (section === "invitations") {
        const next = await listInvitations(organization.id, offset);
        setInvitations((prior) =>
          append && prior
            ? {
                ...next,
                items: [
                  ...prior.items,
                  ...next.items.filter(
                    (row) => !prior.items.some((old) => old.id === row.id),
                  ),
                ],
              }
            : next,
        );
      }
      if (section === "audit") {
        const next = await listAudit(organization.id, offset);
        setEvents((prior) =>
          append && prior
            ? {
                ...next,
                items: [
                  ...prior.items,
                  ...next.items.filter(
                    (row) => !prior.items.some((old) => old.id === row.id),
                  ),
                ],
              }
            : next,
        );
      }
    },
    [organization.id, section],
  );
  useEffect(() => {
    let active = true;
    async function initial() {
      // Keep late responses from a retained/unmounted tenant page out of state.
      if (section === "members") {
        const next = await listMembers(organization.id);
        if (active) setMembers(next);
      }
      if (section === "invitations") {
        const next = await listInvitations(organization.id);
        if (active) setInvitations(next);
      }
      if (section === "audit") {
        const next = await listAudit(organization.id);
        if (active) setEvents(next);
      }
    }
    void initial().catch((cause: unknown) => {
      if (active)
        setError(cause instanceof Error ? cause.message : "Please try again.");
    });
    return () => {
      active = false;
    };
  }, [organization.id, section]);

  async function run(
    action: () => Promise<void>,
    message: string,
    refresh = true,
  ) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (refresh) await load(0, search);
      setNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setPending(false);
      setConfirmation(null);
    }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await run(async () => {
      await membershipRequest(
        managementPath(organization.id, "invitations"),
        "POST",
        {
          email: String(data.get("email") ?? ""),
          role: String(data.get("role") ?? ""),
        },
      );
      form.reset();
    }, "Invitation sent. The recipient must sign in with this email and verify it before accepting.");
  }
  const current =
    section === "members"
      ? members
      : section === "invitations"
        ? invitations
        : events;
  return (
    <section className="space-y-5" aria-busy={pending}>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-400 p-3 text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border border-green-500 p-3">
          {notice}
        </p>
      )}
      {!current && !error && <p role="status">Loading {section}…</p>}
      <button
        className={buttonClass}
        disabled={pending}
        onClick={() => void run(async () => {}, "List refreshed.")}
      >
        Refresh list
      </button>
      {section === "members" && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const value = String(data.get("search") ?? "").trim();
            setSearch(value);
            void run(() => load(0, value), "Member filter updated.", false);
          }}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor={searchId}>Find a member</label>
            <input
              id={searchId}
              name="search"
              className={inputClass}
              maxLength={80}
              placeholder="Name or email"
            />
          </div>
          <button className={buttonClass} disabled={pending}>
            Search members
          </button>
        </form>
      )}
      {section === "invitations" &&
        (organization.role === "OWNER" || organization.role === "ADMIN") && (
          <form
            onSubmit={(event) => void invite(event)}
            className="space-y-4 rounded-xl border border-border bg-card text-card-foreground p-5"
          >
            <h2 className="text-xl font-semibold">Invite a member</h2>
            <div className="flex flex-col gap-2">
              <label htmlFor={emailId}>Invited email address</label>
              <input
                id={emailId}
                name="email"
                className={inputClass}
                type="email"
                required
                maxLength={254}
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={roleId}>Invitation role</label>
              <NativeSelect
                id={roleId}
                name="role"
                defaultValue="MEMBER"
                className={inputClass}
                disabled={pending}
              >
                {organization.role === "OWNER" && (
                  <option value="ADMIN">ADMIN</option>
                )}
                <option value="MEMBER">MEMBER</option>
                <option value="VIEWER">VIEWER</option>
              </NativeSelect>
            </div>
            <p className="text-sm text-muted-foreground">
              Links expire after 24 hours. Reissuing replaces the previous link.
              OWNER is assigned only through ownership transfer.
            </p>
            <button
              className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50"
              disabled={pending}
            >
              Send invitation
            </button>
          </form>
        )}
      {members && section === "members" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card text-card-foreground">
          <table className="w-full text-left text-sm">
            <caption className="p-3 text-left font-semibold">
              Organization members
            </caption>
            <thead>
              <tr>
                <th className="p-3">Account</th>
                <th className="p-3">Role</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.items.map((member) => (
                <MemberRow
                  key={`${member.id}-${member.role}`}
                  member={member}
                  organization={organization}
                  userId={userId}
                  pending={pending}
                  confirm={setConfirmation}
                />
              ))}
            </tbody>
          </table>
          {!members.items.length && (
            <p className="p-4">No members match this filter.</p>
          )}
        </div>
      )}
      {invitations && section === "invitations" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card text-card-foreground">
          <table className="w-full text-left text-sm">
            <caption className="p-3 text-left font-semibold">
              Organization invitations
            </caption>
            <thead>
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Role / status</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-3">{row.email}</td>
                  <td className="p-3">
                    <span className="rounded-full border border-input px-2 py-1 text-xs">
                      {row.role}
                    </span>
                    <p className="mt-2">{row.status}</p>
                  </td>
                  <td className="p-3">
                    {new Date(row.expiresAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {(row.status === "PENDING" || row.status === "EXPIRED") &&
                      manages(organization.role, row.role) && (
                        <div className="flex gap-2">
                          <button
                            disabled={pending}
                            className={buttonClass}
                            onClick={() =>
                              setConfirmation({
                                title: "Reissue invitation",
                                message: `Send a new link to ${row.email}? The previous link will stop working.`,
                                action: async () => {
                                  await membershipRequest(
                                    managementPath(
                                      organization.id,
                                      `invitations/${row.id}/reissue`,
                                    ),
                                    "POST",
                                  );
                                },
                              })
                            }
                          >
                            Reissue
                          </button>
                          <button
                            disabled={pending}
                            className={buttonClass}
                            onClick={() =>
                              setConfirmation({
                                title: "Revoke invitation",
                                message: `Revoke the invitation for ${row.email}? Its link will no longer work.`,
                                action: async () => {
                                  await membershipRequest(
                                    managementPath(
                                      organization.id,
                                      `invitations/${row.id}`,
                                    ),
                                    "DELETE",
                                  );
                                },
                              })
                            }
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!invitations.items.length && (
            <p className="p-4">No invitations yet.</p>
          )}
        </div>
      )}
      {events && section === "audit" && (
        <div className="space-y-3">
          {events.items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border bg-card text-card-foreground p-4"
            >
              <h2 className="break-words font-medium">{row.action}</h2>
              <p className="mt-2 text-sm">
                {new Date(row.createdAt).toLocaleString()}
              </p>
              <dl className="mt-3 space-y-2 break-all text-xs text-muted-foreground">
                <div>
                  <dt className="font-medium">Actor ID</dt>
                  <dd>{row.actorId ?? "Deleted account"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Resource</dt>
                  <dd>
                    {row.resource} · {row.resourceId}
                  </dd>
                </div>
                {Object.entries(row.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="font-medium">{key}</dt>
                    <dd>
                      {typeof value === "string"
                        ? value
                        : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
          {!events.items.length && <p>No audit events yet.</p>}
        </div>
      )}
      {current?.hasMore && (
        <button
          className={buttonClass}
          disabled={pending}
          onClick={() =>
            void run(
              () => load(current.offset + current.limit, search, true),
              "More results loaded.",
              false,
            )
          }
        >
          Load more
        </button>
      )}
      {confirmation && (
        <ConfirmationDialog
          value={confirmation}
          pending={pending}
          dismiss={() => setConfirmation(null)}
          confirm={() => void run(confirmation.action, "Organization updated.")}
        />
      )}
    </section>
  );
}
