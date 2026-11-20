import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsObject,
  IsString,
  Length,
  Matches,
  MaxLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { validateEmailContent } from '../email-template';
import type { SendEmailInput } from '../mail.service';

@ValidatorConstraint({ name: 'mailActionUrl', async: false })
class MailActionUrl implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      validateEmailContent({
        subject: 'Validation',
        content: 'Validation',
        action: { label: 'Lien', url: value },
      });
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage() {
    return 'Le lien doit être une URL HTTP(S) absolue sans identifiants ni espaces.';
  }
}
export class MailActionDto {
  @ApiProperty({ maxLength: 100, example: 'Voir mon compte' })
  @IsString()
  @Length(1, 100)
  @Matches(/\S/)
  label!: string;

  @ApiProperty({
    maxLength: 2048,
    format: 'uri',
    example: 'https://brume.example/compte',
  })
  @IsString()
  @Length(1, 2048)
  @Validate(MailActionUrl)
  url!: string;
}
export class SendMailDto implements SendEmailInput {
  @ApiProperty({
    format: 'email',
    maxLength: 254,
    example: 'client@example.com',
  })
  @IsEmail()
  @MaxLength(254)
  to!: string;

  @ApiProperty({
    maxLength: 192,
    example: 'demo:message-001',
    description:
      'Clé stable pour un même événement et destinataire. Réutiliser cette clé ne crée pas un second envoi.',
  })
  @IsString()
  @Length(1, 192)
  @Matches(/^[^\r\n]*\S[^\r\n]*$/)
  eventKey!: string;

  @ApiProperty({ maxLength: 200, example: 'Un mot de Brume' })
  @IsString()
  @Length(1, 200)
  @Matches(/^[^\r\n]+$/)
  @Matches(/\S/)
  subject!: string;

  @ApiProperty({
    maxLength: 20000,
    example: 'Bonjour Camille,\n\nVotre demande a bien été reçue.',
    description:
      'Texte du mail. Séparer les paragraphes par une ligne vide ; le HTML est échappé.',
  })
  @IsString()
  @Length(1, 20000)
  @Matches(/\S/)
  content!: string;

  @ApiPropertyOptional({ maxLength: 300, example: 'Prenons le temps.' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 300)
  @Matches(/\S/)
  title?: string;

  @ApiPropertyOptional({
    maxLength: 300,
    example: 'Votre demande est entre de bonnes mains.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 300)
  @Matches(/\S/)
  preheader?: string;

  @ApiPropertyOptional({ type: MailActionDto })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => MailActionDto)
  action?: MailActionDto;
}
