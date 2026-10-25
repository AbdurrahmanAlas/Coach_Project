using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kocluk.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivacyConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PrivacyConsentAtUtc",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrivacyPolicyVersion",
                table: "AspNetUsers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PrivacyConsentAtUtc",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PrivacyPolicyVersion",
                table: "AspNetUsers");
        }
    }
}
