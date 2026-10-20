import { IsIn, IsUUID, MaxLength, IsString, ValidateIf } from 'class-validator';
import { EmailDto, EmailTokenDto } from '../auth/auth.dto';
import { OrganizationParams, OrganizationPageDto } from './organizations.dto';

export class InviteDto extends EmailDto {
  @IsIn(['ADMIN', 'MEMBER', 'VIEWER'])
  role!: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export class ChangeRoleDto {
  @IsIn(['ADMIN', 'MEMBER', 'VIEWER'])
  role!: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export class MemberParams extends OrganizationParams {
  @IsUUID('4')
  membershipId!: string;
}

export class InvitationParams extends OrganizationParams {
  @IsUUID('4')
  invitationId!: string;
}

export class TransferDto {
  @IsUUID('4')
  membershipId!: string;
}

export class AcceptInvitationDto extends EmailTokenDto {}

export class MemberPageDto extends OrganizationPageDto {
  @ValidateIf((_o: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(80)
  search?: string;
}
