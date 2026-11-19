import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  SearchText,
} from './search-text';

export class IngredientsQueryDto {
  @ApiPropertyOptional({
    type: String,
    minLength: SEARCH_MIN_LENGTH,
    maxLength: SEARCH_MAX_LENGTH,
    description:
      'Recherche dans le nom et les synonymes, insensible à la casse et aux accents. Chaque mot doit figurer (ET). Retirer le paramètre plutôt que l’envoyer vide.',
  })
  @SearchText()
  q?: string;
}
