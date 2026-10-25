namespace Kocluk.Domain.Entities;

public sealed class AuditLog
{
    private AuditLog() { }
    public AuditLog(Guid? tenantId, Guid? userId, string action, string entityType, Guid? entityId, string? details = null)
    {
        Id = Guid.NewGuid(); TenantId = tenantId; UserId = userId; Action = action; EntityType = entityType; EntityId = entityId; Details = details; CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid? TenantId { get; private set; }
    public Guid? UserId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public Guid? EntityId { get; private set; }
    public string? Details { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
}
