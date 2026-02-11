import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: any) {
    return this.metricsService.getDashboard(user.companyId);
  }

  @Get('conversations')
  getConversationMetrics(@CurrentUser() user: any) {
    return this.metricsService.getConversationMetrics(user.companyId);
  }

  @Get('agents')
  getAgentMetrics(@CurrentUser() user: any) {
    return this.metricsService.getAgentMetrics(user.companyId);
  }
}
