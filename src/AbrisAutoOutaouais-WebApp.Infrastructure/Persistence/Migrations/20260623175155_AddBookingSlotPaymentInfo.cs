using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingSlotPaymentInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "BookingSlots",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "Payment_ConfirmedAt",
                table: "BookingSlots",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Payment_Reference",
                table: "BookingSlots",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Amount",
                table: "BookingSlots");

            migrationBuilder.DropColumn(
                name: "Payment_ConfirmedAt",
                table: "BookingSlots");

            migrationBuilder.DropColumn(
                name: "Payment_Reference",
                table: "BookingSlots");
        }
    }
}
