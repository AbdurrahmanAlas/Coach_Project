using Kocluk.Domain.Entities;
namespace Kocluk.Application.StudyPlans;
public interface IStudyPlanRepository
{
    Task AddAsync(StudyPlan plan, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudyPlan>> ListByStudentAsync(Guid tenantId, Guid studentId, CancellationToken cancellationToken = default);
    Task<StudyPlan?> GetAsync(Guid tenantId, Guid planId, CancellationToken cancellationToken = default);
    Task<StudyPlan?> UpdateTaskProgressAsync(Guid tenantId, Guid planId, Guid taskId, int completedQuestions, bool isCompleted, CancellationToken cancellationToken = default);
    Task<StudyPlan?> UpdateTaskAsync(Guid tenantId, Guid planId, Guid taskId, string title, DateOnly dueDate, int targetQuestions, CancellationToken cancellationToken = default);
    Task<StudyPlan?> DeleteTaskAsync(Guid tenantId, Guid planId, Guid taskId, CancellationToken cancellationToken = default);
    Task<StudyPlan?> RenameAsync(Guid tenantId, Guid planId, string title, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid planId, CancellationToken cancellationToken = default);
}
