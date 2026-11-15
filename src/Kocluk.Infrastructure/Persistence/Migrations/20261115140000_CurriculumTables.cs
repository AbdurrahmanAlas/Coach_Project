using Microsoft.EntityFrameworkCore.Migrations;

namespace Kocluk.Infrastructure.Persistence.Migrations;

public partial class CurriculumTables : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Exams",
            columns: table => new
            {
                Id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Exams", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Subjects",
            columns: table => new
            {
                Id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                ExamId = table.Column<string>(type: "character varying(20)", nullable: false),
                Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Subjects", x => x.Id);
                table.ForeignKey(
                    name: "FK_Subjects_Exams_ExamId",
                    column: x => x.ExamId,
                    principalTable: "Exams",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "Topics",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                SubjectId = table.Column<string>(type: "character varying(50)", nullable: false),
                Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Topics", x => x.Id);
                table.ForeignKey(
                    name: "FK_Topics_Subjects_SubjectId",
                    column: x => x.SubjectId,
                    principalTable: "Subjects",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        // LessonSlots'a FK sütunları ekle
        migrationBuilder.AddColumn<string>(
            name: "ExamId",
            table: "LessonSlots",
            type: "character varying(20)",
            maxLength: 20,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SubjectId",
            table: "LessonSlots",
            type: "character varying(50)",
            maxLength: 50,
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "TopicId",
            table: "LessonSlots",
            type: "integer",
            nullable: true);

        // Index'ler
        migrationBuilder.CreateIndex(
            name: "IX_Subjects_ExamId",
            table: "Subjects",
            column: "ExamId");

        migrationBuilder.CreateIndex(
            name: "IX_Topics_SubjectId",
            table: "Topics",
            column: "SubjectId");

        migrationBuilder.CreateIndex(
            name: "IX_LessonSlots_ExamId",
            table: "LessonSlots",
            column: "ExamId");

        migrationBuilder.CreateIndex(
            name: "IX_LessonSlots_SubjectId",
            table: "LessonSlots",
            column: "SubjectId");

        migrationBuilder.CreateIndex(
            name: "IX_LessonSlots_TopicId",
            table: "LessonSlots",
            column: "TopicId");

        // FK constraints
        migrationBuilder.AddForeignKey(
            name: "FK_LessonSlots_Exams_ExamId",
            table: "LessonSlots",
            column: "ExamId",
            principalTable: "Exams",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.AddForeignKey(
            name: "FK_LessonSlots_Subjects_SubjectId",
            table: "LessonSlots",
            column: "SubjectId",
            principalTable: "Subjects",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.AddForeignKey(
            name: "FK_LessonSlots_Topics_TopicId",
            table: "LessonSlots",
            column: "TopicId",
            principalTable: "Topics",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);

        // Müfredat verilerini ekle
        InsertCurriculumData(migrationBuilder);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_LessonSlots_Exams_ExamId",
            table: "LessonSlots");

        migrationBuilder.DropForeignKey(
            name: "FK_LessonSlots_Subjects_SubjectId",
            table: "LessonSlots");

        migrationBuilder.DropForeignKey(
            name: "FK_LessonSlots_Topics_TopicId",
            table: "LessonSlots");

        migrationBuilder.DropIndex(
            name: "IX_LessonSlots_ExamId",
            table: "LessonSlots");

        migrationBuilder.DropIndex(
            name: "IX_LessonSlots_SubjectId",
            table: "LessonSlots");

        migrationBuilder.DropIndex(
            name: "IX_LessonSlots_TopicId",
            table: "LessonSlots");

        migrationBuilder.DropColumn(
            name: "ExamId",
            table: "LessonSlots");

        migrationBuilder.DropColumn(
            name: "SubjectId",
            table: "LessonSlots");

        migrationBuilder.DropColumn(
            name: "TopicId",
            table: "LessonSlots");

        migrationBuilder.DropTable(name: "Topics");
        migrationBuilder.DropTable(name: "Subjects");
        migrationBuilder.DropTable(name: "Exams");
    }

    private void InsertCurriculumData(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.InsertData(
            table: "Exams",
            columns: new[] { "Id", "Name", "FullName" },
            values: new object[,]
            {
                { "tyt", "TYT", "Temel Yeterlilik Testi" },
                { "ayt", "AYT", "Alan Yeterlilik Testleri" },
                { "kpss", "KPSS", "Kamu Personel Seçme Sınavı (GY-GK)" },
                { "dgs", "DGS", "Dikey Geçiş Sınavı" },
                { "tr-yos", "TR-YÖS", "Türkiye Yurt Dışından Öğrenci Kabul Sınavı" }
            });

        migrationBuilder.InsertData(
            table: "Subjects",
            columns: new[] { "Id", "ExamId", "Name", "SortOrder" },
            values: new object[,]
            {
                // TYT
                { "tyt-turkce", "tyt", "Türkçe", 1 },
                { "tyt-matematik", "tyt", "Matematik", 2 },
                { "tyt-geometri", "tyt", "Geometri", 3 },
                { "tyt-fizik", "tyt", "Fizik", 4 },
                { "tyt-kimya", "tyt", "Kimya", 5 },
                { "tyt-biyoloji", "tyt", "Biyoloji", 6 },
                { "tyt-tarih", "tyt", "Tarih", 7 },
                { "tyt-cografya", "tyt", "Coğrafya", 8 },
                { "tyt-felsefe", "tyt", "Felsefe", 9 },
                { "tyt-din", "tyt", "Din Kültürü ve Ahlak Bilgisi", 10 },
                // AYT
                { "ayt-matematik", "ayt", "AYT Matematik", 1 },
                { "ayt-fizik", "ayt", "AYT Fizik", 2 },
                { "ayt-kimya", "ayt", "AYT Kimya", 3 },
                { "ayt-biyoloji", "ayt", "AYT Biyoloji", 4 },
                { "ayt-edebiyat", "ayt", "Türk Dili ve Edebiyatı", 5 },
                { "ayt-tarih", "ayt", "AYT Tarih", 6 },
                { "ayt-cografya", "ayt", "AYT Coğrafya", 7 },
                { "ayt-felsefe-grubu", "ayt", "Felsefe Grubu", 8 },
                { "ayt-din", "ayt", "Din Kültürü ve Ahlak Bilgisi (AYT)", 9 },
                // KPSS
                { "kpss-turkce", "kpss", "Türkçe", 1 },
                { "kpss-matematik", "kpss", "Matematik & Geometri", 2 },
                { "kpss-tarih", "kpss", "Tarih", 3 },
                { "kpss-cografya", "kpss", "Coğrafya", 4 },
                { "kpss-vatandaslik", "kpss", "Vatandaşlık", 5 },
                // DGS
                { "dgs-sayisal", "dgs", "Sayısal Yetenek", 1 },
                { "dgs-sozel", "dgs", "Sözel Yetenek", 2 },
                // TR-YÖS
                { "yos-sayisal-yetenek", "tr-yos", "Sayısal Yetenek (IQ)", 1 },
                { "yos-matematik", "tr-yos", "Temel Matematik", 2 },
                { "yos-geometri", "tr-yos", "Geometri", 3 }
            });
    }
}
