import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { audit } from '../audit/audit';
import { OrganizationRole, Prisma } from '../generated/prisma/client';
import {
  CreateOrganizationDto,
  OrganizationPageDto,
  UpdateOrganizationDto,
} from './organizations.dto';
import {
  assertAvailableSlug,
  assertCanEditOrganization,
} from './organization.policy';

const organizationSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isSlugConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateOrganizationDto) {
    assertAvailableSlug(input.slug);
    try {
      const organization = await this.prisma.$transaction(async (tx) => {
        const created = await tx.organization.create({
          data: input,
          select: organizationSelect,
        });
        await tx.membership.create({
          data: {
            userId,
            organizationId: created.id,
            role: OrganizationRole.OWNER,
          },
        });
        await audit(
          tx,
          userId,
          created.id,
          'organization.created',
          'organization',
          created.id,
        );
        return created;
      });
      return { ...organization, role: OrganizationRole.OWNER };
    } catch (error) {
      if (isSlugConflict(error))
        throw new ConflictException('This organization slug is unavailable');
      throw error;
    }
  }

  async list(userId: string, page: OrganizationPageDto) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.offset,
      take: page.limit + 1,
      select: { role: true, organization: { select: organizationSelect } },
    });
    return {
      items: memberships.slice(0, page.limit).map((membership) => ({
        ...membership.organization,
        role: membership.role,
      })),
      limit: page.limit,
      offset: page.offset,
      hasMore: memberships.length > page.limit,
    };
  }

  async get(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true, organization: { select: organizationSelect } },
    });
    if (!membership) throw new NotFoundException('Organization not found');
    return { ...membership.organization, role: membership.role };
  }

  async update(
    userId: string,
    organizationId: string,
    input: UpdateOrganizationDto,
  ) {
    if (input.name === undefined && input.slug === undefined)
      throw new BadRequestException('Provide a name or slug to update');
    if (input.slug !== undefined) assertAvailableSlug(input.slug);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // All future membership mutations must acquire this lock too.
        await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
        const membership = await tx.membership.findUnique({
          where: { userId_organizationId: { userId, organizationId } },
          select: { role: true },
        });
        if (!membership) throw new NotFoundException('Organization not found');
        assertCanEditOrganization(membership.role);
        const organization = await tx.organization.update({
          where: { id: organizationId },
          data: input,
          select: organizationSelect,
        });
        await audit(
          tx,
          userId,
          organizationId,
          'organization.updated',
          'organization',
          organizationId,
          {
            fields: Object.keys(input).filter(
              (key) => input[key as keyof UpdateOrganizationDto] !== undefined,
            ),
          },
        );
        return { ...organization, role: membership.role };
      });
    } catch (error) {
      if (isSlugConflict(error))
        throw new ConflictException('This organization slug is unavailable');
      throw error;
    }
  }
}
