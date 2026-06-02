import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { throwError, catchError } from 'rxjs';

/**
 * HTTP Error Interceptor: Handles API error responses and provides consistent error handling.
 * Maps backend error responses to standardized frontend error objects.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorResponse = parseErrorResponse(error);
      return throwError(() => errorResponse);
    })
  );
};

/**
 * Parse backend error response to standardized format.
 */
export function parseErrorResponse(error: HttpErrorResponse): HttpApiError {
  if (error.error instanceof ProgressEvent) {
    // Network error
    return {
      status: 0,
      errorCode: 'NETWORK_ERROR',
      message: 'Erreur de connexion. Veuillez vérifier votre connexion internet.',
      errors: undefined,
      timestamp: new Date(),
    };
  }

  const errorBody = error.error;

  return {
    status: error.status,
    errorCode: errorBody?.errorCode || 'UNKNOWN_ERROR',
    message:
      errorBody?.message ||
      getDefaultErrorMessage(error.status),
    errors: errorBody?.errors,
    timestamp: errorBody?.timestamp
      ? new Date(errorBody.timestamp)
      : new Date(),
  };
}

/**
 * Get default error message based on HTTP status code.
 */
export function getDefaultErrorMessage(status: number): string {
  const messages: { [key: number]: string } = {
    400: 'Requête invalide. Veuillez vérifier les données envoyées.',
    401: 'Non authentifié. Veuillez vous connecter.',
    403: 'Accès refusé. Vous n\'avez pas les permissions requises.',
    404: 'Ressource non trouvée.',
    409: 'Conflit. Cette ressource existe déjà ou une opération conflictuelle est en cours.',
    500: 'Erreur serveur. Veuillez réessayer plus tard.',
    503: 'Service indisponible. Veuillez réessayer plus tard.',
  };

  return messages[status] || 'Une erreur est survenue. Veuillez réessayer.';
}

/**
 * Standardized HTTP API error response.
 */
export interface HttpApiError {
  status: number;
  errorCode: string;
  message: string;
  errors?: { [key: string]: string[] };
  timestamp: Date;
}
