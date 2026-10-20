import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvitationStatus,
  OrganizationRole,
  Prisma,
} from '../generated/prisma/client';
import type { PublicUser } from '../auth/auth.service';
import { MailService } from '../auth/mail.service';
import { newSecret, tokenHash } from '../auth/auth.tokens';
import { OrganizationPageDto } from './organizations.dto';
import { InviteDto, MemberPageDto } from './members.dto';
import {
  assertManager,
  assertRoleManagement,
  canManageRole,
} from './membership.policy';
import { audit } from '../audit/audit';

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
} as const;
const memberSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;
type InvitationView = Prisma.InvitationGetPayload<{
  select: typeof invitationSelect;
}>;
const invalidLink = () =>
  new BadRequestException('This invitation is invalid or expired');
const invitationView = (value: InvitationView) => ({
  ...value,
  status:
    value.status === 'PENDING' && value.expiresAt <= new Date()
      ? 'EXPIRED'
      : value.status,
});

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private async actor(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ) {
    const actor = await tx.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!actor) throw new NotFoundException('Organization not found');
    return actor;
  }

  private locked<T>(
    userId: string,
    organizationId: string,
    operation: (
      tx: Prisma.TransactionClient,
      actor: { id: string; role: OrganizationRole },
    ) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
      const actor = await this.actor(tx, userId, organizationId);
      assertManager(actor.role);
      return operation(tx, actor);
    });
  }

  async members(userId: string, organizationId: string, page: MemberPageDto) {
    return this.locked(userId, organizationId, async (tx) => {
      const items = await tx.membership.findMany({
        where: {
          organizationId,
          ...(page.search
            ? {
                user: {
                  OR: [
                    {
                      name: {
                        contains: page.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      email: {
                        contains: page.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  ],
                },
              }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: page.offset,
        take: page.limit + 1,
        select: memberSelect,
      });
      return {
        items: items.slice(0, page.limit),
        limit: page.limit,
        offset: page.offset,
        hasMore: items.length > page.limit,
      };
    });
  }

  async changeRole(
    userId: string,
    organizationId: string,
    membershipId: string,
    role: Exclude<OrganizationRole, 'OWNER'>,
  ) {
    return this.locked(userId, organizationId, async (tx, actor) => {
      const target = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
      });
      if (!target) throw new NotFoundException('Member not found');
      assertRoleManagement(actor.role, target.role);
      assertRoleManagement(actor.role, role);
      if (actor.id === target.id)
        throw new ForbiddenException('You cannot change your own membership');
      const member = await tx.membership.update({
        where: { id: target.id },
        data: { role },
        select: memberSelect,
      });
      if (target.role !== role)
        await audit(
          tx,
          userId,
          organizationId,
          'membership.role_changed',
          'membership',
          target.id,
          { from: target.role, to: role },
        );
      return { member };
    });
  }

  async remove(userId: string, organizationId: string, membershipId: string) {
    return this.locked(userId, organizationId, async (tx, actor) => {
      const target = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
      });
      if (!target) throw new NotFoundException('Member not found');
      assertRoleManagement(actor.role, target.role);
      if (actor.id === target.id)
        throw new ForbiddenException('You cannot remove your own membership');
      await tx.membership.delete({ where: { id: target.id } });
      await audit(
        tx,
        userId,
        organizationId,
        'membership.removed',
        'membership',
        target.id,
        { role: target.role },
      );
    });
  }

  async transfer(userId: string, organizationId: string, membershipId: string) {
    return this.locked(userId, organizationId, async (tx, actor) => {
      if (actor.role !== 'OWNER')
        throw new ForbiddenException('Only the owner can transfer ownership');
      const target = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
        include: { user: { select: { emailVerifiedAt: true } } },
      });
      if (!target) throw new NotFoundException('Member not found');
      if (actor.id === target.id || target.role === 'OWNER')
        throw new ConflictException('Choose another member');
      if (!target.user.emailVerifiedAt)
        throw new ConflictException('The next owner must have verified email');
      const owners = await tx.membership.count({
        where: { organizationId, role: 'OWNER' },
      });
      if (owners !== 1)
        throw new ConflictException(
          'Ownership requires review of existing owner memberships',
        );
      await tx.membership.update({
        where: { id: actor.id },
        data: { role: 'ADMIN' },
      });
      await tx.membership.update({
        where: { id: target.id },
        data: { role: 'OWNER' },
      });
      await audit(
        tx,
        userId,
        organizationId,
        'organization.ownership_transferred',
        'organization',
        organizationId,
        {
          previousOwnerMembershipId: actor.id,
          nextOwnerMembershipId: target.id,
        },
      );
      return { message: 'Ownership transferred' };
    });
  }

  async invitations(
    userId: string,
    organizationId: string,
    page: OrganizationPageDto,
  ) {
    return this.locked(userId, organizationId, async (tx) => {
      const items = await tx.invitation.findMany({
        where: { organizationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.offset,
        take: page.limit + 1,
        select: invitationSelect,
      });
      return {
        items: items.slice(0, page.limit).map(invitationView),
        limit: page.limit,
        offset: page.offset,
        hasMore: items.length > page.limit,
      };
    });
  }

  async invite(userId: string, organizationId: string, input: InviteDto) {
    const secret = newSecret();
    const invitation = await this.locked(
      userId,
      organizationId,
      async (tx, actor) => {
        assertRoleManagement(actor.role, input.role);
        const existing = await tx.membership.findFirst({
          where: { organizationId, user: { email: input.email } },
          select: { id: true },
        });
        if (existing)
          throw new ConflictException('This account is already a member');
        const pending = await tx.invitation.findFirst({
          where: { organizationId, email: input.email, status: 'PENDING' },
        });
        if (pending && pending.expiresAt > new Date())
          throw new ConflictException(
            'A pending invitation already exists; reissue or revoke it',
          );
        if (pending) {
          await tx.invitation.update({
            where: { id: pending.id },
            data: { status: 'REVOKED' },
          });
          await audit(
            tx,
            userId,
            organizationId,
            'invitation.expired',
            'invitation',
            pending.id,
          );
        }
        const created = await tx.invitation.create({
          data: {
            organizationId,
            email: input.email,
            role: input.role,
            createdById: userId,
            tokenHash: tokenHash(secret),
            expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
          },
          select: invitationSelect,
        });
        await audit(
          tx,
          userId,
          organizationId,
          'invitation.created',
          'invitation',
          created.id,
          { role: input.role },
        );
        return created;
      },
    );
    await this.deliver(userId, organizationId, invitation, secret);
    return { invitation: invitationView(invitation) };
  }

  async reissue(userId: string, organizationId: string, invitationId: string) {
    const secret = newSecret();
    const invitation = await this.locked(
      userId,
      organizationId,
      async (tx, actor) => {
        const found = await tx.invitation.findFirst({
          where: { id: invitationId, organizationId },
        });
        if (!found) throw new NotFoundException('Invitation not found');
        assertRoleManagement(actor.role, found.role);
        if (found.status !== 'PENDING')
          throw new ConflictException('Create a new invitation instead');
        const member = await tx.membership.findFirst({
          where: { organizationId, user: { email: found.email } },
          select: { id: true },
        });
        if (member)
          throw new ConflictException('This account is already a member');
        const updated = await tx.invitation.update({
          where: { id: found.id },
          data: {
            tokenHash: tokenHash(secret),
            createdById: userId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
          },
          select: invitationSelect,
        });
        await audit(
          tx,
          userId,
          organizationId,
          'invitation.reissued',
          'invitation',
          found.id,
          { role: found.role },
        );
        return updated;
      },
    );
    await this.deliver(userId, organizationId, invitation, secret);
    return { invitation: invitationView(invitation) };
  }

  private async deliver(
    userId: string,
    organizationId: string,
    invitation: InvitationView,
    secret: string,
  ) {
    try {
      await this.mail.sendInvitation(invitation.email, secret);
    } catch {
      // Compensate only this generation; a later reissue must remain valid.
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
        const changed = await tx.invitation.updateMany({
          where: {
            id: invitation.id,
            tokenHash: tokenHash(secret),
            status: 'PENDING',
          },
          data: { status: 'REVOKED' },
        });
        if (changed.count)
          await audit(
            tx,
            userId,
            organizationId,
            'invitation.delivery_failed',
            'invitation',
            invitation.id,
          );
      });
      throw new ServiceUnavailableException(
        'Invitation email could not be delivered; create a new invitation',
      );
    }
  }

  async revoke(userId: string, organizationId: string, invitationId: string) {
    return this.locked(userId, organizationId, async (tx, actor) => {
      const found = await tx.invitation.findFirst({
        where: { id: invitationId, organizationId },
      });
      if (!found) throw new NotFoundException('Invitation not found');
      assertRoleManagement(actor.role, found.role);
      if (found.status === 'ACCEPTED')
        throw new ConflictException('This invitation was already accepted');
      if (found.status !== 'REVOKED') {
        await tx.invitation.update({
          where: { id: found.id },
          data: { status: 'REVOKED' },
        });
        await audit(
          tx,
          userId,
          organizationId,
          'invitation.revoked',
          'invitation',
          found.id,
        );
      }
    });
  }

  async accept(user: PublicUser, secret: string) {
    const found = await this.prisma.invitation.findUnique({
      where: { tokenHash: tokenHash(secret) },
      select: { id: true, organizationId: true },
    });
    if (!found) throw invalidLink();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${found.organizationId} FOR UPDATE`;
      const invitation = await tx.invitation.findUnique({
        where: { id: found.id },
      });
      if (
        !invitation ||
        invitation.tokenHash !== tokenHash(secret) ||
        invitation.status !== InvitationStatus.PENDING ||
        invitation.expiresAt <= new Date() ||
        invitation.email !== user.email
      )
        throw invalidLink();
      const inviter = invitation.createdById
        ? await tx.membership.findUnique({
            where: {
              userId_organizationId: {
                userId: invitation.createdById,
                organizationId: invitation.organizationId,
              },
            },
          })
        : null;
      if (!inviter || !canManageRole(inviter.role, invitation.role))
        throw invalidLink();
      const existing = await tx.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: invitation.organizationId,
          },
        },
      });
      if (existing)
        throw new ConflictException(
          'You are already a member; this invitation cannot change your role',
        );
      const member = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
        select: { id: true },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      await audit(
        tx,
        user.id,
        invitation.organizationId,
        'invitation.accepted',
        'invitation',
        invitation.id,
        { membershipId: member.id, role: invitation.role },
      );
      return { organizationId: invitation.organizationId };
    });
  }

  async events(
    userId: string,
    organizationId: string,
    page: OrganizationPageDto,
  ) {
    return this.locked(userId, organizationId, async (tx) => {
      const items = await tx.auditEvent.findMany({
        where: { organizationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.offset,
        take: page.limit + 1,
        select: {
          id: true,
          actorId: true,
          action: true,
          resource: true,
          resourceId: true,
          metadata: true,
          createdAt: true,
        },
      });
      return {
        items: items.slice(0, page.limit),
        limit: page.limit,
        offset: page.offset,
        hasMore: items.length > page.limit,
      };
    });
  }
}
