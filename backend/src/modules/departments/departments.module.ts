import { Module, forwardRef } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { DepartmentRoutingService } from './department-routing.service';
import { DepartmentRoutingCron } from './department-routing.cron';
import { UsersModule } from '../users/users.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => WebsocketModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [DepartmentsController],
  providers: [
    DepartmentsService,
    DepartmentRoutingService,
    DepartmentRoutingCron,
  ],
  exports: [DepartmentsService, DepartmentRoutingService],
})
export class DepartmentsModule {}
