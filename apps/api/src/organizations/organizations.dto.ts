import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const slug = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateOrganizationDto {
  @Transform(trimmed)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @Transform(slug)
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}

export class UpdateOrganizationDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(slug)
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
}

export class OrganizationParams {
  @IsUUID('4')
  organizationId!: string;
}

export class OrganizationPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset = 0;
}
