using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kocluk.Infrastructure.Persistence.Migrations;

[Migration("20261029150000_QuestionBankEnhancements")]
public partial class QuestionBankEnhancements : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>("QuestionType", "QuestionBankItems", type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "ShortAnswer");
        migrationBuilder.AddColumn<string>("OptionsJson", "QuestionBankItems", type: "character varying(4000)", maxLength: 4000, nullable: true);
        migrationBuilder.AddColumn<Guid>("ResourceId", "QuestionBankItems", type: "uuid", nullable: true);
        migrationBuilder.AddColumn<decimal>("Points", "QuestionBankItems", type: "numeric(6,2)", precision: 6, scale: 2, nullable: false, defaultValue: 1m);
        migrationBuilder.AddColumn<bool>("IsBlank", "QuestionAttempts", type: "boolean", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<int>("TimeSpentSeconds", "QuestionAttempts", type: "integer", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<string>("ErrorReason", "QuestionAttempts", type: "character varying(120)", maxLength: 120, nullable: true);
        migrationBuilder.CreateTable("StudyResources", table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), UploadedByUserId = table.Column<Guid>(type: "uuid", nullable: true), Subject = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false), Topic = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false), FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false), StoredFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false), ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false), Size = table.Column<long>(type: "bigint", nullable: false), CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
        }, constraints: table => { table.PrimaryKey("PK_StudyResources", x => x.Id); table.ForeignKey("FK_StudyResources_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_StudyResources_AspNetUsers_UploadedByUserId", x => x.UploadedByUserId, "AspNetUsers", "Id", onDelete: ReferentialAction.SetNull); });
        migrationBuilder.CreateIndex("IX_StudyResources_TenantId_Subject_Topic_CreatedAtUtc", "StudyResources", new[] { "TenantId", "Subject", "Topic", "CreatedAtUtc" });
        migrationBuilder.CreateIndex("IX_StudyResources_UploadedByUserId", "StudyResources", "UploadedByUserId");
        migrationBuilder.CreateTable("QuestionAssignments", table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), QuestionBankItemId = table.Column<Guid>(type: "uuid", nullable: false), StudentId = table.Column<Guid>(type: "uuid", nullable: false), AssignedByUserId = table.Column<Guid>(type: "uuid", nullable: true), DueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true), Status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false), ErrorReason = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true), StudentNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true), AssignedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
        }, constraints: table => { table.PrimaryKey("PK_QuestionAssignments", x => x.Id); table.ForeignKey("FK_QuestionAssignments_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_QuestionAssignments_QuestionBankItems_QuestionBankItemId", x => x.QuestionBankItemId, "QuestionBankItems", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_QuestionAssignments_Students_StudentId", x => x.StudentId, "Students", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_QuestionAssignments_AspNetUsers_AssignedByUserId", x => x.AssignedByUserId, "AspNetUsers", "Id", onDelete: ReferentialAction.SetNull); });
        migrationBuilder.CreateIndex("IX_QuestionAssignments_TenantId_StudentId_Status_DueDateUtc", "QuestionAssignments", new[] { "TenantId", "StudentId", "Status", "DueDateUtc" });
        migrationBuilder.CreateIndex("IX_QuestionAssignments_QuestionBankItemId", "QuestionAssignments", "QuestionBankItemId");
        migrationBuilder.CreateIndex("IX_QuestionAssignments_AssignedByUserId", "QuestionAssignments", "AssignedByUserId");
        migrationBuilder.CreateIndex("IX_QuestionBankItems_ResourceId", "QuestionBankItems", "ResourceId");
        migrationBuilder.AddForeignKey("QuestionBankItems", "ResourceId", "StudyResources", "Id", onDelete: ReferentialAction.SetNull);
    }
    protected override void Down(MigrationBuilder migrationBuilder) { migrationBuilder.DropTable("QuestionAssignments"); migrationBuilder.DropForeignKey("QuestionBankItems", "ResourceId", "StudyResources"); migrationBuilder.DropIndex("QuestionBankItems", "IX_QuestionBankItems_ResourceId"); migrationBuilder.DropTable("StudyResources"); migrationBuilder.DropColumn("QuestionType", "QuestionBankItems"); migrationBuilder.DropColumn("OptionsJson", "QuestionBankItems"); migrationBuilder.DropColumn("ResourceId", "QuestionBankItems"); migrationBuilder.DropColumn("Points", "QuestionBankItems"); migrationBuilder.DropColumn("IsBlank", "QuestionAttempts"); migrationBuilder.DropColumn("TimeSpentSeconds", "QuestionAttempts"); migrationBuilder.DropColumn("ErrorReason", "QuestionAttempts"); }
}
