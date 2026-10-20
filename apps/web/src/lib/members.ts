import { renewSession } from "./auth";
import type { OrganizationRole } from "./organizations";

export type AssignableRole = Exclude<OrganizationRole, "OWNER">;
export interface Member {
  id: string;
  role: OrganizationRole;
  createdAt: string;
  user: { id: string; name: string; email: string };
}
export interface Invitation {
  id: string;
  email: string;
  role: AssignableRole;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
}
export interface AuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
export interface Page<T> {
  items: T[];
  offset: number;
  limit: number;
  hasMore: boolean;
}

export class MembershipRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function membershipRequest(
  path: string,
  method = "GET",
  body?: object,
): Promise<unknown> {
  const send = () =>
    fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      ...(method !== "GET"
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body ?? {}),
          }
        : {}),
    });
  let response = await send();
  if (response.status === 401) {
    try {
      await renewSession();
      response = await send();
    } catch {
      throw new MembershipRequestError(
        401,
        "Please sign in again, then reopen your invitation if needed.",
      );
    }
  }
  if (!response.ok)
    throw new MembershipRequestError(
      response.status,
      response.status === 401
        ? "Please sign in again."
        : response.status === 403
          ? "You do not have permission for this action. Verify your email and check your organization role."
          : response.status === 404
            ? "Organization or resource not found, or you no longer have access."
            : response.status === 409
              ? "This action conflicts with the current membership or invitation. Refresh the list and check for an existing member or pending invitation."
              : response.status === 400
                ? "This invitation is invalid, expired or belongs to another email address. Otherwise, check the form values."
                : response.status === 429
                  ? "Too many requests. Please wait a minute and try again."
                  : response.status === 503
                    ? "Invitation email could not be delivered. Please create a new invitation."
                    : "Organization management is temporarily unavailable. Please try again.",
    );
  return response.status === 204 ? null : response.json();
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid management response.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Invalid management response.");
  return value;
}
function role(value: unknown): OrganizationRole {
  if (
    value !== "OWNER" &&
    value !== "ADMIN" &&
    value !== "MEMBER" &&
    value !== "VIEWER"
  )
    throw new Error("Invalid role.");
  return value;
}
function member(value: unknown): Member {
  const r = record(value);
  const u = record(r.user);
  return {
    id: text(r.id),
    role: role(r.role),
    createdAt: text(r.createdAt),
    user: { id: text(u.id), name: text(u.name), email: text(u.email) },
  };
}
function invitation(value: unknown): Invitation {
  const r = record(value);
  const assigned = role(r.role);
  const status = r.status;
  if (
    assigned === "OWNER" ||
    (status !== "PENDING" &&
      status !== "ACCEPTED" &&
      status !== "REVOKED" &&
      status !== "EXPIRED")
  )
    throw new Error("Invalid invitation.");
  return {
    id: text(r.id),
    email: text(r.email),
    role: assigned,
    status,
    expiresAt: text(r.expiresAt),
    createdAt: text(r.createdAt),
    updatedAt: text(r.updatedAt),
    acceptedAt: r.acceptedAt === null ? null : text(r.acceptedAt),
  };
}
function event(value: unknown): AuditEvent {
  const r = record(value);
  return {
    id: text(r.id),
    actorId: r.actorId === null ? null : text(r.actorId),
    action: text(r.action),
    resource: text(r.resource),
    resourceId: text(r.resourceId),
    metadata: record(r.metadata),
    createdAt: text(r.createdAt),
  };
}
async function list<T>(
  id: string,
  resource: string,
  parse: (value: unknown) => T,
  offset: number,
  search?: string,
): Promise<Page<T>> {
  const data = record(
    await membershipRequest(
      `/organizations/${encodeURIComponent(id)}/${resource}?limit=20&offset=${offset}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    ),
  );
  if (
    !Array.isArray(data.items) ||
    typeof data.hasMore !== "boolean" ||
    typeof data.offset !== "number" ||
    typeof data.limit !== "number"
  )
    throw new Error("Invalid management list.");
  return {
    items: data.items.map(parse),
    hasMore: data.hasMore,
    limit: data.limit,
    offset: data.offset,
  };
}
export const listMembers = (id: string, offset = 0, search = "") =>
  list(id, "members", member, offset, search);
export const listInvitations = (id: string, offset = 0) =>
  list(id, "invitations", invitation, offset);
export const listAudit = (id: string, offset = 0) =>
  list(id, "audit-logs", event, offset);
export const managementPath = (id: string, suffix: string) =>
  `/organizations/${encodeURIComponent(id)}/${suffix}`;
export async function acceptInvitation(token: string) {
  const data = record(
    await membershipRequest("/invitations/accept", "POST", { token }),
  );
  return text(data.organizationId);
}
