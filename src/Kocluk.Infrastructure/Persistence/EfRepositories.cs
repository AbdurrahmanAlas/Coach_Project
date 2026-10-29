using Kocluk.Application.Students;
using Kocluk.Application.StudyPlans;
using Kocluk.Application.Tenants;
using Kocluk.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Kocluk.Infrastructure.Persistence;

public sealed class EfStudentRepository(KoclukDbContext db) : IStudentRepository
{
    public async Task AddAsync(Student student, CancellationToken cancellationToken = default)
    {
        db.Students.Add(student);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Student>> ListAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        await db.Students.AsNoTracking().Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.LastName).ThenBy(x => x.FirstName).ToListAsync(cancellationToken);

    public Task<Student?> GetAsync(Guid tenantId, Guid studentId, CancellationToken cancellationToken = default) =>
        db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == studentId, cancellationToken);

    public async Task UpdateAsync(Student student, CancellationToken cancellationToken = default)
    {
        db.Students.Update(student);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid studentId, CancellationToken cancellationToken = default)
    {
        var student = await db.Students.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == studentId, cancellationToken);
        if (student is null) return false;
        student.SoftDelete();
        db.Students.Update(student);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class EfTenantRepository(KoclukDbContext db) : ITenantRepository
{
    public async Task AddAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Tenant?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        db.Tenants.AsNoTracking().SingleOrDefaultAsync(x => x.Slug == slug, cancellationToken);

    public Task<Tenant?> GetByIdAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        db.Tenants.AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
}

public sealed class EfStudyPlanRepository(KoclukDbContext db) : IStudyPlanRepository
{
    public async Task AddAsync(StudyPlan plan, CancellationToken cancellationToken = default)
    {
        db.StudyPlans.Add(plan);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StudyPlan>> ListByStudentAsync(Guid tenantId, Guid studentId, CancellationToken cancellationToken = default) =>
        await db.StudyPlans.AsNoTracking().Include(nameof(StudyPlan.Tasks))
            .Where(x => x.TenantId == tenantId && x.StudentId == studentId)
            .OrderByDescending(x => x.WeekStart).ToListAsync(cancellationToken);

    public Task<StudyPlan?> GetAsync(Guid tenantId, Guid planId, CancellationToken cancellationToken = default) =>
        db.StudyPlans.Include(nameof(StudyPlan.Tasks)).SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == planId, cancellationToken);

    public async Task<StudyPlan?> UpdateTaskProgressAsync(Guid tenantId, Guid planId, Guid taskId,
        int completedQuestions, bool isCompleted, CancellationToken cancellationToken = default)
    {
        var plan = await GetAsync(tenantId, planId, cancellationToken);
        var task = plan?.FindTask(taskId);
        if (task is null) return null;
        task.UpdateProgress(completedQuestions, isCompleted);
        await db.SaveChangesAsync(cancellationToken);
        return plan;
    }

    public async Task<StudyPlan?> UpdateTaskAsync(Guid tenantId, Guid planId, Guid taskId, string title, DateOnly dueDate, int targetQuestions, CancellationToken cancellationToken = default)
    {
        var plan = await GetAsync(tenantId, planId, cancellationToken); var task = plan?.FindTask(taskId);
        if (plan is null || task is null) return null;
        if (dueDate < plan.WeekStart || dueDate > plan.WeekStart.AddDays(6)) throw new ArgumentException("Görev tarihi plan haftasının içinde olmalıdır.", nameof(dueDate));
        task.Update(title, dueDate, targetQuestions); await db.SaveChangesAsync(cancellationToken); return plan;
    }

    public async Task<StudyPlan?> DeleteTaskAsync(Guid tenantId, Guid planId, Guid taskId, CancellationToken cancellationToken = default)
    {
        var plan = await GetAsync(tenantId, planId, cancellationToken); if (plan is null || !plan.RemoveTask(taskId)) return null;
        await db.SaveChangesAsync(cancellationToken); return plan;
    }

    public async Task<StudyPlan?> RenameAsync(Guid tenantId, Guid planId, string title, CancellationToken cancellationToken = default)
    {
        var plan = await GetAsync(tenantId, planId, cancellationToken); if (plan is null) return null;
        plan.Rename(title); await db.SaveChangesAsync(cancellationToken); return plan;
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid planId, CancellationToken cancellationToken = default)
    {
        var plan = await db.StudyPlans.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == planId, cancellationToken); if (plan is null) return false;
        db.StudyPlans.Remove(plan); await db.SaveChangesAsync(cancellationToken); return true;
    }
}

public sealed class EfTenantMembershipRepository(KoclukDbContext db) : ITenantMembershipRepository
{
    public async Task AddAsync(Guid tenantId, Guid userId, string role, CancellationToken cancellationToken = default)
    {
        db.TenantMemberships.Add(new TenantMembership(tenantId, userId, role));
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<bool> IsMemberAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default) =>
        db.TenantMemberships.AnyAsync(x => x.TenantId == tenantId && x.UserId == userId, cancellationToken);

    public Task<string?> GetRoleAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default) =>
        db.TenantMemberships.Where(x => x.TenantId == tenantId && x.UserId == userId)
            .Select(x => x.Role).SingleOrDefaultAsync(cancellationToken);
}

public sealed class EfTenantProvisioningService(KoclukDbContext db) : ITenantProvisioningService
{
    public async Task<Tenant> CreateForOwnerAsync(string name, string slug, Guid ownerUserId, CancellationToken cancellationToken = default)
    {
        var tenant = new Tenant(name, slug);
        db.Tenants.Add(tenant);
        db.TenantMemberships.Add(new TenantMembership(tenant.Id, ownerUserId, "Owner"));
        db.TenantSubscriptions.Add(new TenantSubscription(tenant.Id));
        await db.SaveChangesAsync(cancellationToken);
        return tenant;
    }
}
