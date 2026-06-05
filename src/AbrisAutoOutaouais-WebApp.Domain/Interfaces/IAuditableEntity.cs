namespace AbrisAutoOutaouais_WebApp.Domain.Interfaces;

// Rempli automatiquement par `AuditInterceptor` (Infrastructure).
public interface IAuditableEntity
{
    DateTime  CreatedAt { get; set; }
    string?   CreatedBy { get; set; } // Nom d'utilisateur ou Email par exemple
    DateTime? UpdatedAt { get; set; }
    string?   UpdatedBy { get; set; }
}