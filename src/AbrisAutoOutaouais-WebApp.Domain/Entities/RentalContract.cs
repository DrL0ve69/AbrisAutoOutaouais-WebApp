using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using Domain.ValueObjects;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Contrat de location d'un abri temporaire.
/// CustomerId = Guid référençant AppUser.Id.
///
/// La location ne repose plus sur un <see cref="Product"/> fixe louable : un contrat référence
/// désormais un <see cref="ShelterModel"/> paramétrique LOUABLE (tarif mensuel non nul) et une TAILLE
/// configurée (longueur × hauteur dégagée) valide au regard de la grille du modèle. <see cref="ProductId"/>
/// reste NULLABLE pour conserver les contrats HISTORIQUES créés contre un produit ; les nouveaux
/// contrats le laissent à <c>null</c> et renseignent <see cref="ShelterModelSlug"/> +
/// <see cref="ConfiguredLengthCm"/>/<see cref="ConfiguredClearHeightCm"/>.
/// </summary>
public sealed class RentalContract : ISoftDeletable, IAuditableEntity
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }

    /// <summary>
    /// Produit loué — NULLABLE : renseigné uniquement pour les contrats HISTORIQUES créés via l'ancien
    /// chemin produit. Les nouveaux contrats (modèle paramétrique) le laissent <c>null</c>.
    /// </summary>
    public Guid? ProductId { get; private set; }

    public string ProductName { get; private set; } = string.Empty; // snapshot
    public decimal MonthlyRate { get; private set; }

    /// <summary>Slug du <see cref="ShelterModel"/> loué (snapshot) — null pour les contrats historiques produit.</summary>
    public string? ShelterModelSlug { get; private set; }

    /// <summary>Longueur configurée en cm (snapshot) — null pour les contrats historiques produit.</summary>
    public int? ConfiguredLengthCm { get; private set; }

    /// <summary>Hauteur dégagée configurée en cm (snapshot) — null pour les contrats historiques produit.</summary>
    public int? ConfiguredClearHeightCm { get; private set; }

    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public RentalStatus Status { get; private set; }
    public Address Address { get; private set; } = null!;  // adresse d'installation

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private RentalContract() { }

    /// <summary>
    /// Crée un contrat de location pour un <see cref="ShelterModel"/> paramétrique LOUABLE et une taille
    /// configurée. Gardes (dans cet ordre) :
    ///  - le modèle doit être louable (<see cref="ShelterModel.MonthlyRentalCents"/> non nul) ;
    ///  - la taille (longueur × hauteur dégagée) doit être admissible — déléguée à la source UNIQUE
    ///    <see cref="ShelterSizeRules.ValidateSize"/>, partagée avec le chemin d'achat (L-004) ;
    ///  - la date de fin doit être après la date de début.
    /// Toute violation lève <see cref="BusinessRuleException"/> (→ 422), comme le chemin d'achat.
    /// Le tarif est SNAPSHOTé (forfait mensuel, indépendant de la taille) ainsi que le nom, le slug et
    /// les dimensions configurées. <see cref="ProductId"/> reste <c>null</c> (pas de produit sous-jacent).
    /// Nécessite que les collections <c>Dimensions</c>/<c>PriceEntries</c> du modèle soient chargées
    /// (<c>.Include</c>, L-035) pour que la validation de taille soit correcte.
    /// </summary>
    public static RentalContract CreateForModel(
        Guid customerId, ShelterModel model,
        int lengthCm, int clearHeightCm,
        DateOnly startDate, DateOnly endDate, Address address)
    {
        ArgumentNullException.ThrowIfNull(model);

        if (model.MonthlyRentalCents is null)
            throw new BusinessRuleException($"« {model.Name} » n'est pas disponible à la location.");

        // Validation de la taille par la source partagée avec l'achat (bornes, pas, hauteur offerte,
        // combinaison tarifée) — mêmes 422 que PlaceOrder, jamais de règles dupliquées (L-004).
        ShelterSizeRules.ValidateSize(model, lengthCm, clearHeightCm);

        if (endDate <= startDate)
            throw new BusinessRuleException("La date de fin doit être après la date de début.");

        return new RentalContract
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            ProductId = null,
            ProductName = $"{model.Name} ({lengthCm} cm · H {clearHeightCm} cm)",
            MonthlyRate = model.MonthlyRentalPrice!.Value,
            ShelterModelSlug = model.Slug,
            ConfiguredLengthCm = lengthCm,
            ConfiguredClearHeightCm = clearHeightCm,
            StartDate = startDate,
            EndDate = endDate,
            Status = RentalStatus.Active,
            Address = address,
        };
    }

    public void Cancel()
    {
        if (Status == RentalStatus.Expired)
            throw new BusinessRuleException("Impossible d'annuler un contrat expiré.");
        if (Status == RentalStatus.Cancelled)
            throw new BusinessRuleException("Ce contrat de location est déjà annulé.");
        Status = RentalStatus.Cancelled;
    }
}
