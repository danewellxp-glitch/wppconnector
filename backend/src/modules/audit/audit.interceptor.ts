import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const AUDITED_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

const ROUTE_ENTITY_MAP: Record<string, string> = {
  '/api/auth/login': 'auth',
  '/api/auth/register': 'auth',
  '/api/users': 'user',
  '/api/conversations': 'conversation',
  '/api/messages': 'message',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (!AUDITED_METHODS.includes(method)) {
      return next.handle();
    }

    const path = request.route?.path || request.url;
    const user = request.user;
    const ip =
      request.headers['x-forwarded-for'] || request.connection?.remoteAddress;

    return next.handle().pipe(
      tap((responseData) => {
        const entity = this.resolveEntity(path);
        const action = this.resolveAction(method, path);
        const entityId =
          request.params?.id || responseData?.id || undefined;

        if (user?.companyId) {
          this.auditService
            .log({
              companyId: user.companyId,
              userId: user.id,
              action,
              entity,
              entityId,
              metadata: {
                method,
                path: request.url,
                statusCode: context.switchToHttp().getResponse().statusCode,
              },
              ipAddress: typeof ip === 'string' ? ip : ip?.[0],
            })
            .catch(() => {
              // Silently ignore audit log failures to not affect the request
            });
        }
      }),
    );
  }

  private resolveEntity(path: string): string {
    for (const [route, entity] of Object.entries(ROUTE_ENTITY_MAP)) {
      if (path.startsWith(route.replace('/api', ''))) return entity;
    }
    const segments = path.split('/').filter(Boolean);
    return segments[1] || 'unknown';
  }

  private resolveAction(method: string, path: string): string {
    if (path.includes('login')) return 'login';
    if (path.includes('register')) return 'register';
    if (path.includes('assign')) return 'assign';
    if (path.includes('unassign')) return 'unassign';

    switch (method) {
      case 'POST':
        return 'create';
      case 'PATCH':
      case 'PUT':
        return 'update';
      case 'DELETE':
        return 'delete';
      default:
        return method.toLowerCase();
    }
  }
}
