import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role,
        companyId: dto.companyId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    });

    const token = this.generateToken(user);

    return { user, token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { company: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const token = this.generateToken(user);

    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        departmentId: true,
        isActive: true,
      },
    });
  }

  private generateToken(user: {
    id: string;
    email: string;
    role: string;
    companyId: string;
    departmentId?: string | null;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      ...(user.departmentId && { departmentId: user.departmentId }),
    };

    return this.jwtService.sign(payload);
  }

  async createPasswordResetRequest(email: string, reason: string) {
    // 1. Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, companyId: true }
    });

    // 2. If user exists, create the request
    // We always return success to the frontend to prevent email enumeration
    if (user) {
      // Create request (or update existing pending one to avoid spam)
      const existingPending = await this.prisma.passwordResetRequest.findFirst({
        where: { userId: user.id, status: ResetStatus.PENDING }
      });

      if (existingPending) {
        await this.prisma.passwordResetRequest.update({
          where: { id: existingPending.id },
          data: { reason, updatedAt: new Date() }
        });
      } else {
        await this.prisma.passwordResetRequest.create({
          data: {
            userId: user.id,
            companyId: user.companyId,
            reason,
            status: ResetStatus.PENDING
          }
        });
      }
    }

    return { success: true, message: 'Solicitação registrada com sucesso (se o e-mail existir).' };
  }
}
