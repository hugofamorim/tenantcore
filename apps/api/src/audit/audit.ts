import type { Prisma } from '../generated/prisma/client';

export function audit(
  tx: Prisma.TransactionClient,
  actorId: string | null,
  organizationId: string | null,
  action: string,
  resource: string,
  resourceId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  return tx.auditEvent.create({
    data: { actorId, organizationId, action, resource, resourceId, metadata },
    select: { id: true },
  });
}
