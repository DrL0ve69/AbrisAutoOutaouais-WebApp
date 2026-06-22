using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShelterExactPriceGrid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BasePrice",
                table: "ShelterModels");

            migrationBuilder.DropColumn(
                name: "PricePerArchCents",
                table: "ShelterModels");

            migrationBuilder.CreateTable(
                name: "ShelterPriceEntry",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShelterModelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LengthCm = table.Column<int>(type: "int", nullable: false),
                    ClearHeightCm = table.Column<int>(type: "int", nullable: false),
                    PriceCents = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShelterPriceEntry", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShelterPriceEntry_ShelterModels_ShelterModelId",
                        column: x => x.ShelterModelId,
                        principalTable: "ShelterModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShelterPriceEntry_ShelterModelId_LengthCm_ClearHeightCm",
                table: "ShelterPriceEntry",
                columns: new[] { "ShelterModelId", "LengthCm", "ClearHeightCm" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShelterPriceEntry");

            migrationBuilder.AddColumn<decimal>(
                name: "BasePrice",
                table: "ShelterModels",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "PricePerArchCents",
                table: "ShelterModels",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
