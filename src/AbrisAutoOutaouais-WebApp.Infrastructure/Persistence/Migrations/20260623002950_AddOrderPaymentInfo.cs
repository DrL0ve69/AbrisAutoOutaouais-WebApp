using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderPaymentInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "Payment_ConfirmedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Payment_Reference",
                table: "Orders",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Payment_ConfirmedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Payment_Reference",
                table: "Orders");
        }
    }
}
