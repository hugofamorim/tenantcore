import Link from "next/link";

export function AccessProblem({
  status,
  message,
}: {
  status?: number;
  message: string;
}) {
  return (
    <section className="rounded-xl border border-red-400 bg-card text-card-foreground p-5">
      <h2 className="text-xl font-semibold">
        {status === 403
          ? "Access denied"
          : status === 404
            ? "Organization not found"
            : "Unable to load workspace"}
      </h2>
      <p role="alert" className="mt-3 text-red-700 dark:text-red-300">
        {message}
      </p>
      <div className="mt-4 flex flex-wrap gap-5 text-sm">
        <Link href="/organizations" className="underline">
          Back to organizations
        </Link>
        <Link href="/account" className="underline">
          Your account
        </Link>
      </div>
    </section>
  );
}
