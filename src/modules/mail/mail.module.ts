import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailConfig } from '../../config/mail.config';
import { Mail } from './entities/mail.entity';
import { MailjetTransport } from './mailjet.transport';
import { MailAdminGuard, MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MailWorker } from './mail.worker';
@Module({
  imports: [TypeOrmModule.forFeature([Mail])],
  controllers: [MailController],
  providers: [
    MailConfig,
    MailService,
    MailjetTransport,
    MailWorker,
    MailAdminGuard,
  ],
  exports: [MailService, MailConfig],
})
export class MailModule {}
