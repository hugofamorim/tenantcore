import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.guards';

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user?.emailVerifiedAt)
      throw new ForbiddenException(
        'Verify your email before accessing organizations',
      );
    return true;
  }
}
