namespace Kocluk.Domain.Entities;

public sealed class LessonSlot
{
    private LessonSlot() { }

    public LessonSlot(Guid tenantId, Guid studentId, Guid? createdByUserId, DateOnly date, TimeOnly startTime, TimeOnly? endTime, string examType, string subject, string? topic, string? note)
    {
        if (tenantId == Guid.Empty || studentId == Guid.Empty) throw new ArgumentException("Koçluk alanı ve öğrenci zorunludur.");
        Id = Guid.NewGuid(); TenantId = tenantId; StudentId = studentId; CreatedByUserId = createdByUserId; CreatedAtUtc = DateTime.UtcNow;
        Update(date, startTime, endTime, examType, subject, topic, note);
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid StudentId { get; private set; }
    public Guid? CreatedByUserId { get; private set; }
    public DateOnly Date { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly? EndTime { get; private set; }
    public string ExamType { get; private set; } = string.Empty;
    public string Subject { get; private set; } = string.Empty;
    public string? Topic { get; private set; }
    public string? Note { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public void Update(DateOnly date, TimeOnly startTime, TimeOnly? endTime, string examType, string subject, string? topic, string? note)
    {
        if (string.IsNullOrWhiteSpace(examType) || examType.Trim().Length > 16) throw new ArgumentException("Sınav türü zorunludur.", nameof(examType));
        if (string.IsNullOrWhiteSpace(subject) || subject.Trim().Length > 120) throw new ArgumentException("Ders zorunludur.", nameof(subject));
        if (endTime is not null && endTime <= startTime) throw new ArgumentException("Bitiş saati başlangıç saatinden sonra olmalıdır.");
        if (topic is { Length: > 300 }) throw new ArgumentException("Konu en fazla 300 karakter olabilir.", nameof(topic));
        if (note is { Length: > 500 }) throw new ArgumentException("Not en fazla 500 karakter olabilir.", nameof(note));
        Date = date; StartTime = startTime; EndTime = endTime;
        ExamType = examType.Trim(); Subject = subject.Trim();
        Topic = string.IsNullOrWhiteSpace(topic) ? null : topic.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }
}
