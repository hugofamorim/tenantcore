import { OrganizationRole as Role } from '../generated/prisma/client';
import { canManageRole } from './membership.policy';

describe('membership hierarchy', () => {
  it.each(
    Object.values(Role).flatMap((actor) =>
      Object.values(Role).map((target) => ({ actor, target })),
    ),
  )(
    '$actor managing $target follows the explicit matrix',
    ({ actor, target }) => {
      const allowed =
        actor === 'OWNER'
          ? target !== 'OWNER'
          : actor === 'ADMIN'
            ? target === 'MEMBER' || target === 'VIEWER'
            : false;
      expect(canManageRole(actor, target)).toBe(allowed);
    },
  );
});
