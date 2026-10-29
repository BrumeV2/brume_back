import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { publicUser } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@ApiCookieAuth('sessionCookie')
@Controller('users')
export class UsersController {
  @Get('me')
  @ApiOkResponse({ type: UserResponseDto })
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
  me(@Req() request: AuthenticatedRequest) {
    return publicUser(request.user);
  }
}
