import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { AdminPayrollComponent } from './payroll';
import { PayrollSummaryDto } from '../../../core/models/payroll.model';
import { environment } from '../../../../environments/environment';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const summary: PayrollSummaryDto = {
  from: '2026-07-01',
  to: '2026-07-31',
  totalPayroll: 180,
  employees: [
    {
      employeeId: 'emp-1',
      fullName: 'Alice Tremblay',
      hourlyRate: 20,
      totalMinutes: 540,
      amount: 180,
      payStatus: 'AnsPayer',
      entryCount: 1,
      unpaidCount: 1,
    },
    {
      employeeId: 'emp-2',
      fullName: 'Bob Gagnon',
      hourlyRate: null,
      totalMinutes: 600,
      amount: null,
      payStatus: 'Payee',
      entryCount: 1,
      unpaidCount: 0,
    },
  ],
};

/** Monte le composant et répond au GET /payroll/summary émis dans le constructeur. */
async function setup(data: PayrollSummaryDto = summary) {
  const result = await render(AdminPayrollComponent, {
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(req => req.url === `${environment.apiUrl}/payroll/summary`).flush(data);
  result.detectChanges();
  return { ...result, http };
}

describe('AdminPayrollComponent', () => {
  it('affiche le récap par employé et le total de masse salariale', async () => {
    await setup();

    expect(screen.getByRole('heading', { level: 1, name: /Employés.*paie/i })).toBeTruthy();
    expect(screen.getByText('Alice Tremblay')).toBeTruthy();
    expect(screen.getByText('Bob Gagnon')).toBeTruthy();
    // Le total de masse salariale est rendu — au moins une valeur monétaire « 180 ».
    expect(screen.getAllByText(/180/).length).toBeGreaterThan(0);
  });

  it('affiche « taux non défini » et « — » quand le taux/montant est null (jamais 0)', async () => {
    await setup();

    // Bob n'a pas de taux : « taux non défini » et un montant indisponible (—).
    expect(screen.getByText('taux non défini')).toBeTruthy();
    expect(screen.getByLabelText('montant indisponible')).toBeTruthy();
  });

  it('montre le badge « À payer » pour une période non payée et « Payée » sinon', async () => {
    await setup();

    expect(screen.getByText('À payer')).toBeTruthy();
    expect(screen.getByText('Payée')).toBeTruthy();
  });

  it('n’offre « Marquer payé » que pour un employé avec heures non payées', async () => {
    await setup();

    // Alice (non payée, 1 entrée) a le bouton ; Bob (déjà payé) ne l'a pas.
    const markButtons = screen.queryAllByRole('button', { name: /comme payée/i });
    expect(markButtons.length).toBe(1);
  });

  it('PUT le nouveau taux et recharge le récap après édition inline', async () => {
    const { http } = await setup();

    // Ouvrir l'édition du taux d'Alice.
    await userEvent.click(screen.getByRole('button', { name: /Modifier le taux horaire de Alice/i }));

    const input = screen.getByLabelText('Taux horaire en dollars') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    const put = http.expectOne(`${environment.apiUrl}/payroll/employees/emp-1/rate`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ hourlyRate: 25 });
    put.flush(null);

    // Rechargement → un nouveau GET summary.
    http.expectOne(req => req.url === `${environment.apiUrl}/payroll/summary`).flush(summary);
  });

  it('PUT mark-paid avec le statut Payee puis recharge et rend le focus (L-006)', async () => {
    const { http } = await setup();

    await userEvent.click(screen.getByRole('button', { name: /Marquer la paie de Alice/i }));

    const put = http.expectOne(`${environment.apiUrl}/payroll/mark-paid`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.employeeId).toBe('emp-1');
    expect(put.request.body.status).toBe('Payee');
    put.flush({ updated: 1 });

    // Rechargement : Alice devient « Payée » → son bouton « Marquer payé » disparaît. Le récap
    // rechargé reflète le nouveau statut payé pour emp-1.
    const reloaded: PayrollSummaryDto = {
      ...summary,
      employees: [
        { ...summary.employees[0], payStatus: 'Payee', unpaidCount: 0 },
        summary.employees[1],
      ],
    };
    http.expectOne(req => req.url === `${environment.apiUrl}/payroll/summary`).flush(reloaded);

    // Le focus revient sur le bouton « Taux » d'Alice (toujours présent), pas sur <body> (L-006).
    await waitFor(() =>
      expect(document.getElementById('rate-trigger-emp-1')).toBe(document.activeElement),
    );
  });

  it('réannonce le récap même si le nombre d’employés est identique (L-027)', async () => {
    const { http } = await setup();

    const status = screen.getByRole('status');
    // Premier chargement déjà annoncé (2 employés dans la fixture).
    expect(status.textContent).toContain('2');

    // Recharger avec le MÊME nombre d'employés. announce() repasse par '' puis repose le message
    // identique : la région aria-live finit donc toujours sur le message, jamais bloquée à vide.
    await userEvent.click(screen.getByRole('button', { name: 'Afficher' }));
    http.expectOne(req => req.url === `${environment.apiUrl}/payroll/summary`).flush(summary);

    await waitFor(() => expect(status.textContent).toMatch(/Récap de paie mis à jour : 2/i));
  });

  it('ne déclenche pas de requête quand la fenêtre est incohérente (début > fin)', async () => {
    const { http } = await setup();

    const from = screen.getByLabelText('Du') as HTMLInputElement;
    const to = screen.getByLabelText('Au') as HTMLInputElement;
    await userEvent.clear(from);
    await userEvent.type(from, '2026-08-01');
    await userEvent.clear(to);
    await userEvent.type(to, '2026-07-01');
    await userEvent.click(screen.getByRole('button', { name: 'Afficher' }));

    // Erreur affichée, aucune requête summary supplémentaire.
    expect(screen.getByRole('alert')).toBeTruthy();
    http.expectNone(req => req.url === `${environment.apiUrl}/payroll/summary`);
  });

  it('aucune violation axe', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
