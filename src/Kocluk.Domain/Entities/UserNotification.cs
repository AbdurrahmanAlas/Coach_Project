namespace Kocluk.Domain.Entities;

public sealed class UserNotification
{
    private UserNotification() { }
    public UserNotification(Guid userId, string title, string message, string? type = null)
    {
        if (userId == Guid.Empty) throw new ArgumentException("Kullanıcı zorunludur.");
        Id = Guid.NewGuid(); UserId = userId; Title = title.Trim(); Message = message.Trim(); Type = type; CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public string? Type { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ReadAtUtc { get; private set; }
    public void MarkRead() => ReadAtUtc ??= DateTime.UtcNow;
}
