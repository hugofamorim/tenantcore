import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { VerifiedEmailGuard } from './verified-email.guard';
import { MembersService } from './members.service';
import {
  MembersController,
  InvitationAcceptanceController,
} from './members.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    OrganizationsController,
    MembersController,
    InvitationAcceptanceController,
  ],
  providers: [OrganizationsService, MembersService, VerifiedEmailGuard],
})
export class OrganizationsModule {}
