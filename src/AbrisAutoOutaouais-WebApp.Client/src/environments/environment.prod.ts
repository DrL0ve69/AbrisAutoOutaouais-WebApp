// ⚠️ apiUrl : à remplacer par le FQDN RÉEL de l'Azure Container App après
// provisioning (`az containerapp show ... --query properties.configuration.ingress.fqdn`),
// p. ex. https://abristempo-api.<suffixe>.canadacentral.azurecontainerapps.io/api/v1.
// L'i18n étant compile-time, ce build est embarqué ; pousser sur `master` redéploie
// automatiquement le front (Azure Static Web Apps). Voir docs/deployment.md §4.2.
export const environment = {
  production: true,
  apiUrl: 'https://REMPLACER-PAR-LE-FQDN-CONTAINERAPP/api/v1',
} as const;
