namespace Kocluk.Domain.Entities;

/// <summary>Ödeme sağlayıcısından gelen webhook olayının tekrar işlenmesini önler.</summary>
public sealed class BillingWebhookEvent
{
    private BillingWebhookEvent() { }

    public BillingWebhookEvent(string provider, string eventId, string eventType, Guid tenantId, string payloadHash)
    {
        Id = Guid.NewGuid();
        Provider = provider;
        EventId = eventId;
        EventType = eventType;
        TenantId = tenantId;
        PayloadHash = payloadHash;
        ReceivedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public string Provider { get; private set; } = string.Empty;
    public string EventId { get; private set; } = string.Empty;
    public string EventType { get; private set; } = string.Empty;
    public Guid TenantId { get; private set; }
    public string PayloadHash { get; private set; } = string.Empty;
    public DateTime ReceivedAtUtc { get; private set; }
}
