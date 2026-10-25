using Kocluk.Domain.Entities;
namespace Kocluk.Application.Students;
public interface IStudentRepository
{
    Task AddAsync(Student student, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Student>> ListAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<Student?> GetAsync(Guid tenantId, Guid studentId, CancellationToken cancellationToken = default);
    Task UpdateAsync(Student student, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid studentId, CancellationToken cancellationToken = default);
}
