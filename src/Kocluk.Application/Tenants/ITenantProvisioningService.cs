using Kocluk.Domain.Entities;

namespace Kocluk.Application.Tenants;

public interface ITenantProvisioningService
{
    Task<Tenant> CreateForOwnerAsync(string name, string slug, Guid ownerUserId, CancellationToken cancellationToken = default);
}
