// Combinaison des ingrédients sélectionnés dans le catalogue (US-015)
export enum IngredientsMatch {
  // au moins un des ingrédients (OU), comportement historique de US-016
  ANY = 'any',
  // tous les ingrédients (ET)
  ALL = 'all',
}
