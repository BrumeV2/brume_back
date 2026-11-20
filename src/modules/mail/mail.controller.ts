import {
  Body,
  HttpCode,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedRequest } from '../auth/session.guard';
import { Role } from '../users/entities/user.entity';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { ApiErrorDto } from '../../common/dto/api-error.dto';

@Injectable()
export class MailAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (
      context.switchToHttp().getRequest<AuthenticatedRequest>().user?.role !==
      Role.ADMIN
    )
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Cet accès est réservé aux administrateurs.',
      });
    return true;
  }
}
@ApiTags('mail')
@ApiCookieAuth('sessionCookie')
@ApiBearerAuth('accessToken')
@UseGuards(MailAdminGuard)
@Controller('admin/mails')
export class MailController {
  constructor(private readonly mail: MailService) {}
  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.mail.list(query.page, query.limit);
  }
  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Mettre un email Brume en file pour envoi via Mailjet (ADMIN).',
  })
  @ApiBody({ type: SendMailDto })
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Protection', required: true })
  @ApiAcceptedResponse({
    description:
      'Demande durable enregistrée : UUID et état de l’envoi. La réception n’est pas encore confirmée.',
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
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'FORBIDDEN' })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'AUTH_UNAVAILABLE',
  })
  send(@Body() dto: SendMailDto) {
    return this.mail.sendEmail(dto);
  }
  @Post(':id/retry')
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Protection', required: true })
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.mail.retry(id);
  }
}
