import { OrganizationRole } from '../generated/prisma/client';
import {
  assertAvailableSlug,
  assertCanEditOrganization,
} from './organization.policy';

describe('organization settings policy', () => {
  it.each([OrganizationRole.OWNER, OrganizationRole.ADMIN])(
    'permits %s to edit settings',
    (role) => {
      expect(() => assertCanEditOrganization(role)).not.toThrow();
    },
  );
  it.each([OrganizationRole.MEMBER, OrganizationRole.VIEWER])(
    'denies %s settings writes',
    (role) => {
      expect(() => assertCanEditOrganization(role)).toThrow('cannot edit');
    },
  );
  it('reserves system names without rejecting unrelated slugs', () => {
    expect(() => assertAvailableSlug('admin')).toThrow('reserved');
    expect(() => assertAvailableSlug('acme-support')).not.toThrow();
  });
});
