using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RentalsOntoShelterModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MonthlyRentalCents",
                table: "ShelterModels",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "ProductId",
                table: "RentalContracts",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<int>(
                name: "ConfiguredClearHeightCm",
                table: "RentalContracts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ConfiguredLengthCm",
                table: "RentalContracts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShelterModelSlug",
                table: "RentalContracts",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MonthlyRentalCents",
                table: "ShelterModels");

            migrationBuilder.DropColumn(
                name: "ConfiguredClearHeightCm",
                table: "RentalContracts");

            migrationBuilder.DropColumn(
                name: "ConfiguredLengthCm",
                table: "RentalContracts");

            migrationBuilder.DropColumn(
                name: "ShelterModelSlug",
                table: "RentalContracts");

            migrationBuilder.AlterColumn<Guid>(
                name: "ProductId",
                table: "RentalContracts",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);
        }
    }
}
