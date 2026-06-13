using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SplitAddressCivicNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Étape 1 — ajout des colonnes EN NULLABLE sur les 4 tables ────────────────
            // Le numéro civique est ajouté nullable même là où il est in fine REQUIS
            // (RentalContracts, BookingSlots) : on doit pouvoir le renseigner par backfill
            // sur les lignes existantes AVANT de poser la contrainte NOT NULL (étape 3).
            // Sans ça, un AddColumn NOT NULL échouerait (ou poserait un défaut « » trompeur).
            migrationBuilder.AddColumn<string>(
                name: "Address_CivicNumber", table: "RentalContracts",
                type: "nvarchar(10)", maxLength: 10, nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "Address_Apartment", table: "RentalContracts",
                type: "nvarchar(20)", maxLength: 20, nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Address_CivicNumber", table: "BookingSlots",
                type: "nvarchar(10)", maxLength: 10, nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "Address_Apartment", table: "BookingSlots",
                type: "nvarchar(20)", maxLength: 20, nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddress_CivicNumber", table: "Orders",
                type: "nvarchar(10)", maxLength: 10, nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "ShippingAddress_Apartment", table: "Orders",
                type: "nvarchar(20)", maxLength: 20, nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DefaultAddress_CivicNumber", table: "AspNetUsers",
                type: "nvarchar(10)", maxLength: 10, nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "DefaultAddress_Apartment", table: "AspNetUsers",
                type: "nvarchar(20)", maxLength: 20, nullable: true);

            // ── Étape 2 — backfill : extraire le numéro civique en tête de la rue ─────────
            // On déplace les chiffres de tête de « 123 rue des Érables » vers CivicNumber et
            // on laisse « rue des Érables » dans Street. PATINDEX('%[^0-9]%', Street + 'X')
            // trouve le 1er caractère non-chiffre (le 'X' garantit un match même pour une rue
            // entièrement numérique). Une rue ne commençant pas par un chiffre reçoit « 0 ».
            migrationBuilder.Sql(BackfillSql("RentalContracts", "Address"));
            migrationBuilder.Sql(BackfillSql("BookingSlots", "Address"));
            migrationBuilder.Sql(BackfillSql("Orders", "ShippingAddress"));
            migrationBuilder.Sql(BackfillSql("AspNetUsers", "DefaultAddress"));

            // ── Étape 3 — pose du NOT NULL UNIQUEMENT là où l'adresse est requise ─────────
            // RentalContracts et BookingSlots possèdent toujours une adresse (owned requis).
            // Orders.ShippingAddress et AspNetUsers.DefaultAddress sont OPTIONNELS (owned
            // nullable) : leur CivicNumber reste nullable, sinon une commande « Cueillette »
            // ou un compte sans adresse violerait la contrainte.
            migrationBuilder.AlterColumn<string>(
                name: "Address_CivicNumber", table: "RentalContracts",
                type: "nvarchar(10)", maxLength: 10, nullable: false, defaultValue: "",
                oldClrType: typeof(string), oldType: "nvarchar(10)", oldMaxLength: 10, oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Address_CivicNumber", table: "BookingSlots",
                type: "nvarchar(10)", maxLength: 10, nullable: false, defaultValue: "",
                oldClrType: typeof(string), oldType: "nvarchar(10)", oldMaxLength: 10, oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Re-concatène le numéro civique devant la rue pour restaurer le format mono-colonne
            // (« 123 rue des Érables ») AVANT de supprimer les colonnes scindées.
            migrationBuilder.Sql(RecombineSql("RentalContracts", "Address"));
            migrationBuilder.Sql(RecombineSql("BookingSlots", "Address"));
            migrationBuilder.Sql(RecombineSql("Orders", "ShippingAddress"));
            migrationBuilder.Sql(RecombineSql("AspNetUsers", "DefaultAddress"));

            migrationBuilder.DropColumn(name: "Address_CivicNumber", table: "RentalContracts");
            migrationBuilder.DropColumn(name: "Address_Apartment", table: "RentalContracts");
            migrationBuilder.DropColumn(name: "Address_CivicNumber", table: "BookingSlots");
            migrationBuilder.DropColumn(name: "Address_Apartment", table: "BookingSlots");
            migrationBuilder.DropColumn(name: "ShippingAddress_CivicNumber", table: "Orders");
            migrationBuilder.DropColumn(name: "ShippingAddress_Apartment", table: "Orders");
            migrationBuilder.DropColumn(name: "DefaultAddress_CivicNumber", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "DefaultAddress_Apartment", table: "AspNetUsers");
        }

        // ── Helpers SQL ──────────────────────────────────────────────────────────────────
        private static string BackfillSql(string table, string prefix) => $@"
UPDATE [{table}]
SET [{prefix}_CivicNumber] = CASE WHEN [{prefix}_Street] LIKE '[0-9]%'
        THEN LEFT([{prefix}_Street], PATINDEX('%[^0-9]%', [{prefix}_Street] + 'X') - 1) ELSE '0' END,
    [{prefix}_Street] = LTRIM(CASE WHEN [{prefix}_Street] LIKE '[0-9]%'
        THEN STUFF([{prefix}_Street], 1, PATINDEX('%[^0-9]%', [{prefix}_Street] + 'X') - 1, '') ELSE [{prefix}_Street] END)
WHERE [{prefix}_Street] IS NOT NULL;";

        private static string RecombineSql(string table, string prefix) => $@"
UPDATE [{table}]
SET [{prefix}_Street] = LTRIM(ISNULL([{prefix}_CivicNumber], '') + ' ' + ISNULL([{prefix}_Street], ''))
WHERE [{prefix}_Street] IS NOT NULL OR [{prefix}_CivicNumber] IS NOT NULL;";
    }
}
