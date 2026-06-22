import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SuperUserController } from './super-user.controller';
import { SuperUserService } from './super-user.service'; // 🟢 Import the new service file

@Module({
  providers: [AdminService, SuperUserService], // 🟢 Register the new service here
  controllers: [AdminController, SuperUserController], // 🟢 Register the new controller here
  exports: [AdminService],
})
export class AdminModule {}
