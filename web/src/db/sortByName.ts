// Referential lists (Appellation, Producer, Meal) are shown name-ascending.
// Plain code-unit comparison mirrors the server's SQLite BINARY `ORDER BY name`
// for ASCII and BMP (accented) names, so online and offline don't reorder
// differently. Only astral characters (e.g. emoji) can differ: UTF-16 code
// units vs UTF-8 bytes. Deliberately not localeCompare — no locale/accent-
// insensitive collation.
export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}
