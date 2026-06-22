import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PayrollSummaryDto, PayStatus } from '../models/payroll.model';

/**
 * Suivi de PAIE INFORMATIVE (EPIC 8, US-8.1) — récap de masse salariale, édition du taux horaire et
 * marquage du statut de paie. Réservé aux administrateurs : le JWT est attaché par l'intercepteur
 * HTTP et l'API exige la politique « AdminOnly ». Singleton applicatif (`providedIn: 'root'`).
 */
@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Récap de paie agrégé par employé sur la fenêtre [from, to] (dates `YYYY-MM-DD`, bornes incluses). */
  getSummary(from: string, to: string): Observable<PayrollSummaryDto> {
    return this.http.get<PayrollSummaryDto>(`${this.baseUrl}/payroll/summary`, {
      params: { from, to },
    });
  }

  /** Définit (ou retire si `hourlyRate` null) le taux horaire CAD d'un employé (204 No Content). */
  setHourlyRate(employeeId: string, hourlyRate: number | null): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/payroll/employees/${employeeId}/rate`, {
      hourlyRate,
    });
  }

  /**
   * Bascule le statut de paie des journées d'un employé sur la fenêtre [from, to].
   * Retourne le nombre de journées touchées (`{ updated }`).
   */
  markPeriodPaid(
    employeeId: string,
    from: string,
    to: string,
    status: PayStatus,
  ): Observable<{ updated: number }> {
    return this.http.put<{ updated: number }>(`${this.baseUrl}/payroll/mark-paid`, {
      employeeId,
      from,
      to,
      status,
    });
  }
}
