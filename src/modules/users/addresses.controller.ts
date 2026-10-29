import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { AddressesService } from './addresses.service';
import {
  AddressResponseDto,
  CreateAddressDto,
  UpdateAddressDto,
} from './dto/address.dto';

@ApiTags('users')
@ApiCookieAuth('sessionCookie')
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 503, type: ApiErrorDto })
@Controller('users/me/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}
  @Get()
  @ApiOkResponse({ type: [AddressResponseDto] })
  list(@Req() req: AuthenticatedRequest) {
    return this.addresses.list(req.user.id);
  }

  @Post()
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
  @ApiCreatedResponse({ type: AddressResponseDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAddressDto) {
    return this.addresses.create(req.user.id, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
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
  @ApiOkResponse({ type: AddressResponseDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addresses.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiParam({ name: 'id', format: 'uuid' })
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
  @ApiNoContentResponse()
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.addresses.remove(req.user.id, id);
  }
}
