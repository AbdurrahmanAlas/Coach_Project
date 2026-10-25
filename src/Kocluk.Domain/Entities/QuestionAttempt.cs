namespace Kocluk.Domain.Entities;

public sealed class QuestionAttempt
{
    private QuestionAttempt() { }
    public QuestionAttempt(Guid tenantId, Guid questionId, Guid studentId, string selectedAnswer, bool isCorrect)
    {
        Id = Guid.NewGuid(); TenantId = tenantId; QuestionBankItemId = questionId; StudentId = studentId; SelectedAnswer = selectedAnswer?.Trim() ?? string.Empty; IsCorrect = isCorrect; AttemptedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid QuestionBankItemId { get; private set; }
    public Guid StudentId { get; private set; }
    public string SelectedAnswer { get; private set; } = string.Empty;
    public bool IsCorrect { get; private set; }
    public DateTime AttemptedAtUtc { get; private set; }
}
