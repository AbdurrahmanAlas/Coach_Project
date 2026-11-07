using System.Text.Json;

namespace Kocluk.Domain.Entities;

/// <summary>
/// Öğrencinin bir kaynak için koça gönderdiği çalışma. İki tür vardır:
/// optik form (Answers dolu, sunucuda puanlanmış) ve eski PDF üzerine çizim (yalnızca AnswersJson).
/// </summary>
public sealed class ResourceSubmission
{
    public const int MaxLegacyJsonLength = 3_000_000;

    private ResourceSubmission() { }

    public static ResourceSubmission CreateOptical(Guid tenantId, Guid resourceId, Guid studentId, string answers, WorksheetResult result, int timeSpentSeconds)
    {
        return new ResourceSubmission
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ResourceId = resourceId,
            StudentId = studentId,
            Answers = answers,
            AnswersJson = JsonSerializer.Serialize(new { type = "optical", answers }),
            Correct = result.Graded ? result.Correct : null,
            Wrong = result.Graded ? result.Wrong : null,
            Blank = result.Blank,
            Net = result.Graded ? result.Net : null,
            TimeSpentSeconds = Math.Clamp(timeSpentSeconds, 0, 24 * 3600),
            SubmittedAtUtc = DateTime.UtcNow
        };
    }

    public static ResourceSubmission CreateLegacy(Guid tenantId, Guid resourceId, Guid studentId, string answersJson)
    {
        if (string.IsNullOrWhiteSpace(answersJson)) throw new ArgumentException("Gönderilecek içerik boş olamaz.", nameof(answersJson));
        if (answersJson.Length > MaxLegacyJsonLength) throw new ArgumentException("Gönderilen içerik çok büyük.", nameof(answersJson));
        return new ResourceSubmission
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ResourceId = resourceId,
            StudentId = studentId,
            AnswersJson = answersJson,
            SubmittedAtUtc = DateTime.UtcNow
        };
    }

    /// <summary>Cevap anahtarı güncellendiğinde sonucu yeniden yazar.</summary>
    public void Regrade(WorksheetResult result)
    {
        Correct = result.Graded ? result.Correct : null;
        Wrong = result.Graded ? result.Wrong : null;
        Blank = result.Blank;
        Net = result.Graded ? result.Net : null;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid ResourceId { get; private set; }
    public Guid StudentId { get; private set; }
    public string AnswersJson { get; private set; } = string.Empty;
    public string? Answers { get; private set; }
    public int? Correct { get; private set; }
    public int? Wrong { get; private set; }
    public int? Blank { get; private set; }
    public double? Net { get; private set; }
    public int TimeSpentSeconds { get; private set; }
    public DateTime SubmittedAtUtc { get; private set; }
}
