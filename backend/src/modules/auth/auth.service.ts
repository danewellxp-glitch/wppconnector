import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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

    // Set user as ONLINE automatically upon successful login
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        onlineStatus: 'ONLINE',
        lastHeartbeatAt: new Date(),
      },
    });

    const token = this.generateToken(user);

    const { passwordHash, ...userWithoutPassword } = updatedUser;

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
        onlineStatus: true,
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
}
