namespace Kocluk.Application.Tenants;

public interface ITenantMembershipRepository
{
    Task AddAsync(Guid tenantId, Guid userId, string role, CancellationToken cancellationToken = default);
    Task<bool> IsMemberAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default);
}
