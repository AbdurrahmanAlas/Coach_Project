namespace Kocluk.Domain.Entities;

public sealed class QuestionAssignment
{
    private QuestionAssignment() { }

    public QuestionAssignment(Guid tenantId, Guid questionBankItemId, Guid studentId, Guid assignedByUserId, DateTime? dueDateUtc, string? note)
    {
        Id = Guid.NewGuid();
        TenantId = tenantId;
        QuestionBankItemId = questionBankItemId;
        StudentId = studentId;
        AssignedByUserId = assignedByUserId;
        DueDateUtc = dueDateUtc;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Status = "Assigned";
        AssignedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid QuestionBankItemId { get; private set; }
    public Guid StudentId { get; private set; }
    public Guid? AssignedByUserId { get; private set; }
    public DateTime? DueDateUtc { get; private set; }
    public string? Note { get; private set; }
    public string Status { get; private set; } = "Assigned";
    public string? ErrorReason { get; private set; }
    public string? StudentNote { get; private set; }
    public DateTime AssignedAtUtc { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }

    public void Complete(string errorReason, string? studentNote)
    {
        Status = "Completed";
        ErrorReason = string.IsNullOrWhiteSpace(errorReason) ? null : errorReason.Trim();
        StudentNote = string.IsNullOrWhiteSpace(studentNote) ? null : studentNote.Trim();
        CompletedAtUtc = DateTime.UtcNow;
    }
}
