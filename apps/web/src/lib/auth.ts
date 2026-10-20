export interface PublicUser {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
}

export async function authMutation(path: "login" | "register" | "refresh" | "logout", body: object = {}) {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
    if (response.status === 401) throw new Error("Your email, password or session was not accepted.");
    if (response.status === 400) throw new Error("Please check your details and try again.");
    throw new Error("We could not complete your request. Please try again.");
  }
}

let renewal: Promise<void> | null = null;

export async function renewSession() {
  // Coordinate callers in this tab; parallel refreshes are replay in the API.
  if (!renewal) renewal = authMutation("refresh").finally(() => { renewal = null; });
  return renewal;
}

export async function currentUser(): Promise<PublicUser | null> {
  const read = () => fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
  let response = await read();
  if (response.status === 401) {
    try { await renewSession(); } catch { return null; }
    response = await read();
  }
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Your account is temporarily unavailable. Please try again.");
  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null || !("user" in data)) throw new Error("Invalid account response.");
  const user = data.user;
  if (typeof user !== "object" || user === null ||
    !("id" in user) || typeof user.id !== "string" ||
    !("name" in user) || typeof user.name !== "string" ||
    !("email" in user) || typeof user.email !== "string" ||
    !("emailVerifiedAt" in user) || (user.emailVerifiedAt !== null && typeof user.emailVerifiedAt !== "string")) {
    throw new Error("Invalid account response.");
  }
  return { id: user.id, name: user.name, email: user.email, emailVerifiedAt: user.emailVerifiedAt };
}
