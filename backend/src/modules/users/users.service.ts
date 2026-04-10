import { Injectable, NotFoundException } from '@nestjs/common';
import { ResetStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        department: { select: { id: true, name: true, color: true } },
        userDepartments: {
          select: {
            department: { select: { id: true, name: true, color: true } },
          },
        },
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    return user;
  }

  async create(companyId: string, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role || 'AGENT',
        companyId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const { password, ...rest } = dto;
    const data: any = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);

      // If password is changed, resolve any pending reset requests
      await this.prisma.passwordResetRequest.updateMany({
        where: { userId: id, status: ResetStatus.PENDING },
        data: { status: ResetStatus.RESOLVED }
      });
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        isActive: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });
  }

  // ===== Department Membership =====

  async getUserDepartments(userId: string) {
    const entries = await this.prisma.userDepartment.findMany({
      where: { userId },
      select: { department: { select: { id: true, name: true, color: true } } },
    });
    return entries.map((entry) => entry.department);
  }

  async addUserDepartment(userId: string, departmentId: string) {
    // Verify both exist
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');

    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException('Departamento nao encontrado');

    await this.prisma.userDepartment.upsert({
      where: { userId_departmentId: { userId, departmentId } },
      create: { userId, departmentId },
      update: {},
    });

    return this.getUserDepartments(userId);
  }

  async removeUserDepartment(userId: string, departmentId: string) {
    await this.prisma.userDepartment.deleteMany({
      where: { userId, departmentId },
    });

    return this.getUserDepartments(userId);
  }

  // ===== Password Resets =====

  async getPendingPasswordResets(companyId: string) {
    return this.prisma.passwordResetRequest.findMany({
      where: { companyId, status: ResetStatus.PENDING },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async resolvePasswordReset(requestId: string) {
    return this.prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: ResetStatus.RESOLVED }
    });
  }
}
