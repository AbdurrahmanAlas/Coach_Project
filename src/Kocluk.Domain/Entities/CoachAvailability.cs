namespace Kocluk.Domain.Entities;

public sealed class CoachAvailability
{
    private CoachAvailability() { }

    public CoachAvailability(Guid tenantId, Guid coachUserId, int dayOfWeek, TimeOnly startTime, TimeOnly endTime)
    {
        if (tenantId == Guid.Empty || coachUserId == Guid.Empty) throw new ArgumentException("Kurum ve koç bilgisi zorunludur.");
        if (dayOfWeek is < 0 or > 6) throw new ArgumentOutOfRangeException(nameof(dayOfWeek));
        if (endTime <= startTime) throw new ArgumentException("Bitiş saati başlangıç saatinden sonra olmalıdır.");
        TenantId = tenantId; CoachUserId = coachUserId; DayOfWeek = dayOfWeek; StartTime = startTime; EndTime = endTime; CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid TenantId { get; private set; }
    public Guid CoachUserId { get; private set; }
    public int DayOfWeek { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
}
