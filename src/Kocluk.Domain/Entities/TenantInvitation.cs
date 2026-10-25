namespace Kocluk.Domain.Entities;

public sealed class TenantInvitation
{
    private TenantInvitation() { }
    public TenantInvitation(Guid tenantId, string email, string role, DateTime expiresAtUtc)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Kurum zorunludur.");
        if (string.IsNullOrWhiteSpace(email)) throw new ArgumentException("E-posta zorunludur.");
        if (role is not ("Student" or "Parent" or "Coach")) throw new ArgumentException("Geçersiz davet rolü.");
        Id = Guid.NewGuid(); TenantId = tenantId; Email = email.Trim().ToLowerInvariant(); Role = role; Token = Convert.ToHexString(Guid.NewGuid().ToByteArray()); ExpiresAtUtc = expiresAtUtc; CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string Role { get; private set; } = string.Empty;
    public string Token { get; private set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? AcceptedAtUtc { get; private set; }
    public Guid? AcceptedByUserId { get; private set; }
    public DateTime? RevokedAtUtc { get; private set; }
    public bool IsActive => AcceptedAtUtc is null && RevokedAtUtc is null && ExpiresAtUtc > DateTime.UtcNow;
    public void Accept(Guid userId) { if (!IsActive) throw new InvalidOperationException("Davet geçerli değil."); AcceptedByUserId = userId; AcceptedAtUtc = DateTime.UtcNow; }
    public void Revoke() { if (AcceptedAtUtc is null) RevokedAtUtc = DateTime.UtcNow; }
}
