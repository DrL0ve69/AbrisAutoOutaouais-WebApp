import { Component, ChangeDetectionStrategy, signal, computed } from "@angular/core";
import { INSPECTIONS } from "../inspection/inspection.data";

// features/projects/a11y-components/data-table/data-table.component.ts
export type SortDirection = 'asc' | 'desc' | 'none';

export interface SortState {
  readonly column: string;
  readonly direction: SortDirection;
}

@Component({
  selector: 'app-a11y-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="table-section-title">
      <h3 id="table-section-title" i18n>Tableau filtrable et triable</h3>

      <!-- Filtre -->
      <label for="table-filter" i18n>Rechercher dans le tableau</label>
      <input id="table-filter"
             type="search"
             autocomplete="off"
             [value]="filterQuery()"
             (input)="filterQuery.set($any($event.target).value)"
             aria-describedby="filter-hint" />
      <p id="filter-hint" class="hint" i18n>
        La liste se met à jour automatiquement pendant la saisie.
      </p>

      <!-- Annonce dynamique — obligatoire WCAG 4.1.3 -->
      <p role="status"
         aria-live="polite"
         aria-atomic="true"
         class="sr-only">
        {{ statusMessage() }}
      </p>

      <table aria-labelledby="table-section-title"
             aria-describedby="filter-hint">
        <caption class="sr-only" i18n>
          Données de démonstration — triables par colonne
        </caption>
        <thead>
          <tr>
            @for (col of columns; track col.key) {
              <th scope="col"
                  [attr.aria-sort]="getSortAriaValue(col.key)">
                <button (click)="sortBy(col.key)"
                        [attr.aria-label]="getSortLabel(col)">
                  {{ col.label }}
                  <span aria-hidden="true">
                    {{ getSortIcon(col.key) }}
                  </span>
                </button>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (pageItems().length === 0) {
            <tr>
              <td [attr.colspan]="columns.length" i18n>
                Aucun résultat pour « {{ filterQuery() }} »
              </td>
            </tr>
          } @else {
            @for (row of pageItems(); track row.id) {
              <tr>
                <th scope="row">{{ row.name }}</th>
                <td>{{ row.category }}</td>
                <td>{{ row.status }}</td>
                <td>{{ row.date }}</td>
              </tr>
            }
          }
        </tbody>
      </table>

      <!-- Pagination -->
      <nav aria-label="Pagination du tableau">
        <button (click)="prevPage()"
                [disabled]="currentPage() === 1"
                i18n-aria-label
                aria-label="Page précédente">
          ‹
        </button>

        @for (page of pageNumbers(); track page) {
          <button (click)="currentPage.set(page)"
                  [attr.aria-current]="currentPage() === page ? 'page' : null"
                  [attr.aria-label]="'Page ' + page">
            {{ page }}
          </button>
        }

        <button (click)="nextPage()"
                [disabled]="currentPage() === totalPages()"
                aria-label="Page suivante">
          ›
        </button>
      </nav>

    </section>
  `
})
export class A11yDataTableComponent {
  readonly columns = [
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'category', label: 'Catégorie', sortable: true },
    { key: 'status', label: 'Statut', sortable: true },
    { key: 'date', label: 'Date', sortable: true },
  ];

  readonly filterQuery = signal('');
  readonly sortState = signal<SortState>({ column: '', direction: 'none' });
  readonly currentPage = signal(1);
  readonly pageSize = 5;

  readonly filteredItems = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    console.log(q);
    return q;
      // ? INSPECTIONS.filter(r =>
      //   Object.values(r).some(v => String(v).toLowerCase().includes(q)))
      // : TABLE_DATA;
  });

  readonly sortedItems = computed(() => {
    const { column, direction } = this.sortState();
    if (direction === 'none' || !column) return this.filteredItems();
    return [...this.filteredItems()].sort((a, b) => {
      const aVal = String((a as any)[column]);
      const bVal = String((b as any)[column]);
      return direction === 'asc'
        ? aVal.localeCompare(bVal, 'fr')
        : bVal.localeCompare(aVal, 'fr');
    });
  });

  readonly totalPages = computed(() =>
    Math.ceil(this.sortedItems().length / this.pageSize));

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  readonly pageItems = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.sortedItems().slice(start, start + this.pageSize);
  });

  readonly statusMessage = computed(() => {
    const count = this.filteredItems().length;
    const q = this.filterQuery();
    return q
      ? `${count} résultat${count !== 1 ? 's' : ''} pour « ${q} »`
      : `${count} entrées affichées`;
  });

  sortBy(column: string): void {
    this.sortState.update(s => ({
      column,
      direction: s.column === column && s.direction === 'asc' ? 'desc' : 'asc'
    }));
    this.currentPage.set(1);
  }

  getSortAriaValue(col: string): 'ascending' | 'descending' | 'none' {
    const { column, direction } = this.sortState();
    if (column !== col || direction === 'none') return 'none';
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  getSortLabel(col: { key: string; label: string }): string {
    const dir = this.getSortAriaValue(col.key);
    if (dir === 'none') return `Trier par ${col.label} — croissant`;
    if (dir === 'ascending') return `Trier par ${col.label} — décroissant`;
    return `Annuler le tri par ${col.label}`;
  }

  getSortIcon(col: string): string {
    const { column, direction } = this.sortState();
    if (column !== col) return '⇅';
    return direction === 'asc' ? '↑' : '↓';
  }

  prevPage(): void {
    this.currentPage.update(p => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.currentPage.update(p => Math.min(this.totalPages(), p + 1));
  }
}
