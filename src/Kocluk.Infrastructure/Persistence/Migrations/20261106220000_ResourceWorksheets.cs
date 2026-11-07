using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kocluk.Infrastructure.Persistence.Migrations;

[Migration("20261106220000_ResourceWorksheets")]
public partial class ResourceWorksheets : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable("ResourceWorksheets", table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false),
            TenantId = table.Column<Guid>(type: "uuid", nullable: false),
            ResourceId = table.Column<Guid>(type: "uuid", nullable: false),
            QuestionCount = table.Column<int>(type: "integer", nullable: false),
            OptionCount = table.Column<int>(type: "integer", nullable: false),
            AnswerKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
            DurationMinutes = table.Column<int>(type: "integer", nullable: true),
            CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_ResourceWorksheets", x => x.Id);
            table.ForeignKey("FK_ResourceWorksheets_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Cascade);
            table.ForeignKey("FK_ResourceWorksheets_StudyResources_ResourceId", x => x.ResourceId, "StudyResources", "Id", onDelete: ReferentialAction.Cascade);
        });
        migrationBuilder.CreateIndex("IX_ResourceWorksheets_ResourceId", "ResourceWorksheets", "ResourceId", unique: true);
        migrationBuilder.CreateIndex("IX_ResourceWorksheets_TenantId_CreatedAtUtc", "ResourceWorksheets", new[] { "TenantId", "CreatedAtUtc" });

        migrationBuilder.CreateTable("ResourceSubmissions", table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false),
            TenantId = table.Column<Guid>(type: "uuid", nullable: false),
            ResourceId = table.Column<Guid>(type: "uuid", nullable: false),
            StudentId = table.Column<Guid>(type: "uuid", nullable: false),
            AnswersJson = table.Column<string>(type: "text", nullable: false),
            Answers = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
            Correct = table.Column<int>(type: "integer", nullable: true),
            Wrong = table.Column<int>(type: "integer", nullable: true),
            Blank = table.Column<int>(type: "integer", nullable: true),
            Net = table.Column<double>(type: "double precision", nullable: true),
            TimeSpentSeconds = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
            SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_ResourceSubmissions", x => x.Id);
            table.ForeignKey("FK_ResourceSubmissions_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Cascade);
            table.ForeignKey("FK_ResourceSubmissions_StudyResources_ResourceId", x => x.ResourceId, "StudyResources", "Id", onDelete: ReferentialAction.Cascade);
            table.ForeignKey("FK_ResourceSubmissions_Students_StudentId", x => x.StudentId, "Students", "Id", onDelete: ReferentialAction.Cascade);
        });
        migrationBuilder.CreateIndex("IX_ResourceSubmissions_TenantId_ResourceId_StudentId_SubmittedAtUtc", "ResourceSubmissions", new[] { "TenantId", "ResourceId", "StudentId", "SubmittedAtUtc" });
        migrationBuilder.CreateIndex("IX_ResourceSubmissions_StudentId", "ResourceSubmissions", "StudentId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("ResourceSubmissions");
        migrationBuilder.DropTable("ResourceWorksheets");
    }
}
