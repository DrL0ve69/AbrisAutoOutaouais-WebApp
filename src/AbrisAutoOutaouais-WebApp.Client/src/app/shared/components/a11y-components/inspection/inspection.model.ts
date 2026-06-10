// features/projects/a11y-components/inspection/inspection.model.ts
export interface InspectionDecision {
  readonly id: string;
  readonly attribute: string;       // ex. 'aria-sort="ascending"'
  readonly location: string;        // ex. 'sur <th scope="col">'
  readonly wcagCriterion: string;   // ex. '1.3.1'
  readonly wcagTitle: string;       // ex. 'Information et relations'
  readonly wcagLevel: 'A' | 'AA';
  readonly wcagUrl: string;
  readonly explanation: string;     // pourquoi ce choix précis
  readonly codeSnippet?: string;    // extrait de code HTML/TS
}

export interface ComponentInspection {
  readonly componentId: string;
  readonly decisions: readonly InspectionDecision[];
}
