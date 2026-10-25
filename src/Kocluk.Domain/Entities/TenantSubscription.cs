namespace Kocluk.Domain.Entities;

public sealed class TenantSubscription
{
    private TenantSubscription() { }
    public TenantSubscription(Guid tenantId, string planCode = "Starter")
    {
        TenantId = tenantId; PlanCode = planCode; Status = "Trial"; MaxCoaches = 1; MaxStudents = 20; CurrentPeriodEndUtc = DateTime.UtcNow.AddDays(14); Id = Guid.NewGuid();
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string PlanCode { get; private set; } = "Starter";
    public string Status { get; private set; } = "Trial";
    public int MaxCoaches { get; private set; }
    public int MaxStudents { get; private set; }
    public DateTime CurrentPeriodEndUtc { get; private set; }
    public bool IsActive => Status is "Trial" or "Active" && CurrentPeriodEndUtc > DateTime.UtcNow;
    public void RefreshStatus()
    {
        if (CurrentPeriodEndUtc <= DateTime.UtcNow && Status is not "Cancelled")
            Status = "Expired";
    }
    public void Cancel() => Status = "Cancelled";
    public void MarkPaymentFailed() => Status = "PastDue";
    public void Activate(string? planCode = null, DateTime? periodEndUtc = null)
    {
        if (!string.IsNullOrWhiteSpace(planCode))
            ChangePlan(planCode);
        else
        {
            Status = "Active";
            CurrentPeriodEndUtc = periodEndUtc ?? DateTime.UtcNow.AddMonths(1);
        }
        if (periodEndUtc is not null) CurrentPeriodEndUtc = periodEndUtc.Value;
    }
    public void ChangePlan(string planCode)
    {
        PlanCode = planCode;
        (MaxCoaches, MaxStudents) = planCode switch { "Professional" => (5, 200), "Enterprise" => (50, 5000), _ => (1, 20) };
        Status = "Active";
        CurrentPeriodEndUtc = DateTime.UtcNow.AddMonths(1);
    }
}
