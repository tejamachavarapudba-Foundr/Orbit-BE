import { Controller, Get, Delete, Param, Req, UseGuards } from '@nestjs/common'; // Added Delete, Req
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}

  @Get() 
  list() { 
    return this.svc.findAll(); 
  }

  @Delete('me') // 👈 Add this BEFORE ':id'
  removeMe(@Req() req: any) { 
    // Your JwtAuthGuard should attach the user payload to req.user
    const userId = req.user.id; 
    return this.svc.remove(userId); 
  }

  @Get(':id') 
  one(@Param('id') id: string) { 
    return this.svc.findOne(id); 
  }
}
