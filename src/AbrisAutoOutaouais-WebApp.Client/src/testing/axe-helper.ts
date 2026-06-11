import axe from 'axe-core';

/**
 * Lance axe-core sur un conteneur rendu et échoue si une violation WCAG A/AA est trouvée.
 *
 * Note : la règle `color-contrast` est désactivée au niveau des tests de composants car
 * les styles GLOBAUX (`styles.scss` + design tokens `_tokens.scss`) ne sont pas chargés
 * dans le rendu unitaire — les couleurs ne sont donc pas représentatives. Les contrastes
 * sont garantis par les design tokens (ratios AA documentés) et vérifiables sur l'app réelle.
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container as HTMLElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });

  if (results.violations.length > 0) {
    const report = results.violations
      .map(
        v =>
          `[${v.impact}] ${v.id} — ${v.help}\n  ${v.nodes
            .map(n => n.target.join(' '))
            .join('\n  ')}\n  → ${v.helpUrl}`,
      )
      .join('\n\n');
    throw new Error(
      `axe a11y : ${results.violations.length} violation(s) WCAG A/AA :\n\n${report}`,
    );
  }
}
