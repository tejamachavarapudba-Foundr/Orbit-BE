import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, profile: true, createdAt: true },
    });
  }
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, profile: true, createdAt: true },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  // Add this method inside your UsersService class
async remove(id: string) {
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundException('User not found');
  
  return this.prisma.user.delete({
    where: { id },
    select: { id: true, email: true } // Return minimal data after deletion
  });
}


}
