import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const user = await this.usersService.findById(req.user.sub);
    return this.usersService.toProfile(user);
  }

  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(req.user.sub, dto);
    return this.usersService.toProfile(user);
  }
}
