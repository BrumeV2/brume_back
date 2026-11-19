// Recherche texte du catalogue (US-014) et du référentiel d'ingrédients (US-015).
// Un mot est trouvé s'il apparaît en sous-chaîne, sans tenir compte de la casse ni des accents.

export const normalized = (sql: string) => `lower(unaccent(${sql}))`;

// Mots distincts de la recherche, convertis en motifs LIKE « contient » (% et _ pris littéralement)
export function searchPatterns(q: string): string[] {
  return [...new Set(q.split(' ').filter(Boolean))].map(
    (word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`,
  );
}

// La colonne contient le motif lié au paramètre SQL `param`
export const matches = (column: string, param: string) =>
  `${normalized(column)} LIKE ${normalized(`:${param}`)} ESCAPE '\\'`;

// Un ingrédient correspond par son nom ou par l'un de ses synonymes
export const ingredientMatches = (alias: string, param: string) =>
  `(${matches(`${alias}.name`, param)} OR EXISTS (SELECT 1 FROM unnest(${alias}.aliases) synonym WHERE ${matches('synonym', param)}))`;
