namespace Kocluk.Domain.Entities;

public sealed class ResourceAssignment
{
    private ResourceAssignment() { }
    public ResourceAssignment(Guid tenantId, Guid resourceId, Guid studentId, Guid assignedByUserId, DateTime? dueDateUtc, string? note)
    {
        Id = Guid.NewGuid(); TenantId = tenantId; ResourceId = resourceId; StudentId = studentId; AssignedByUserId = assignedByUserId; DueDateUtc = dueDateUtc; Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(); Status = "Assigned"; AssignedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid ResourceId { get; private set; }
    public Guid StudentId { get; private set; }
    public Guid? AssignedByUserId { get; private set; }
    public DateTime? DueDateUtc { get; private set; }
    public string? Note { get; private set; }
    public string Status { get; private set; } = "Assigned";
    public DateTime AssignedAtUtc { get; private set; }
    public DateTime? OpenedAtUtc { get; private set; }
    public void MarkOpened() { OpenedAtUtc ??= DateTime.UtcNow; }
}
