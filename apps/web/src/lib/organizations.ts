import { renewSession } from "./auth";

export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export interface Organization { id: string; name: string; slug: string; role: OrganizationRole; createdAt: string; updatedAt: string }
export interface OrganizationPage { items: Organization[]; offset: number; limit: number; hasMore: boolean }

export class OrganizationRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function role(value: unknown): value is OrganizationRole { return value === "OWNER" || value === "ADMIN" || value === "MEMBER" || value === "VIEWER"; }

function organization(value: unknown): Organization {
  if (typeof value !== "object" || value === null ||
    !("id" in value) || typeof value.id !== "string" ||
    !("name" in value) || typeof value.name !== "string" ||
    !("slug" in value) || typeof value.slug !== "string" ||
    !("role" in value) || !role(value.role) ||
    !("createdAt" in value) || typeof value.createdAt !== "string" ||
    !("updatedAt" in value) || typeof value.updatedAt !== "string") throw new Error("Invalid organization response.");
  return { id: value.id, name: value.name, slug: value.slug, role: value.role, createdAt: value.createdAt, updatedAt: value.updatedAt };
}

async function request(path: string, method = "GET", body?: object): Promise<unknown> {
  const read = () => fetch(`/api/organizations${path}`, {
    method, credentials: "same-origin", cache: "no-store",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  let response = await read();
  if (response.status === 401) {
    try { await renewSession(); response = await read(); }
    catch { throw new OrganizationRequestError(401, "Please sign in again."); }
  }
  if (!response.ok) {
    const message = response.status === 401 ? "Please sign in again." :
      response.status === 403 ? "You do not have permission for this action." :
      response.status === 404 ? "Organization not found or you no longer have access." :
      response.status === 409 ? "This slug is unavailable. Please choose another." :
      response.status === 400 ? "Check the name and slug requirements and try again." :
      response.status === 429 ? "Too many requests. Please wait a minute and try again." :
      "Organizations are temporarily unavailable. Please try again.";
    throw new OrganizationRequestError(response.status, message);
  }
  return response.json();
}

export async function listOrganizations(offset = 0): Promise<OrganizationPage> {
  const data = await request(`?limit=20&offset=${offset}`);
  if (typeof data !== "object" || data === null || !("items" in data) || !Array.isArray(data.items) ||
    !("offset" in data) || typeof data.offset !== "number" || !("limit" in data) || typeof data.limit !== "number" ||
    !("hasMore" in data) || typeof data.hasMore !== "boolean") throw new Error("Invalid organization list.");
  return { items: data.items.map(organization), offset: data.offset, limit: data.limit, hasMore: data.hasMore };
}

async function single(path: string, method = "GET", body?: object): Promise<Organization> {
  const data = await request(path, method, body);
  if (typeof data !== "object" || data === null || !("organization" in data)) throw new Error("Invalid organization response.");
  return organization(data.organization);
}

export function getOrganization(id: string) { return single(`/${encodeURIComponent(id)}`); }
export function createOrganization(body: { name: string; slug: string }) { return single("", "POST", body); }
export function updateOrganization(id: string, body: { name: string; slug: string }) { return single(`/${encodeURIComponent(id)}`, "PATCH", body); }
