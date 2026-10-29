using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kocluk.Infrastructure.Persistence.Migrations;

[Migration("20261029153000_ResourceAssignments")]
public partial class ResourceAssignments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable("ResourceAssignments", table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), ResourceId = table.Column<Guid>(type: "uuid", nullable: false), StudentId = table.Column<Guid>(type: "uuid", nullable: false), AssignedByUserId = table.Column<Guid>(type: "uuid", nullable: true), DueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true), Status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false), AssignedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), OpenedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
        }, constraints: table => { table.PrimaryKey("PK_ResourceAssignments", x => x.Id); table.ForeignKey("FK_ResourceAssignments_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_ResourceAssignments_StudyResources_ResourceId", x => x.ResourceId, "StudyResources", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_ResourceAssignments_Students_StudentId", x => x.StudentId, "Students", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_ResourceAssignments_AspNetUsers_AssignedByUserId", x => x.AssignedByUserId, "AspNetUsers", "Id", onDelete: ReferentialAction.SetNull); });
        migrationBuilder.CreateIndex("IX_ResourceAssignments_TenantId_StudentId_Status_AssignedAtUtc", "ResourceAssignments", new[] { "TenantId", "StudentId", "Status", "AssignedAtUtc" });
        migrationBuilder.CreateIndex("IX_ResourceAssignments_ResourceId", "ResourceAssignments", "ResourceId");
        migrationBuilder.CreateIndex("IX_ResourceAssignments_StudentId", "ResourceAssignments", "StudentId");
        migrationBuilder.CreateIndex("IX_ResourceAssignments_AssignedByUserId", "ResourceAssignments", "AssignedByUserId");
    }
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("ResourceAssignments");
}
