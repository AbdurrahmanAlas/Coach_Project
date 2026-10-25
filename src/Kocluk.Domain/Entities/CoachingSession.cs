namespace Kocluk.Domain.Entities;

public sealed class CoachingSession
{
    private CoachingSession() { }
    public CoachingSession(Guid tenantId, Guid studentId, DateTime startsAtUtc, int durationMinutes, string? note = null, string status = "Scheduled")
    {
        if (tenantId == Guid.Empty || studentId == Guid.Empty) throw new ArgumentException("Koçluk alanı ve öğrenci zorunludur.");
        if (durationMinutes is < 15 or > 240) throw new ArgumentOutOfRangeException(nameof(durationMinutes));
        if (startsAtUtc <= DateTime.UtcNow.AddMinutes(-1)) throw new ArgumentException("Görüşme zamanı geçmişte olamaz.");
        Id = Guid.NewGuid(); TenantId = tenantId; StudentId = studentId; StartsAtUtc = startsAtUtc;
        DurationMinutes = durationMinutes; Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Status = status; CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid StudentId { get; private set; }
    public DateTime StartsAtUtc { get; private set; }
    public int DurationMinutes { get; private set; }
    public string? Note { get; private set; }
    public string Status { get; private set; } = "Scheduled";
    public DateTime CreatedAtUtc { get; private set; }

    public void Reschedule(DateTime startsAtUtc, int durationMinutes, string? note)
    {
        if (durationMinutes is < 15 or > 240) throw new ArgumentOutOfRangeException(nameof(durationMinutes));
        if (startsAtUtc <= DateTime.UtcNow.AddMinutes(-1)) throw new ArgumentException("Görüşme zamanı geçmişte olamaz.");
        StartsAtUtc = startsAtUtc; DurationMinutes = durationMinutes; Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }
    public void Confirm() => Status = "Scheduled";
    public void Cancel() => Status = "Cancelled";
}
