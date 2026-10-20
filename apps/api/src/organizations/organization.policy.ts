import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrganizationRole } from '../generated/prisma/client';

const reserved = new Set([
  'account',
  'admin',
  'api',
  'auth',
  'billing',
  'login',
  'register',
  'settings',
  'support',
  'system',
  'www',
]);

export function assertAvailableSlug(slug: string) {
  if (reserved.has(slug))
    throw new BadRequestException('This organization slug is reserved');
}

export function assertCanEditOrganization(role: OrganizationRole) {
  if (role !== OrganizationRole.OWNER && role !== OrganizationRole.ADMIN) {
    throw new ForbiddenException('Your role cannot edit organization settings');
  }
}
