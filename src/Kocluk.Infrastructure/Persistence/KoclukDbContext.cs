using Kocluk.Domain.Entities;
using Kocluk.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Kocluk.Infrastructure.Persistence;

public sealed class KoclukDbContext(DbContextOptions<KoclukDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<StudentGuardian> StudentGuardians => Set<StudentGuardian>();
    public DbSet<CoachingSession> CoachingSessions => Set<CoachingSession>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ExamAttempt> ExamAttempts => Set<ExamAttempt>();
    public DbSet<TenantInvitation> TenantInvitations => Set<TenantInvitation>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<SubjectProgress> SubjectProgresses => Set<SubjectProgress>();
    public DbSet<TenantSubscription> TenantSubscriptions => Set<TenantSubscription>();
    public DbSet<StudyPlan> StudyPlans => Set<StudyPlan>();
    public DbSet<TenantMembership> TenantMemberships => Set<TenantMembership>();
    public DbSet<DataDeletionRequest> DataDeletionRequests => Set<DataDeletionRequest>();
    public DbSet<CoachAvailability> CoachAvailabilities => Set<CoachAvailability>();
    public DbSet<BillingWebhookEvent> BillingWebhookEvents => Set<BillingWebhookEvent>();
    public DbSet<UserMessage> UserMessages => Set<UserMessage>();
    public DbSet<QuestionBankItem> QuestionBankItems => Set<QuestionBankItem>();
    public DbSet<QuestionAttempt> QuestionAttempts => Set<QuestionAttempt>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<ApplicationUser>().Property(x => x.FirstName).HasMaxLength(100);
        builder.Entity<ApplicationUser>().Property(x => x.LastName).HasMaxLength(100);
        builder.Entity<ApplicationUser>().Property(x => x.PrivacyPolicyVersion).HasMaxLength(32);

        builder.Entity<Tenant>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => x.Slug).IsUnique();
        });

        builder.Entity<Student>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasQueryFilter(x => !x.IsDeleted);
            entity.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.PhoneNumber).HasMaxLength(32);
            entity.HasIndex(x => new { x.TenantId, x.LastName, x.FirstName });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<StudentGuardian>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.PhoneNumber).HasMaxLength(32).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.StudentId });
            entity.HasOne<Student>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.ParentUserId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<CoachingSession>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.StudentId, x.StartsAtUtc });
            entity.HasOne<Student>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Action).HasMaxLength(64).IsRequired();
            entity.Property(x => x.EntityType).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Details).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<ExamAttempt>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Score).HasPrecision(6, 2);
            entity.HasIndex(x => new { x.TenantId, x.StudentId, x.ExamDate });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Student>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<TenantInvitation>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Role).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Token).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => x.Token).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.Email, x.Role });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.AcceptedByUserId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<UserNotification>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Type).HasMaxLength(64);
            entity.HasIndex(x => new { x.UserId, x.CreatedAtUtc });
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<SubjectProgress>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Subject).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Topic).HasMaxLength(180).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.StudentId, x.Subject, x.Topic }).IsUnique();
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Student>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<TenantSubscription>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.PlanCode).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<StudyPlan>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(160).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.StudentId, x.WeekStart });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Student>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany<StudyTask>(nameof(StudyPlan.Tasks)).WithOne()
                .HasForeignKey(x => x.StudyPlanId).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(nameof(StudyPlan.Tasks)).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<StudyTask>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
        });

        builder.Entity<TenantMembership>(entity =>
        {
            entity.HasKey(x => new { x.TenantId, x.UserId });
            entity.Property(x => x.Role).HasMaxLength(32).IsRequired();
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<DataDeletionRequest>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Reason).HasMaxLength(1000);
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.HasIndex(x => new { x.UserId, x.Status });
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.ProcessedByUserId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<BillingWebhookEvent>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Provider).HasMaxLength(32).IsRequired();
            entity.Property(x => x.EventId).HasMaxLength(180).IsRequired();
            entity.Property(x => x.EventType).HasMaxLength(80).IsRequired();
            entity.Property(x => x.PayloadHash).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => new { x.Provider, x.EventId }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.ReceivedAtUtc });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<UserMessage>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Content).HasMaxLength(4000).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.RecipientUserId, x.SentAtUtc });
            entity.HasIndex(x => new { x.TenantId, x.SenderUserId, x.SentAtUtc });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.SenderUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.RecipientUserId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<QuestionBankItem>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Subject).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Topic).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Prompt).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Answer).HasMaxLength(1000);
            entity.Property(x => x.Explanation).HasMaxLength(4000);
            entity.Property(x => x.Difficulty).HasMaxLength(16).IsRequired();
            entity.Property(x => x.ExamType).HasMaxLength(80);
            entity.HasIndex(x => new { x.TenantId, x.Subject, x.Topic, x.IsPublished });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<QuestionAttempt>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SelectedAnswer).HasMaxLength(1000).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.StudentId, x.AttemptedAtUtc });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<QuestionBankItem>().WithMany().HasForeignKey(x => x.QuestionBankItemId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Student>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
