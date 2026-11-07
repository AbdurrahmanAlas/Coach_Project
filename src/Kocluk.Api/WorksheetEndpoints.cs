using System.Security.Claims;
using Kocluk.Domain.Entities;
using Kocluk.Infrastructure.Identity;
using Kocluk.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

public sealed record WorksheetRequest(int QuestionCount, int OptionCount, string? AnswerKey, int? DurationMinutes);

/// <summary>
/// Öğrencinin çalışma gönderimi. Optik form için <c>Answers</c> ("ABC-D..." biçimi) kullanılır;
/// eski PDF-üzerine-çizim gönderimleri için <c>AnswersJson</c> geçerlidir.
/// </summary>
public sealed record ResourceSubmissionRequest(string? AnswersJson = null, string? Answers = null, int TimeSpentSeconds = 0, int? OptionCount = null);

/// <summary>
/// Kaynak dosyalarına bağlı optik form (cevap kâğıdı) uç noktaları. Tenant grubuna eklenir, bu nedenle
/// <see cref="TenantMembershipFilter"/> üyelik kontrolü zaten uygulanır. Cevap anahtarı yalnızca
/// koç/admin yanıtlarında bulunur; öğrenci çalışmayı gönderene kadar anahtarı göremez.
/// </summary>
public static class WorksheetEndpoints
{
    public static RouteGroupBuilder MapWorksheetEndpoints(this RouteGroupBuilder tenantApi)
    {
        tenantApi.MapGet("/resources/{resourceId:guid}/worksheet", GetWorksheet);
        tenantApi.MapPut("/resources/{resourceId:guid}/worksheet", PutWorksheet);
        tenantApi.MapPost("/resources/{resourceId:guid}/submissions", PostSubmission);
        tenantApi.MapGet("/resources/{resourceId:guid}/submissions", ListSubmissions);
        tenantApi.MapGet("/resources/{resourceId:guid}/my-submission", GetMySubmission);
        tenantApi.MapPost("/resources/{resourceId:guid}/students/{studentId:guid}/reopen", ReopenAssignment);
        tenantApi.MapGet("/worksheets/overview", Overview);
        return tenantApi;
    }

    private const int DefaultQuestionCount = 20;

    private static bool IsCoachOrAdmin(ClaimsPrincipal principal) => principal.IsInRole("Coach") || principal.IsInRole("Admin");

    private static Task<Student?> FindStudentAsync(KoclukDbContext db, ApplicationUser current, Guid tenantId, CancellationToken ct) =>
        db.Students.SingleOrDefaultAsync(x => x.TenantId == tenantId && (x.ApplicationUserId == current.Id || (x.ApplicationUserId == null && x.Email == current.Email)), ct);

    private static object BuildResult(ResourceSubmission submission, ResourceWorksheet sheet) => new
    {
        submissionId = submission.Id,
        sent = true,
        graded = sheet.HasKey,
        correct = submission.Correct,
        wrong = submission.Wrong,
        blank = submission.Blank,
        net = submission.Net,
        timeSpentSeconds = submission.TimeSpentSeconds,
        submittedAtUtc = submission.SubmittedAtUtc,
        questionCount = sheet.QuestionCount,
        optionCount = sheet.OptionCount,
        answers = submission.Answers,
        // Anahtar yalnızca öğrenci çalışmayı gönderdikten sonra bu yanıtla birlikte görünür.
        answerKey = sheet.HasKey ? sheet.AnswerKey : null
    };

