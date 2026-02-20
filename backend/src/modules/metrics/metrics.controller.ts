import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: any, @Query('period') period?: string) {
    return this.metricsService.getDashboard(user.companyId, period);
  }

  @Get('conversations')
  getConversationMetrics(
    @CurrentUser() user: any,
    @Query('period') period?: string,
  ) {
    return this.metricsService.getConversationMetrics(user.companyId, period);
  }

  @Get('agents')
  getAgentMetrics(@CurrentUser() user: any, @Query('period') period?: string) {
    return this.metricsService.getAgentMetrics(user.companyId, period);
  }
}
