import { timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type AppConfig, CONFIG } from '../config';

/** Protects reviewer/admin endpoints with the x-admin-key header. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const given = request.headers['x-admin-key'];
    const expected = Buffer.from(this.config.ADMIN_API_KEY);
    const actual = Buffer.from(typeof given === 'string' ? given : '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('Missing or invalid admin key');
    }
    return true;
  }
}