    private static async Task<IResult> GetWorksheet(Guid tenantId, Guid resourceId, ClaimsPrincipal principal,
        UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct)
    {
        await WorksheetStorage.EnsureAsync(db, ct);
        var sheet = await db.ResourceWorksheets.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.ResourceId == resourceId, ct);
        if (sheet is null && IsCoachOrAdmin(principal)) return Results.NotFound();
        if (sheet is not null && IsCoachOrAdmin(principal))
            return Results.Ok(new { sheet.ResourceId, sheet.QuestionCount, sheet.OptionCount, sheet.DurationMinutes, hasKey = sheet.HasKey, answerKey = sheet.AnswerKey, assignmentStatus = (string?)null });
        var current = await users.GetUserAsync(principal);
        if (current is null) return Results.Unauthorized();
        var student = await FindStudentAsync(db, current, tenantId, ct);
        var assignment = student is null ? null : await db.ResourceAssignments.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.ResourceId == resourceId && x.StudentId == student.Id, ct);
        if (assignment is null) return Results.Forbid();
        // Koç optik form tanımlamamışsa öğrenci yine de platformda çözebilsin: varsayılan A-E formu
        // döner, öğrenci soru sayısını kendisi ayarlar. İlk gönderimde form bu ölçülerle kaydedilir.
        if (sheet is null)
            return Results.Ok(new { ResourceId = resourceId, QuestionCount = DefaultQuestionCount, OptionCount = 5, DurationMinutes = (int?)null, hasKey = false, answerKey = (string?)null, assignmentStatus = (string?)assignment.Status, isDefault = true });
        return Results.Ok(new { sheet.ResourceId, sheet.QuestionCount, sheet.OptionCount, sheet.DurationMinutes, hasKey = sheet.HasKey, answerKey = (string?)null, assignmentStatus = (string?)assignment.Status });
    }

    private static async Task<IResult> PutWorksheet(Guid tenantId, Guid resourceId, WorksheetRequest request,
        ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct)
    {
        if (!IsCoachOrAdmin(principal)) return Results.Forbid();
        await WorksheetStorage.EnsureAsync(db, ct);
        if (!await db.StudyResources.AsNoTracking().AnyAsync(x => x.TenantId == tenantId && x.Id == resourceId, ct))
            return Results.NotFound(new { error = "Kaynak bulunamadı." });
        var sheet = await db.ResourceWorksheets.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.ResourceId == resourceId, ct);
        try
        {
            if (sheet is null)
            {
                sheet = new ResourceWorksheet(tenantId, resourceId, request.QuestionCount, request.OptionCount, request.AnswerKey, request.DurationMinutes);
                db.ResourceWorksheets.Add(sheet);
            }
            else
            {
                var shapeChanged = sheet.QuestionCount != request.QuestionCount || sheet.OptionCount != request.OptionCount;
                var submissions = await db.ResourceSubmissions.Where(x => x.TenantId == tenantId && x.ResourceId == resourceId && x.Answers != null).ToListAsync(ct);
                if (shapeChanged && submissions.Count > 0)
                    return Results.Conflict(new { error = "Öğrenci gönderimleri varken soru veya şık sayısı değiştirilemez. Yalnızca cevap anahtarı güncellenebilir." });
                sheet.Update(request.QuestionCount, request.OptionCount, request.AnswerKey, request.DurationMinutes);
                // Anahtar değiştiyse daha önce gönderilen çalışmaların sonuçları yeniden hesaplanır.
                foreach (var submission in submissions)
                    submission.Regrade(WorksheetGrader.Grade(sheet, submission.Answers!));
            }
            await db.SaveChangesAsync(ct);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        return Results.Ok(new { sheet.ResourceId, sheet.QuestionCount, sheet.OptionCount, sheet.DurationMinutes, hasKey = sheet.HasKey, answerKey = sheet.AnswerKey });
    }

    private static async Task<IResult> PostSubmission(Guid tenantId, Guid resourceId, ResourceSubmissionRequest request,
        ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct)
    {
        await WorksheetStorage.EnsureAsync(db, ct);
        var current = await users.GetUserAsync(principal);
        if (current is null) return Results.Unauthorized();
        var resource = await db.StudyResources.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == resourceId, ct);
        if (resource is null) return Results.NotFound(new { error = "Kaynak bulunamadı." });
        var student = await FindStudentAsync(db, current, tenantId, ct);
        if (student is null) return Results.BadRequest(new { error = "Öğrenci hesabı eşleştirilemedi." });
        var assignment = await db.ResourceAssignments.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.ResourceId == resourceId && x.StudentId == student.Id, ct);
        if (assignment is null) return Results.BadRequest(new { error = "Bu kaynak size atanmış görünmüyor." });

        ResourceSubmission submission;
        ResourceWorksheet? sheet = null;
        WorksheetResult? result = null;
        if (request.Answers is not null)
        {
            sheet = await db.ResourceWorksheets.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.ResourceId == resourceId, ct);
            if (assignment.Status == "Completed")
                return Results.Conflict(new { error = "Bu çalışmayı zaten gönderdin. Yeniden çözmek için koçundan çalışmayı yeniden açmasını iste." });
            try
            {
                if (sheet is null)
                {
                    // Koçun tanımlamadığı kaynak: form öğrencinin işaretlediği soru sayısıyla anahtarsız oluşturulur.
                    // Koç daha sonra aynı ölçülerle cevap anahtarı ekleyebilir; gönderimler yeniden puanlanır.
                    sheet = new ResourceWorksheet(tenantId, resourceId, request.Answers.Trim().Length, request.OptionCount ?? 5, null, null);
                    db.ResourceWorksheets.Add(sheet);
                }
                var normalized = ResourceWorksheet.NormalizeSheet(request.Answers, sheet.QuestionCount, sheet.OptionCount);
                result = WorksheetGrader.Grade(sheet, normalized);
                submission = ResourceSubmission.CreateOptical(tenantId, resourceId, student.Id, normalized, result, request.TimeSpentSeconds);
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }
        else
        {
            try
            {
                submission = ResourceSubmission.CreateLegacy(tenantId, resourceId, student.Id, request.AnswersJson ?? string.Empty);
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }

        db.ResourceSubmissions.Add(submission);
        assignment.MarkCompleted();
        await db.SaveChangesAsync(ct);

        if (resource.UploadedByUserId.HasValue)
        {
            try
            {
                var detail = result != null && result.Graded ? $" Net: {result.Net:0.##}" : string.Empty;
                db.UserNotifications.Add(new UserNotification(resource.UploadedByUserId.Value, "Öğrenci çalışmasını gönderdi",
                    $"{student.FirstName} {student.LastName} · {resource.Subject} · {resource.Topic} çalışmasını gönderdi.{detail}", "ResourceSubmission"));
                await db.SaveChangesAsync(ct);
            }
            catch
            {
                // Gönderim kaydedildiyse bildirim oluşturulamaması gönderimi başarısız saymaz.
            }
        }
        return sheet is null
            ? Results.Ok(new { submissionId = submission.Id, sent = true })
            : Results.Ok(BuildResult(submission, sheet));
    }

    private static async Task<IResult> ListSubmissions(Guid tenantId, Guid resourceId, ClaimsPrincipal principal,
        KoclukDbContext db, CancellationToken ct)
    {
        if (!IsCoachOrAdmin(principal)) return Results.Forbid();
        await WorksheetStorage.EnsureAsync(db, ct);
        var rows = await (from submission in db.ResourceSubmissions.AsNoTracking()
                          join student in db.Students.AsNoTracking() on submission.StudentId equals student.Id
                          where submission.TenantId == tenantId && submission.ResourceId == resourceId
                          orderby submission.SubmittedAtUtc descending
                          select new
                          {
                              submission.Id,
                              submission.StudentId,
                              student.FirstName,
                              student.LastName,
                              submission.Answers,
                              submission.Correct,
                              submission.Wrong,
                              submission.Blank,
                              submission.Net,
                              submission.TimeSpentSeconds,
                              submission.SubmittedAtUtc,
                              LegacyJson = submission.Answers == null ? submission.AnswersJson : null
                          }).ToListAsync(ct);
        return Results.Ok(rows);
    }

    private static async Task<IResult> GetMySubmission(Guid tenantId, Guid resourceId, ClaimsPrincipal principal,
        UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct)
    {
        await WorksheetStorage.EnsureAsync(db, ct);
        var current = await users.GetUserAsync(principal);
        if (current is null) return Results.Unauthorized();
        var student = await FindStudentAsync(db, current, tenantId, ct);
        if (student is null) return Results.NotFound();
        var sheet = await db.ResourceWorksheets.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.ResourceId == resourceId, ct);
        if (sheet is null) return Results.NotFound();
        var submission = await db.ResourceSubmissions.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.ResourceId == resourceId && x.StudentId == student.Id && x.Answers != null)
            .OrderByDescending(x => x.SubmittedAtUtc)
            .FirstOrDefaultAsync(ct);
        return submission is null ? Results.NotFound() : Results.Ok(BuildResult(submission, sheet));
    }

    private static async Task<IResult> ReopenAssignment(Guid tenantId, Guid resourceId, Guid studentId, ClaimsPrincipal principal,
        KoclukDbContext db, CancellationToken ct)
    {
        if (!IsCoachOrAdmin(principal)) return Results.Forbid();
        var assignment = await db.ResourceAssignments.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.ResourceId == resourceId && x.StudentId == studentId, ct);
        if (assignment is null) return Results.NotFound();
        assignment.Reopen();
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> Overview(Guid tenantId, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct)
    {
        if (!IsCoachOrAdmin(principal)) return Results.Forbid();
        await WorksheetStorage.EnsureAsync(db, ct);
        var sheets = await (from w in db.ResourceWorksheets.AsNoTracking()
                            join r in db.StudyResources.AsNoTracking() on w.ResourceId equals r.Id
                            where w.TenantId == tenantId
                            orderby r.CreatedAtUtc descending
                            select new
                            {
                                w.ResourceId,
                                r.Subject,
                                r.Topic,
                                r.FileName,
                                w.QuestionCount,
                                w.OptionCount,
                                w.DurationMinutes,
                                HasKey = w.AnswerKey != null,
                                r.CreatedAtUtc
                            }).Take(100).ToListAsync(ct);
        if (sheets.Count == 0) return Results.Ok(Array.Empty<object>());
        var ids = sheets.Select(x => x.ResourceId).ToList();
        var assignments = await (from a in db.ResourceAssignments.AsNoTracking()
                                 join st in db.Students.AsNoTracking() on a.StudentId equals st.Id
                                 where a.TenantId == tenantId && ids.Contains(a.ResourceId)
                                 select new { a.ResourceId, a.StudentId, st.FirstName, st.LastName, a.Status, a.AssignedAtUtc, a.OpenedAtUtc }).ToListAsync(ct);
        var submissions = await db.ResourceSubmissions.AsNoTracking()
            .Where(s => s.TenantId == tenantId && ids.Contains(s.ResourceId) && s.Answers != null)
            .OrderByDescending(s => s.SubmittedAtUtc)
            .Select(s => new { s.ResourceId, s.StudentId, s.Correct, s.Wrong, s.Blank, s.Net, s.TimeSpentSeconds, s.SubmittedAtUtc })
            .ToListAsync(ct);
        var result = sheets.Select(sheet => new
        {
            sheet.ResourceId,
            sheet.Subject,
            sheet.Topic,
            sheet.FileName,
            sheet.QuestionCount,
            sheet.OptionCount,
            sheet.DurationMinutes,
            sheet.HasKey,
            sheet.CreatedAtUtc,
            students = assignments.Where(a => a.ResourceId == sheet.ResourceId).Select(a =>
            {
                var mine = submissions.Where(s => s.ResourceId == sheet.ResourceId && s.StudentId == a.StudentId).ToList();
                return new
                {
                    a.StudentId,
                    a.FirstName,
                    a.LastName,
                    status = a.Status,
                    a.AssignedAtUtc,
                    a.OpenedAtUtc,
                    attempts = mine.Count,
                    last = mine.FirstOrDefault()
                };
            }).ToList()
        }).ToList();
        return Results.Ok(result);
    }
}

