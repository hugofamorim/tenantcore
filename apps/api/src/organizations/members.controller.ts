import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
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
import { MembersService } from './members.service';
import {
  AcceptInvitationDto,
  ChangeRoleDto,
  InvitationParams,
  InviteDto,
  MemberPageDto,
  MemberParams,
  TransferDto,
} from './members.dto';
import { OrganizationPageDto, OrganizationParams } from './organizations.dto';

@Controller('organizations/:organizationId')
@UseGuards(AuthOriginGuard, SessionGuard, VerifiedEmailGuard, ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('dashboard')
  @Header('Cache-Control', 'no-store')
  dashboard(@CurrentUser() user: PublicUser, @Param() p: OrganizationParams) {
    return this.members.dashboard(user.id, p.organizationId);
  }

  @Get('members')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: PublicUser,
    @Param() p: OrganizationParams,
    @Query() page: MemberPageDto,
  ) {
    return this.members.members(user.id, p.organizationId, page);
  }

  @Patch('members/:membershipId')
  @Header('Cache-Control', 'no-store')
  change(
    @CurrentUser() user: PublicUser,
    @Param() p: MemberParams,
    @Body() input: ChangeRoleDto,
  ) {
    return this.members.changeRole(
      user.id,
      p.organizationId,
      p.membershipId,
      input.role,
    );
  }

  @Delete('members/:membershipId')
  @HttpCode(204)
  remove(@CurrentUser() user: PublicUser, @Param() p: MemberParams) {
    return this.members.remove(user.id, p.organizationId, p.membershipId);
  }

  @Post('ownership-transfer')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  transfer(
    @CurrentUser() user: PublicUser,
    @Param() p: OrganizationParams,
    @Body() input: TransferDto,
  ) {
    return this.members.transfer(user.id, p.organizationId, input.membershipId);
  }

  @Get('invitations')
  @Header('Cache-Control', 'no-store')
  invitations(
    @CurrentUser() user: PublicUser,
    @Param() p: OrganizationParams,
    @Query() page: OrganizationPageDto,
  ) {
    return this.members.invitations(user.id, p.organizationId, page);
  }

  @Post('invitations')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  invite(
    @CurrentUser() user: PublicUser,
    @Param() p: OrganizationParams,
    @Body() input: InviteDto,
  ) {
    return this.members.invite(user.id, p.organizationId, input);
  }

  @Post('invitations/:invitationId/reissue')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reissue(@CurrentUser() user: PublicUser, @Param() p: InvitationParams) {
    return this.members.reissue(user.id, p.organizationId, p.invitationId);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(204)
  revoke(@CurrentUser() user: PublicUser, @Param() p: InvitationParams) {
    return this.members.revoke(user.id, p.organizationId, p.invitationId);
  }

  @Get('audit-logs')
  @Header('Cache-Control', 'no-store')
  events(
    @CurrentUser() user: PublicUser,
    @Param() p: OrganizationParams,
    @Query() page: OrganizationPageDto,
  ) {
    return this.members.events(user.id, p.organizationId, page);
  }
}

@Controller('invitations')
@UseGuards(AuthOriginGuard, SessionGuard, VerifiedEmailGuard, ThrottlerGuard)
export class InvitationAcceptanceController {
  constructor(private readonly members: MembersService) {}

  @Post('accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  accept(@CurrentUser() user: PublicUser, @Body() input: AcceptInvitationDto) {
    return this.members.accept(user, input.token);
  }
}
