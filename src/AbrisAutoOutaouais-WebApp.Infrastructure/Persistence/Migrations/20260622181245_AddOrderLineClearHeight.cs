using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderLineClearHeight : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ConfiguredClearHeightCm",
                table: "OrderLines",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConfiguredClearHeightCm",
                table: "OrderLines");
        }
    }
}
