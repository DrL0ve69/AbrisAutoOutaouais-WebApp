namespace AbrisAutoOutaouais_WebApp.Domain.Interfaces;

/// <summary>
/// Marque une entité comme soft-deletable.
/// L'intercepteur EF Core intercepte les suppressions et met IsDeleted à true.
/// </summary>
public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}
