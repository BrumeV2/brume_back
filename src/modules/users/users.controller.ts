import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'Profil du client connecté.',
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: 'UNAUTHENTICATED',
  })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'AUTH_UNAVAILABLE',
  })
  me(@CurrentUser() user: User) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  @ApiHeader({
    name: 'Origin',
    required: true,
    schema: { type: 'string', format: 'uri' },
  })
  @ApiHeader({
    name: 'X-CSRF-Protection',
    required: true,
    schema: { type: 'string', enum: ['1'] },
  })
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'Profil mis à jour.',
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: 'VALIDATION_ERROR',
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: 'UNAUTHENTICATED',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: 'FORBIDDEN',
  })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'AUTH_UNAVAILABLE',
  })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }
}
