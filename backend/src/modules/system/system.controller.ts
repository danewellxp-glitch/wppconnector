import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemController {
  @Post('shutdown')
  @Roles(Role.ADMIN)
  shutdown() {
    setImmediate(() => process.exit(0));
    return { message: 'Encerrando servidor.' };
  }
}
