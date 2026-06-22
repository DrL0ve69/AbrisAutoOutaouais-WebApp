/**
 * Modèles de PAIE INFORMATIVE (EPIC 8, US-8.1) — miroirs EXACTS des DTO C# du module Payroll.
 * Informatif uniquement : aucune déduction/taxe/virement. Les montants sont en CAD.
 */

/**
 * Statut de paie d'une journée — sérialisé en CHAÎNE par l'API (`HasConversion<string>` côté EF).
 * Les valeurs sont les identifiants C# bruts de l'enum `PayStatus` (anglais sans accent).
 */
export type PayStatus = 'AnsPayer' | 'Payee';

/**
 * Récap de paie d'un employé sur une fenêtre. Miroir de `EmployeePayrollDto`.
 * `hourlyRate`/`amount` sont `null` quand le taux n'est pas défini (afficher « — », jamais 0).
 */
export interface EmployeePayrollDto {
  readonly employeeId: string;
  readonly fullName: string;
  /** Taux horaire CAD, ou `null` si non défini. */
  readonly hourlyRate: number | null;
  /** Total des minutes des journées dont les deux bornes existent. */
  readonly totalMinutes: number;
  /** Montant brut = (totalMinutes / 60) × hourlyRate ; `null` si le taux est `null`. */
  readonly amount: number | null;
  /** `Payee` SSI toutes les journées de la fenêtre sont payées ; sinon `AnsPayer`. */
  readonly payStatus: PayStatus;
  /** Nombre de journées saisies dans la fenêtre. */
  readonly entryCount: number;
  /** Nombre de journées encore « À payer ». */
  readonly unpaidCount: number;
}

/**
 * Récap agrégé de la masse salariale sur une fenêtre de dates. Miroir de `PayrollSummaryDto`.
 * Les dates sont au format `YYYY-MM-DD` (DateOnly C#).
 */
export interface PayrollSummaryDto {
  readonly from: string;
  readonly to: string;
  readonly employees: readonly EmployeePayrollDto[];
  /** Somme des `amount` non-null (les employés sans taux ne contribuent pas). */
  readonly totalPayroll: number;
}
