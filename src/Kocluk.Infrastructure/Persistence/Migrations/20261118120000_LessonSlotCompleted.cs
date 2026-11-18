using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kocluk.Infrastructure.Persistence.Migrations;

[Migration("20261118120000_LessonSlotCompleted")]
public partial class LessonSlotCompleted : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>("IsCompleted", "LessonSlots", type: "boolean", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<DateTime>("CompletedAtUtc", "LessonSlots", type: "timestamp with time zone", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("CompletedAtUtc", "LessonSlots");
        migrationBuilder.DropColumn("IsCompleted", "LessonSlots");
    }
}
