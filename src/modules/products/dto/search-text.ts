import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

// Saisie de recherche : valeur unique, espaces nettoyés, 2 à 100 caractères
export const SearchText = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
    ),
    IsString(),
    IsNotEmpty(),
    MinLength(SEARCH_MIN_LENGTH),
    MaxLength(SEARCH_MAX_LENGTH),
  );
