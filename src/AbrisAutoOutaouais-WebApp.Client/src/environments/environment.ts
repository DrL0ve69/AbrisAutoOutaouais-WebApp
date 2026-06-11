export const environment = {
  production: false,
  // Profil http par défaut de `dotnet run` (évite le rejet du certificat self-signed côté SSR).
  // Pour le profil https : lancer `dotnet run --launch-profile https` et utiliser https://localhost:7035/api/v1
  apiUrl: 'http://localhost:5228/api/v1',
} as const;
