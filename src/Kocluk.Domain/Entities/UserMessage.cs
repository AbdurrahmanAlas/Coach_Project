namespace Kocluk.Domain.Entities;

public sealed class UserMessage
{
    private UserMessage() { }
    public UserMessage(Guid tenantId, Guid senderUserId, Guid recipientUserId, string content)
    {
        if (content is null || string.IsNullOrWhiteSpace(content) || content.Trim().Length > 4000)
            throw new ArgumentException("Mesaj 1-4000 karakter arasında olmalıdır.", nameof(content));
        Id = Guid.NewGuid(); TenantId = tenantId; SenderUserId = senderUserId; RecipientUserId = recipientUserId; Content = content.Trim(); SentAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid SenderUserId { get; private set; }
    public Guid RecipientUserId { get; private set; }
    public string Content { get; private set; } = string.Empty;
    public DateTime SentAtUtc { get; private set; }
    public DateTime? ReadAtUtc { get; private set; }
    public void MarkRead() => ReadAtUtc ??= DateTime.UtcNow;
}
