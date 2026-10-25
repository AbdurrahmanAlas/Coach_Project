namespace Kocluk.Infrastructure.Persistence;

public sealed class TenantMembership
{
    private TenantMembership() { }
    public TenantMembership(Guid tenantId, Guid userId, string role)
    {
        TenantId = tenantId;
        UserId = userId;
        Role = role;
        CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid TenantId { get; private set; }
    public Guid UserId { get; private set; }
    public string Role { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }
}
