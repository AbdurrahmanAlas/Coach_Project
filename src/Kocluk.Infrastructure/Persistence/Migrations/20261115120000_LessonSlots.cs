using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kocluk.Infrastructure.Persistence.Migrations;

[Migration("20261115120000_LessonSlots")]
public partial class LessonSlots : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable("LessonSlots", table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false),
            TenantId = table.Column<Guid>(type: "uuid", nullable: false),
            StudentId = table.Column<Guid>(type: "uuid", nullable: false),
            CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
            Date = table.Column<DateOnly>(type: "date", nullable: false),
            StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
            EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
            ExamType = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
            Subject = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
            Topic = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
            Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
            CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_LessonSlots", x => x.Id);
            table.ForeignKey("FK_LessonSlots_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Cascade);
            table.ForeignKey("FK_LessonSlots_Students_StudentId", x => x.StudentId, "Students", "Id", onDelete: ReferentialAction.Cascade);
            table.ForeignKey("FK_LessonSlots_AspNetUsers_CreatedByUserId", x => x.CreatedByUserId, "AspNetUsers", "Id", onDelete: ReferentialAction.SetNull);
        });
        migrationBuilder.CreateIndex("IX_LessonSlots_TenantId_StudentId_Date", "LessonSlots", new[] { "TenantId", "StudentId", "Date" });
        migrationBuilder.CreateIndex("IX_LessonSlots_StudentId", "LessonSlots", "StudentId");
        migrationBuilder.CreateIndex("IX_LessonSlots_CreatedByUserId", "LessonSlots", "CreatedByUserId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("LessonSlots");
    }
}
