namespace Kocluk.Domain.Entities;

public sealed class DataDeletionRequest
{
    private DataDeletionRequest() { }

    public DataDeletionRequest(Guid userId, string? reason)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        Status = "Pending";
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string? Reason { get; private set; }
    public string Status { get; private set; } = "Pending";
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ProcessedAtUtc { get; private set; }
    public Guid? ProcessedByUserId { get; private set; }

    public void MarkProcessed(Guid adminUserId)
    {
        Status = "Processed";
        ProcessedAtUtc = DateTime.UtcNow;
        ProcessedByUserId = adminUserId;
    }
}
