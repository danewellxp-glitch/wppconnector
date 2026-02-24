import { Injectable, Logger } from '@nestjs/common';
import { DepartmentRoutingService } from './department-routing.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class DepartmentRoutingCron {
  private readonly logger = new Logger(DepartmentRoutingCron.name);

  constructor(private departmentRoutingService: DepartmentRoutingService) {}

  @Cron('*/30 * * * * *')
  handleRoutingTimeouts() {
    this.departmentRoutingService.checkTimeoutAndRedirect();
  }
}
