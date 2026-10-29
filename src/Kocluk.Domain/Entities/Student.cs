namespace Kocluk.Domain.Entities;

public sealed class Student
{
    private Student() { }
    public Student(Guid tenantId, string firstName, string lastName, string? email = null, string? phoneNumber = null)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Kurum bilgisi zorunludur.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(firstName)) throw new ArgumentException("Ad zorunludur.", nameof(firstName));
        if (string.IsNullOrWhiteSpace(lastName)) throw new ArgumentException("Soyad zorunludur.", nameof(lastName));
        Id = Guid.NewGuid(); TenantId = tenantId; FirstName = firstName.Trim(); LastName = lastName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim(); PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim(); CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    /// <summary>Identity kullanıcısı ile güvenli doğrudan ilişki. Eski kayıtlar için nullable tutulur.</summary>
    public Guid? ApplicationUserId { get; private set; }
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string? PhoneNumber { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAtUtc { get; private set; }

    public void UpdateProfile(string firstName, string lastName, string? email, string? phoneNumber = null)
    {
        if (string.IsNullOrWhiteSpace(firstName)) throw new ArgumentException("Ad zorunludur.", nameof(firstName));
        if (string.IsNullOrWhiteSpace(lastName)) throw new ArgumentException("Soyad zorunludur.", nameof(lastName));
        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim();
    }

    public void LinkUser(Guid userId)
    {
        if (userId == Guid.Empty) throw new ArgumentException("Kullanıcı bilgisi zorunludur.", nameof(userId));
        ApplicationUserId = userId;
    }

    public void SoftDelete()
    {
        IsDeleted = true;
        DeletedAtUtc = DateTime.UtcNow;
    }
}
