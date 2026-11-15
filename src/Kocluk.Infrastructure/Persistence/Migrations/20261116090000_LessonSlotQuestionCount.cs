using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kocluk.Infrastructure.Persistence.Migrations;

[Migration("20261116090000_LessonSlotQuestionCount")]
public partial class LessonSlotQuestionCount : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>("QuestionCount", "LessonSlots", type: "integer", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("QuestionCount", "LessonSlots");
    }
}
