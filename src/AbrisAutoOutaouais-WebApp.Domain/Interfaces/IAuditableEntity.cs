namespace AbrisAutoOutaouais_WebApp.Domain.Interfaces;

public interface IAuditableEntity
{
    DateTime  CreatedAt { get; set; }
    string?   CreatedBy { get; set; }
    DateTime? UpdatedAt { get; set; }
    string?   UpdatedBy { get; set; }
}