/// <summary>
/// Geliştirme ortamındaki SQLite için tabloları tembel oluşturur. PostgreSQL'de tablolar EF migration ile gelir.
/// </summary>
public static class WorksheetStorage
{
    private static volatile bool ready;

    public static async Task EnsureAsync(KoclukDbContext db, CancellationToken ct)
    {
        if (ready || !db.Database.IsSqlite()) return;
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS ResourceWorksheets (Id TEXT NOT NULL CONSTRAINT PK_ResourceWorksheets PRIMARY KEY, TenantId TEXT NOT NULL, ResourceId TEXT NOT NULL, QuestionCount INTEGER NOT NULL, OptionCount INTEGER NOT NULL, AnswerKey TEXT NULL, DurationMinutes INTEGER NULL, CreatedAtUtc TEXT NOT NULL, UpdatedAtUtc TEXT NOT NULL);", ct);
        await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_ResourceWorksheets_ResourceId ON ResourceWorksheets (ResourceId);", ct);
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS ResourceSubmissions (Id TEXT NOT NULL CONSTRAINT PK_ResourceSubmissions PRIMARY KEY, TenantId TEXT NOT NULL, ResourceId TEXT NOT NULL, StudentId TEXT NOT NULL, AnswersJson TEXT NOT NULL, Answers TEXT NULL, Correct INTEGER NULL, Wrong INTEGER NULL, Blank INTEGER NULL, Net REAL NULL, TimeSpentSeconds INTEGER NOT NULL DEFAULT 0, SubmittedAtUtc TEXT NOT NULL);", ct);
        // Eski geliştirme veritabanlarında tablo yalnızca ilk altı sütunla oluşturulmuş olabilir.
        foreach (var column in new[]
        {
            "Answers TEXT NULL", "Correct INTEGER NULL", "Wrong INTEGER NULL", "Blank INTEGER NULL",
            "Net REAL NULL", "TimeSpentSeconds INTEGER NOT NULL DEFAULT 0"
        })
        {
            try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE ResourceSubmissions ADD COLUMN " + column + ";", ct); }
            catch (Microsoft.Data.Sqlite.SqliteException) { }
        }
        ready = true;
    }
}
