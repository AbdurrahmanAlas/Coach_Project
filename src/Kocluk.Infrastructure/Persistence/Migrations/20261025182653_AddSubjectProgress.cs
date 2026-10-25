using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kocluk.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSubjectProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SubjectProgresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Subject = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Topic = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    CompletionPercent = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubjectProgresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubjectProgresses_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SubjectProgresses_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SubjectProgresses_StudentId",
                table: "SubjectProgresses",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_SubjectProgresses_TenantId_StudentId_Subject_Topic",
                table: "SubjectProgresses",
                columns: new[] { "TenantId", "StudentId", "Subject", "Topic" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SubjectProgresses");
        }
    }
}
