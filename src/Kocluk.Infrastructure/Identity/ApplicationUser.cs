using Microsoft.AspNetCore.Identity;

namespace Kocluk.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public ApplicationUser() => Id = Guid.NewGuid();
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public DateTime? PrivacyConsentAtUtc { get; set; }
    public string? PrivacyPolicyVersion { get; set; }
}
