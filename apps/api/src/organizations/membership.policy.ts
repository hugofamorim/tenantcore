import { ForbiddenException } from '@nestjs/common';
import { OrganizationRole as Role } from '../generated/prisma/client';

export function canManageRole(actor: Role, target: Role): boolean {
  return (
    (actor === Role.OWNER && target !== Role.OWNER) ||
    (actor === Role.ADMIN && (target === Role.MEMBER || target === Role.VIEWER))
  );
}

export function assertManager(role: Role) {
  if (role !== Role.OWNER && role !== Role.ADMIN)
    throw new ForbiddenException('Organization management permission required');
}

export function assertRoleManagement(actor: Role, target: Role) {
  if (!canManageRole(actor, target))
    throw new ForbiddenException('This role cannot be managed by your account');
}
