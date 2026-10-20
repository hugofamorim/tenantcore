import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthOriginGuard, SessionGuard } from '../auth/auth.guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';
import { VerifiedEmailGuard } from './verified-email.guard';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  OrganizationPageDto,
  OrganizationParams,
  UpdateOrganizationDto,
} from './organizations.dto';

@Controller('organizations')
@UseGuards(AuthOriginGuard, SessionGuard, VerifiedEmailGuard, ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: PublicUser, @Query() page: OrganizationPageDto) {
    return this.organizations.list(user.id, page);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @CurrentUser() user: PublicUser,
    @Body() input: CreateOrganizationDto,
  ) {
    return { organization: await this.organizations.create(user.id, input) };
  }

  @Get(':organizationId')
  @Header('Cache-Control', 'no-store')
  async get(
    @CurrentUser() user: PublicUser,
    @Param() params: OrganizationParams,
  ) {
    return {
      organization: await this.organizations.get(
        user.id,
        params.organizationId,
      ),
    };
  }

  @Patch(':organizationId')
  @Header('Cache-Control', 'no-store')
  async update(
    @CurrentUser() user: PublicUser,
    @Param() params: OrganizationParams,
    @Body() input: UpdateOrganizationDto,
  ) {
    return {
      organization: await this.organizations.update(
        user.id,
        params.organizationId,
        input,
      ),
    };
  }
}
