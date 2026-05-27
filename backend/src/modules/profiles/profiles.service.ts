import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

// 1. ✅ PLACE THE SET OUTSIDE THE CLASS (At the top of the file)
const validProfileRoles = new Set([
  'founder',
  'co_founder',
  'software_engineer',
  'mentor',
  'policy_maker',
  'investor',
  'designer',
  'product_manager',
  'developer',
  'other',
]);

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}
  list() { return this.prisma.profile.findMany({ orderBy: { createdAt: 'desc' } }); }
  async get(id: string) {
    const p = await this.prisma.profile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    return p;
  }

    update(id: string, dto: UpdateProfileDto) {
    // 👇 If dto.role is missing/undefined, we safely pass an empty string to .has()
    const role = validProfileRoles.has(dto.role ?? '') ? dto.role : 'other';

    return this.prisma.profile.update({ 
      where: { id }, 
      data: {
        ...dto,
        role: role as any
      } 
    });
  }
  
  async updateAvatar(id: string, avatarUrl: string) {
  const profile = await this.prisma.profile.findUnique({ where: { id } });
  if (!profile) throw new NotFoundException('Profile not found');

  return this.prisma.profile.update({
    where: { id },
    data: { avatarUrl },
  });
}

}

