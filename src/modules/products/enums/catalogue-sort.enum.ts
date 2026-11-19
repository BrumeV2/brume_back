// Tris du catalogue. Égalités départagées par le nom puis l'UUID (ordre stable entre pages).
export enum CatalogueSort {
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  // sur le prix du format le moins cher ; produits sans format en dernier
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  // date d'ajout au catalogue, du plus récent au plus ancien
  NEWEST = 'newest',
  // note moyenne des avis ; produits sans note en dernier
  RATING_DESC = 'rating_desc',
}
