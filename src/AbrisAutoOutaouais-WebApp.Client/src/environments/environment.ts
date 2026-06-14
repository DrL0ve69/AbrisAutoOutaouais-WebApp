export const environment = {
  production: false,
  // Profil http par défaut de `dotnet run` (évite le rejet du certificat self-signed côté SSR).
  // Pour le profil https : lancer `dotnet run --launch-profile https` et utiliser https://localhost:7035/api/v1
  apiUrl: 'http://localhost:5228/api/v1',
  // `ng serve` (dev) ne sert qu'UNE locale (le français) : la bascule de langue
  // n'a pas de cible localisée → le bouton « EN » est dégradé (annoncé indisponible).
  // Pour tester les deux langues en local : `npm run dev:i18n` (build localisé bilingue).
  localized: false,
} as const;
