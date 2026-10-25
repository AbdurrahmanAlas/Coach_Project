using Kocluk.Domain.Entities;
namespace Kocluk.Application.Tenants;
public interface ITenantRepository
{
    Task AddAsync(Tenant tenant, CancellationToken cancellationToken = default);
    Task<Tenant?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
    Task<Tenant?> GetByIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
