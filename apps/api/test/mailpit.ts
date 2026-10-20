interface MailSummary {
  ID: string;
}
interface MailList {
  messages: MailSummary[];
}
interface CapturedMail {
  Text: string;
  Subject: string;
}

export async function capturedMail(
  email: string,
  subject: string,
): Promise<CapturedMail> {
  const base = process.env.MAILPIT_URL ?? 'http://localhost:18025';
  const response = await fetch(
    `${base}/api/v1/search?query=${encodeURIComponent(`to:${email} subject:"${subject}"`)}`,
  );
  if (!response.ok) throw new Error('Mail capture lookup failed');
  const list = (await response.json()) as MailList;
  const first = list.messages[0];
  if (!first) throw new Error('Expected captured account email');
  const detail = await fetch(`${base}/api/v1/message/${first.ID}`);
  if (!detail.ok) throw new Error('Mail capture read failed');
  return detail.json() as Promise<CapturedMail>;
}

export function capturedToken(mail: CapturedMail): string {
  const match = mail.Text.match(/#token=([A-Za-z0-9_-]{43})/);
  if (!match) throw new Error('Expected email action link');
  return match[1];
}
