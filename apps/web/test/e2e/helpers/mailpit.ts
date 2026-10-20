import { expect } from "@playwright/test";

export async function emailFragment(email: string, subject: string): Promise<string> {
  const base = process.env.MAILPIT_URL ?? "http://localhost:18025";
  let id = "";
  await expect.poll(async () => {
    const response = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email} subject:"${subject}"`)}`);
    if (!response.ok) throw new Error("Mail capture lookup failed");
    const result = await response.json() as { messages: Array<{ ID: string }> };
    id = result.messages[0]?.ID ?? "";
    return Boolean(id);
  }, { timeout: 10_000, message: "Expected account email to arrive in local SMTP capture" }).toBe(true);
  const response = await fetch(`${base}/api/v1/message/${id}`);
  const mail = await response.json() as { Text: string };
  const match = mail.Text.match(/#token=([A-Za-z0-9_-]{43})/);
  if (!match) throw new Error("Expected an account action link");
  return match[0];
}
