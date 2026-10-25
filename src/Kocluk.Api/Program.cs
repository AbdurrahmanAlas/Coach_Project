using System.Security.Claims;
using System.Diagnostics;
using Kocluk.Application.Students;
using Kocluk.Application.StudyPlans;
using Kocluk.Application.Tenants;
using Kocluk.Domain.Entities;
using Kocluk.Infrastructure.Identity;
using Kocluk.Infrastructure.Persistence;
using Kocluk.Infrastructure.Email;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
var dataProtectionPath = builder.Configuration["DATA_PROTECTION_KEYS_PATH"]
    ?? Path.Combine(builder.Environment.ContentRootPath, ".keys");
Directory.CreateDirectory(dataProtectionPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionPath))
    .SetApplicationName("Kocluk.Api");

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection ayarı bulunamadı.");
var configuredProvider = builder.Configuration["DatabaseProvider"] ?? (builder.Environment.IsDevelopment() ? "Sqlite" : "Postgres");
if (builder.Environment.IsProduction())
{
    if (!configuredProvider.Equals("Postgres", StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("Production ortamında yalnızca PostgreSQL kullanılabilir.");
    if (connectionString.Contains("change-this", StringComparison.OrdinalIgnoreCase) || connectionString.Contains("Password=;", StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("Production PostgreSQL parolası örnek/değiştirilmemiş görünüyor.");
    var publicUrl = builder.Configuration["APP_PUBLIC_URL"];
    if (!Uri.TryCreate(publicUrl, UriKind.Absolute, out var publicUri) || publicUri.Scheme != Uri.UriSchemeHttps)
        throw new InvalidOperationException("Production APP_PUBLIC_URL HTTPS olmalıdır.");
    var smtpHost = builder.Configuration["SMTP_HOST"];
    var smtpFrom = builder.Configuration["SMTP_FROM"];
    var smtpUsername = builder.Configuration["SMTP_USERNAME"];
    var smtpPassword = builder.Configuration["SMTP_PASSWORD"];
    if (string.IsNullOrWhiteSpace(smtpHost) || smtpHost.Contains("example.com", StringComparison.OrdinalIgnoreCase)
        || string.IsNullOrWhiteSpace(smtpFrom) || smtpFrom.Contains("example.com", StringComparison.OrdinalIgnoreCase)
        || string.IsNullOrWhiteSpace(smtpUsername) || string.IsNullOrWhiteSpace(smtpPassword))
        throw new InvalidOperationException("Production ortamında gerçek SMTP host, kullanıcı, parola ve gönderici adresi tanımlanmalıdır.");
}

builder.Services.AddDbContext<KoclukDbContext>(options =>
{
    var provider = configuredProvider;
    if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        options.UseSqlite(connectionString);
    }
    else
    {
        options.UseNpgsql(connectionString, npgsql => npgsql
            .EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)
            .CommandTimeout(30));
    }
});
builder.Services.AddIdentityApiEndpoints<ApplicationUser>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 10;
    options.Password.RequireDigit = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = false;
    options.Lockout.MaxFailedAccessAttempts = 5;
})
.AddRoles<IdentityRole<Guid>>()
.AddEntityFrameworkStores<KoclukDbContext>();
builder.Services.AddAuthorization();
builder.Services.AddProblemDetails();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 240,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));
});
builder.Services.AddScoped<IStudentRepository, EfStudentRepository>();
builder.Services.AddScoped<IStudyPlanRepository, EfStudyPlanRepository>();
builder.Services.AddScoped<ITenantRepository, EfTenantRepository>();
builder.Services.AddScoped<ITenantMembershipRepository, EfTenantMembershipRepository>();
builder.Services.AddScoped<ITenantProvisioningService, EfTenantProvisioningService>();
builder.Services.AddScoped<TenantMembershipFilter>();
builder.Services.Configure<EmailOptions>(options =>
{
    options.Host = builder.Configuration["SMTP_HOST"] ?? string.Empty;
    options.Port = int.TryParse(builder.Configuration["SMTP_PORT"], out var port) ? port : 587;
    options.Username = builder.Configuration["SMTP_USERNAME"] ?? string.Empty;
    options.Password = builder.Configuration["SMTP_PASSWORD"] ?? string.Empty;
    options.From = builder.Configuration["SMTP_FROM"] ?? string.Empty;
    options.PublicUrl = builder.Configuration["APP_PUBLIC_URL"] ?? "https://localhost:7098";
});
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

var app = builder.Build();
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers.TryGetValue("X-Correlation-ID", out var incoming) && !string.IsNullOrWhiteSpace(incoming)
        ? incoming.ToString() : Guid.NewGuid().ToString("N");
    context.Response.Headers["X-Correlation-ID"] = correlationId;
    var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("RequestTrace");
    var started = Stopwatch.GetTimestamp();
    try { await next(); }
    finally
    {
        var elapsed = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        logger.LogInformation("{Method} {Path} -> {StatusCode} ({ElapsedMs:0} ms) [{CorrelationId}]", context.Request.Method, context.Request.Path, context.Response.StatusCode, elapsed, correlationId);
    }
});
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    if (!app.Environment.IsDevelopment())
        context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    await next();
});
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();

var databaseProvider = app.Configuration["DatabaseProvider"] ?? (app.Environment.IsDevelopment() ? "Sqlite" : "Postgres");
if (databaseProvider.Equals("Postgres", StringComparison.OrdinalIgnoreCase))
{
    await using var migrationScope = app.Services.CreateAsyncScope();
    var migrationDb = migrationScope.ServiceProvider.GetRequiredService<KoclukDbContext>();
    await migrationDb.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<KoclukDbContext>();
    var provider = databaseProvider;
    if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
        await db.Database.EnsureCreatedAsync();
    if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE AspNetUsers ADD COLUMN FirstName TEXT NULL;"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE AspNetUsers ADD COLUMN LastName TEXT NULL;"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE AspNetUsers ADD COLUMN PrivacyConsentAtUtc TEXT NULL;"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE AspNetUsers ADD COLUMN PrivacyPolicyVersion TEXT NULL;"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DataDeletionRequests (Id TEXT NOT NULL CONSTRAINT PK_DataDeletionRequests PRIMARY KEY, UserId TEXT NOT NULL, Reason TEXT NULL, Status TEXT NOT NULL, CreatedAtUtc TEXT NOT NULL, ProcessedAtUtc TEXT NULL, ProcessedByUserId TEXT NULL);");
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE Students ADD COLUMN PhoneNumber TEXT NULL;"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE Students ADD COLUMN IsDeleted INTEGER NOT NULL DEFAULT 0;"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE Students ADD COLUMN DeletedAtUtc TEXT NULL;"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS StudentGuardians (Id TEXT NOT NULL CONSTRAINT PK_StudentGuardians PRIMARY KEY, TenantId TEXT NOT NULL, StudentId TEXT NOT NULL, ParentUserId TEXT NULL, FirstName TEXT NOT NULL, LastName TEXT NOT NULL, Email TEXT NULL, PhoneNumber TEXT NOT NULL, CreatedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS CoachingSessions (Id TEXT NOT NULL CONSTRAINT PK_CoachingSessions PRIMARY KEY, TenantId TEXT NOT NULL, StudentId TEXT NOT NULL, StartsAtUtc TEXT NOT NULL, DurationMinutes INTEGER NOT NULL, Note TEXT NULL, Status TEXT NOT NULL, CreatedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS AuditLogs (Id TEXT NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY, TenantId TEXT NULL, UserId TEXT NULL, Action TEXT NOT NULL, EntityType TEXT NOT NULL, EntityId TEXT NULL, Details TEXT NULL, CreatedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS ExamAttempts (Id TEXT NOT NULL CONSTRAINT PK_ExamAttempts PRIMARY KEY, TenantId TEXT NOT NULL, StudentId TEXT NOT NULL, Title TEXT NOT NULL, ExamDate TEXT NOT NULL, Correct INTEGER NOT NULL, Wrong INTEGER NOT NULL, Blank INTEGER NOT NULL, Score TEXT NOT NULL, CreatedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS TenantInvitations (Id TEXT NOT NULL CONSTRAINT PK_TenantInvitations PRIMARY KEY, TenantId TEXT NOT NULL, Email TEXT NOT NULL, Role TEXT NOT NULL, Token TEXT NOT NULL, ExpiresAtUtc TEXT NOT NULL, CreatedAtUtc TEXT NOT NULL, AcceptedAtUtc TEXT NULL, AcceptedByUserId TEXT NULL);");
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE TenantInvitations ADD COLUMN RevokedAtUtc TEXT NULL;"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS UserNotifications (Id TEXT NOT NULL CONSTRAINT PK_UserNotifications PRIMARY KEY, UserId TEXT NOT NULL, Title TEXT NOT NULL, Message TEXT NOT NULL, Type TEXT NULL, CreatedAtUtc TEXT NOT NULL, ReadAtUtc TEXT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS SubjectProgresses (Id TEXT NOT NULL CONSTRAINT PK_SubjectProgresses PRIMARY KEY, TenantId TEXT NOT NULL, StudentId TEXT NOT NULL, Subject TEXT NOT NULL, Topic TEXT NOT NULL, CompletionPercent INTEGER NOT NULL, CreatedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS TenantSubscriptions (Id TEXT NOT NULL CONSTRAINT PK_TenantSubscriptions PRIMARY KEY, TenantId TEXT NOT NULL UNIQUE, PlanCode TEXT NOT NULL, Status TEXT NOT NULL, MaxCoaches INTEGER NOT NULL, MaxStudents INTEGER NOT NULL, CurrentPeriodEndUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS CoachAvailabilities (Id TEXT NOT NULL CONSTRAINT PK_CoachAvailabilities PRIMARY KEY, TenantId TEXT NOT NULL, CoachUserId TEXT NOT NULL, DayOfWeek INTEGER NOT NULL, StartTime TEXT NOT NULL, EndTime TEXT NOT NULL, CreatedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS BillingWebhookEvents (Id TEXT NOT NULL CONSTRAINT PK_BillingWebhookEvents PRIMARY KEY, Provider TEXT NOT NULL, EventId TEXT NOT NULL, EventType TEXT NOT NULL, TenantId TEXT NOT NULL, PayloadHash TEXT NOT NULL, ReceivedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_BillingWebhookEvents_Provider_EventId ON BillingWebhookEvents (Provider, EventId);");
        await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_BillingWebhookEvents_TenantId_ReceivedAtUtc ON BillingWebhookEvents (TenantId, ReceivedAtUtc);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS UserMessages (Id TEXT NOT NULL CONSTRAINT PK_UserMessages PRIMARY KEY, TenantId TEXT NOT NULL, SenderUserId TEXT NOT NULL, RecipientUserId TEXT NOT NULL, Content TEXT NOT NULL, SentAtUtc TEXT NOT NULL, ReadAtUtc TEXT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_UserMessages_TenantId_RecipientUserId_SentAtUtc ON UserMessages (TenantId, RecipientUserId, SentAtUtc);");
        await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_UserMessages_TenantId_SenderUserId_SentAtUtc ON UserMessages (TenantId, SenderUserId, SentAtUtc);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS QuestionBankItems (Id TEXT NOT NULL CONSTRAINT PK_QuestionBankItems PRIMARY KEY, TenantId TEXT NOT NULL, CreatedByUserId TEXT NULL, Subject TEXT NOT NULL, Topic TEXT NOT NULL, Prompt TEXT NOT NULL, Answer TEXT NULL, Explanation TEXT NULL, Difficulty TEXT NOT NULL, ExamType TEXT NOT NULL, IsPublished INTEGER NOT NULL, CreatedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_QuestionBankItems_TenantId_Subject_Topic_IsPublished ON QuestionBankItems (TenantId, Subject, Topic, IsPublished);");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS QuestionAttempts (Id TEXT NOT NULL CONSTRAINT PK_QuestionAttempts PRIMARY KEY, TenantId TEXT NOT NULL, QuestionBankItemId TEXT NOT NULL, StudentId TEXT NOT NULL, SelectedAnswer TEXT NOT NULL, IsCorrect INTEGER NOT NULL, AttemptedAtUtc TEXT NOT NULL);");
        await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_QuestionAttempts_TenantId_StudentId_AttemptedAtUtc ON QuestionAttempts (TenantId, StudentId, AttemptedAtUtc);");
    }
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    foreach (var role in new[] { "Student", "Parent", "Coach", "Admin" })
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole<Guid>(role));

    // Geliştirme ortamında ilk giriş için hazır yönetici hesabı.
    // Üretim ortamında bu hesap oluşturulmaz; yönetici davet akışı kullanılmalıdır.
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    const string seedAdminEmail = "admin@kocluk.local";
    const string seedAdminPassword = "Admin12345";
    var seedAdmin = await userManager.FindByEmailAsync(seedAdminEmail);
    if (seedAdmin is null)
    {
        seedAdmin = new ApplicationUser { UserName = seedAdminEmail, Email = seedAdminEmail, EmailConfirmed = true };
        var createResult = await userManager.CreateAsync(seedAdmin, seedAdminPassword);
        if (createResult.Succeeded)
            await userManager.AddToRoleAsync(seedAdmin, "Admin");
    }
    else if (!await userManager.IsInRoleAsync(seedAdmin, "Admin"))
    {
        await userManager.AddToRoleAsync(seedAdmin, "Admin");
    }

    // Demo/test için hazır koç hesabı. Gerçek kullanımda koç davet akışıyla eklenir.
    const string seedCoachEmail = "koc@kocluk.local";
    const string seedCoachPassword = "Coach12345";
    var seedCoach = await userManager.FindByEmailAsync(seedCoachEmail);
    if (seedCoach is null)
    {
        seedCoach = new ApplicationUser { UserName = seedCoachEmail, Email = seedCoachEmail, EmailConfirmed = true };
        var createResult = await userManager.CreateAsync(seedCoach, seedCoachPassword);
        if (createResult.Succeeded)
            await userManager.AddToRoleAsync(seedCoach, "Coach");
    }
    else if (!await userManager.IsInRoleAsync(seedCoach, "Coach"))
    {
        await userManager.AddToRoleAsync(seedCoach, "Coach");
    }
}

if (!app.Environment.IsDevelopment())
{
    await using var roleScope = app.Services.CreateAsyncScope();
    var roleManager = roleScope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    foreach (var role in new[] { "Student", "Parent", "Coach", "Admin" })
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole<Guid>(role));
    var adminEmail = app.Configuration["INITIAL_ADMIN_EMAIL"];
    var adminPassword = app.Configuration["INITIAL_ADMIN_PASSWORD"];
    if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword))
    {
        var userManager = roleScope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var initialAdmin = await userManager.FindByEmailAsync(adminEmail);
        if (initialAdmin is null)
        {
            initialAdmin = new ApplicationUser { UserName = adminEmail, Email = adminEmail, EmailConfirmed = true };
            var createResult = await userManager.CreateAsync(initialAdmin, adminPassword);
            if (!createResult.Succeeded) throw new InvalidOperationException($"INITIAL_ADMIN hesabı oluşturulamadı: {string.Join(" ", createResult.Errors.Select(error => error.Description))}");
        }
        if (!await userManager.IsInRoleAsync(initialAdmin, "Admin")) await userManager.AddToRoleAsync(initialAdmin, "Admin");
    }
}

app.MapGet("/api/health", () => Results.Ok(new { name = "Kocluk API", status = "running", environment = app.Environment.EnvironmentName }));
app.MapGet("/api/health/live", () => Results.Ok(new { status = "live" }));
app.MapGet("/api/health/ready", async (KoclukDbContext db, CancellationToken ct) =>
{
    try
    {
        var connected = await db.Database.CanConnectAsync(ct);
        return connected ? Results.Ok(new { status = "ready", database = "connected" }) : Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
    catch { return Results.StatusCode(StatusCodes.Status503ServiceUnavailable); }
});
app.MapGroup("/api/auth").RequireRateLimiting("auth").MapIdentityApi<ApplicationUser>();

app.MapGet("/api/notifications", async (ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!TryGetUserId(principal, out var userId)) return Results.Unauthorized();
    var notifications = await db.UserNotifications.AsNoTracking().Where(x => x.UserId == userId).OrderByDescending(x => x.CreatedAtUtc).Take(50).ToListAsync(ct);
    return Results.Ok(notifications.Select(x => new { x.Id, x.Title, x.Message, x.Type, x.CreatedAtUtc, x.ReadAtUtc }));
}).RequireAuthorization();
app.MapPost("/api/notifications/{id:guid}/read", async (Guid id, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!TryGetUserId(principal, out var userId)) return Results.Unauthorized();
    var notification = await db.UserNotifications.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
    if (notification is null) return Results.NotFound(); notification.MarkRead(); await db.SaveChangesAsync(ct); return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/invitations/{token}", async (string token, KoclukDbContext db, CancellationToken ct) =>
{
    var invitation = await db.TenantInvitations.AsNoTracking().SingleOrDefaultAsync(x => x.Token == token, ct);
    return invitation is null || !invitation.IsActive ? Results.NotFound(new { error = "Davet geçersiz veya süresi dolmuş." }) : Results.Ok(new { invitation.Email, invitation.Role, invitation.ExpiresAtUtc });
});
app.MapPost("/api/invitations/{token}/accept", async (string token, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var user = await users.GetUserAsync(principal);
    if (user?.Email is null) return Results.Unauthorized();
    var invitation = await db.TenantInvitations.SingleOrDefaultAsync(x => x.Token == token, ct);
    if (invitation is null || !invitation.IsActive) return Results.BadRequest(new { error = "Davet geçersiz veya süresi dolmuş." });
    if (invitation.Role is not ("Student" or "Parent" or "Coach")) return Results.BadRequest(new { error = "Davet rolü geçersiz." });
    if (!string.Equals(invitation.Email, user.Email, StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    if (!await users.IsInRoleAsync(user, invitation.Role)) await users.AddToRoleAsync(user, invitation.Role);
    if (!await db.TenantMemberships.AnyAsync(x => x.TenantId == invitation.TenantId && x.UserId == user.Id, ct)) db.TenantMemberships.Add(new TenantMembership(invitation.TenantId, user.Id, invitation.Role));
    invitation.Accept(user.Id); await db.SaveChangesAsync(ct);
    return Results.Ok(new { invitation.TenantId, role = invitation.Role });
}).RequireAuthorization();

app.MapGet("/api/tenants", async (ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub"), out var userId))
        return Results.Unauthorized();
    var tenants = await (from membership in db.TenantMemberships.AsNoTracking()
                         join tenant in db.Tenants.AsNoTracking() on membership.TenantId equals tenant.Id
                         where membership.UserId == userId
                         orderby tenant.Name
                         select new { tenant.Id, tenant.Name, tenant.Slug, membership.Role })
        .ToListAsync(ct);
    return Results.Ok(tenants);
}).RequireAuthorization();

app.MapGet("/api/auth/me", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
{
    if (principal.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var user = await users.GetUserAsync(principal);
    if (user is null) return Results.Unauthorized();
    return Results.Ok(new { id = user.Id, email = user.Email, firstName = user.FirstName, lastName = user.LastName, privacyConsentAtUtc = user.PrivacyConsentAtUtc, privacyPolicyVersion = user.PrivacyPolicyVersion, roles = await users.GetRolesAsync(user) });
});

app.MapPut("/api/auth/profile", async (UpdateProfileRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
{
    var user = await users.GetUserAsync(principal); if (user is null) return Results.Unauthorized();
    user.FirstName = request.FirstName?.Trim(); user.LastName = request.LastName?.Trim();
    var result = await users.UpdateAsync(user); if (!result.Succeeded) return Results.BadRequest(new { error = string.Join(" ", result.Errors.Select(x => x.Description)) });
    return Results.Ok(new { user.Id, user.Email, user.FirstName, user.LastName });
}).RequireAuthorization();
app.MapPost("/api/auth/password", async (ChangePasswordRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
{
    var user = await users.GetUserAsync(principal); if (user is null) return Results.Unauthorized();
    var result = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
    return result.Succeeded ? Results.NoContent() : Results.BadRequest(new { error = string.Join(" ", result.Errors.Select(x => x.Description)) });
}).RequireAuthorization();
app.MapGet("/api/account/export", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var user = await users.GetUserAsync(principal); if (user is null) return Results.Unauthorized();
    var memberships = await db.TenantMemberships.AsNoTracking().Where(x => x.UserId == user.Id).ToListAsync(ct);
    var notifications = await db.UserNotifications.AsNoTracking().Where(x => x.UserId == user.Id).ToListAsync(ct);
    var deletionRequests = await db.DataDeletionRequests.AsNoTracking().Where(x => x.UserId == user.Id).OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
    var payload = new { account = new { user.Id, user.Email, user.FirstName, user.LastName, user.EmailConfirmed, user.PrivacyConsentAtUtc, user.PrivacyPolicyVersion }, memberships, notifications, deletionRequests };
    return Results.Json(payload, contentType: "application/json", statusCode: StatusCodes.Status200OK);
}).RequireAuthorization();
app.MapPost("/api/account/privacy-consent", async (PrivacyConsentRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var user = await users.GetUserAsync(principal); if (user is null) return Results.Unauthorized();
    if (!request.Accepted || string.IsNullOrWhiteSpace(request.PolicyVersion)) return Results.BadRequest(new { error = "Gizlilik politikası onayı zorunludur." });
    user.PrivacyConsentAtUtc = DateTime.UtcNow; user.PrivacyPolicyVersion = request.PolicyVersion.Trim();
    var result = await users.UpdateAsync(user); if (!result.Succeeded) return Results.BadRequest(new { error = "Onay kaydedilemedi." });
    db.AuditLogs.Add(new AuditLog(null, user.Id, "PrivacyConsentAccepted", "ApplicationUser", user.Id, user.PrivacyPolicyVersion)); await db.SaveChangesAsync(ct);
    return Results.NoContent();
}).RequireAuthorization();

app.MapPost("/api/account/deletion-request", async (DataDeletionRequestPayload request, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var user = await users.GetUserAsync(principal); if (user is null) return Results.Unauthorized();
    var pending = await db.DataDeletionRequests.AnyAsync(x => x.UserId == user.Id && x.Status == "Pending", ct);
    if (pending) return Results.Conflict(new { error = "Bekleyen veri silme talebiniz zaten var." });
    var item = new DataDeletionRequest(user.Id, request.Reason);
    db.DataDeletionRequests.Add(item);
    var admins = await users.GetUsersInRoleAsync("Admin");
    foreach (var admin in admins)
        db.UserNotifications.Add(new UserNotification(admin.Id, "Veri silme talebi", $"{user.Email} hesabı için veri silme talebi oluşturuldu.", "privacy"));
    db.AuditLogs.Add(new AuditLog(null, user.Id, "DeletionRequested", "DataDeletionRequest", item.Id));
    await db.SaveChangesAsync(ct);
    return Results.Created($"/api/account/deletion-request/{item.Id}", new { item.Id, item.Status, item.CreatedAtUtc });
}).RequireAuthorization();

app.MapGet("/api/admin/deletion-requests", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Admin")) return Results.Forbid();
    var requests = await (from item in db.DataDeletionRequests.AsNoTracking()
                          join user in db.Users.AsNoTracking() on item.UserId equals user.Id
                          orderby item.CreatedAtUtc descending
                          select new { item.Id, item.UserId, user.Email, user.FirstName, user.LastName, item.Reason, item.Status, item.CreatedAtUtc, item.ProcessedAtUtc }).ToListAsync(ct);
    return Results.Ok(requests);
}).RequireAuthorization();

app.MapGet("/api/admin/tenants", async (ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Admin")) return Results.Forbid();
    var tenants = await (from tenant in db.Tenants.AsNoTracking()
                         join subscription in db.TenantSubscriptions.AsNoTracking() on tenant.Id equals subscription.TenantId into subscriptions
                         from subscription in subscriptions.DefaultIfEmpty()
                         select new { tenant.Id, tenant.Name, tenant.Slug, StudentCount = db.Students.Count(student => student.TenantId == tenant.Id), MemberCount = db.TenantMemberships.Count(member => member.TenantId == tenant.Id), Subscription = subscription == null ? null : new { subscription.PlanCode, subscription.Status, subscription.MaxStudents, subscription.MaxCoaches, subscription.CurrentPeriodEndUtc } })
        .OrderBy(x => x.Name).ToListAsync(ct);
    return Results.Ok(tenants);
}).RequireAuthorization();

app.MapPost("/api/admin/tenants/{tenantId:guid}/subscription/plan", async (Guid tenantId, ChangePlanRequest request, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Admin")) return Results.Forbid();
    if (request.PlanCode is not ("Starter" or "Professional" or "Enterprise")) return Results.BadRequest(new { error = "Geçersiz paket." });
    var subscription = await db.TenantSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
    if (subscription is null) { subscription = new TenantSubscription(tenantId); db.TenantSubscriptions.Add(subscription); }
    subscription.ChangePlan(request.PlanCode);
    await db.SaveChangesAsync(ct);
    await WriteAuditAsync(db, principal, tenantId, "AdminPlanChanged", "TenantSubscription", subscription.Id, request.PlanCode, ct);
    return Results.Ok(subscription);
}).RequireAuthorization();

app.MapPost("/api/admin/deletion-requests/{id:guid}/process", async (Guid id, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Admin")) return Results.Forbid();
    var admin = await users.GetUserAsync(principal); if (admin is null) return Results.Unauthorized();
    var item = await db.DataDeletionRequests.SingleOrDefaultAsync(x => x.Id == id, ct);
    if (item is null) return Results.NotFound();
    item.MarkProcessed(admin.Id);
    db.AuditLogs.Add(new AuditLog(null, admin.Id, "DeletionProcessed", "DataDeletionRequest", item.Id));
    await db.SaveChangesAsync(ct);
    return Results.Ok(new { item.Id, item.Status, item.ProcessedAtUtc });
}).RequireAuthorization();

app.MapGet("/api/parent/students", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var parent = await users.GetUserAsync(principal);
    if (parent is null) return Results.Unauthorized();
    var result = await (from guardian in db.StudentGuardians.AsNoTracking()
                        join student in db.Students.AsNoTracking() on guardian.StudentId equals student.Id
                        where guardian.ParentUserId == parent.Id || (guardian.ParentUserId == null && guardian.Email == parent.Email)
                        select new { student.Id, student.FirstName, student.LastName, student.TenantId, ParentFirstName = guardian.FirstName, ParentLastName = guardian.LastName })
        .ToListAsync(ct);
    return Results.Ok(result);
}).RequireAuthorization();

app.MapGet("/api/parent/students/{studentId:guid}/overview", async (
    Guid studentId, ClaimsPrincipal principal, UserManager<ApplicationUser> users,
    KoclukDbContext db, CancellationToken ct) =>
{
    var parent = await users.GetUserAsync(principal);
    if (parent is null) return Results.Unauthorized();
    var linked = await (from guardian in db.StudentGuardians.AsNoTracking()
                        join item in db.Students.AsNoTracking() on guardian.StudentId equals item.Id
                        where guardian.StudentId == studentId &&
                              (guardian.ParentUserId == parent.Id || (guardian.ParentUserId == null && guardian.Email == parent.Email))
                        select new { Student = item, Guardian = guardian }).SingleOrDefaultAsync(ct);
    if (linked is null) return Results.NotFound();
    var student = linked.Student;
    var plans = await db.StudyPlans.AsNoTracking().Include(nameof(StudyPlan.Tasks))
        .Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id)
        .OrderByDescending(x => x.WeekStart).ToListAsync(ct);
    var sessions = await db.CoachingSessions.AsNoTracking()
        .Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id)
        .OrderBy(x => x.StartsAtUtc).ToListAsync(ct);
    var exams = await db.ExamAttempts.AsNoTracking()
        .Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id)
        .OrderByDescending(x => x.ExamDate).Take(10).ToListAsync(ct);
    var subjects = await db.SubjectProgresses.AsNoTracking().Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id).OrderBy(x => x.Subject).ThenBy(x => x.Topic).ToListAsync(ct);
    return Results.Ok(new
    {
        student = ToStudentResponse(student, linked.Guardian),
        plans = plans.Select(ToPlanResponse),
        sessions = sessions.Select(ToSessionResponse),
        exams = exams.Select(ToExamResponse),
        subjects
    });
}).RequireAuthorization();

app.MapGet("/api/student/me/overview", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var user = await users.GetUserAsync(principal);
    if (user?.Email is null) return Results.Unauthorized();
    var student = await db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Email == user.Email, ct);
    if (student is null) return Results.NotFound();
    var plans = await db.StudyPlans.AsNoTracking().Include(nameof(StudyPlan.Tasks)).Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id).OrderByDescending(x => x.WeekStart).ToListAsync(ct);
    var sessions = await db.CoachingSessions.AsNoTracking().Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id).OrderBy(x => x.StartsAtUtc).ToListAsync(ct);
    var exams = await db.ExamAttempts.AsNoTracking().Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id).OrderByDescending(x => x.ExamDate).Take(10).ToListAsync(ct);
    var subjects = await db.SubjectProgresses.AsNoTracking().Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id).OrderBy(x => x.Subject).ThenBy(x => x.Topic).ToListAsync(ct);
    var questionAttempts = await db.QuestionAttempts.AsNoTracking().Where(x => x.TenantId == student.TenantId && x.StudentId == student.Id).Select(x => x.IsCorrect).ToListAsync(ct);
    var questionTotal = questionAttempts.Count; var questionCorrect = questionAttempts.Count(x => x);
    var questionSummary = new { total = questionTotal, correct = questionCorrect, wrong = questionTotal - questionCorrect, rate = questionTotal == 0 ? 0 : Math.Round(questionCorrect * 100m / questionTotal, 1) };
    return Results.Ok(new { student = ToStudentResponse(student), plans = plans.Select(ToPlanResponse), sessions = sessions.Select(ToSessionResponse), exams = exams.Select(ToExamResponse), subjects, questionSummary });
}).RequireAuthorization();

app.MapPost("/api/student/me/session-requests", async (CreateSessionRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, IConfiguration configuration, CancellationToken ct) =>
{
    var user = await users.GetUserAsync(principal);
    if (user?.Email is null) return Results.Unauthorized();
    var student = await db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Email == user.Email, ct);
    if (student is null) return Results.NotFound(new { error = "Öğrenci profili bulunamadı." });
    try
    {
        var starts = request.StartsAtUtc.ToUniversalTime(); var ends = starts.AddMinutes(request.DurationMinutes);
        var availability = await db.CoachAvailabilities.AsNoTracking().Where(x => x.TenantId == student.TenantId).ToListAsync(ct);
        if (availability.Count > 0)
        {
            var timeZoneId = configuration["COACH_TIME_ZONE"] ?? (OperatingSystem.IsWindows() ? "Turkey Standard Time" : "Europe/Istanbul");
            TimeZoneInfo timeZone; try { timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); } catch { try { timeZone = TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time"); } catch { timeZone = TimeZoneInfo.Utc; } }
            var localStart = TimeZoneInfo.ConvertTimeFromUtc(starts, timeZone); var localEnd = localStart.AddMinutes(request.DurationMinutes);
            var fits = availability.Any(slot => slot.DayOfWeek == (int)localStart.DayOfWeek && TimeOnly.FromDateTime(localStart) >= slot.StartTime && TimeOnly.FromDateTime(localEnd) <= slot.EndTime);
            if (!fits) return Results.Conflict(new { error = "Seçtiğiniz tarih ve saat koçun müsaitlik aralığında değil." });
        }
        var conflict = await db.CoachingSessions.AnyAsync(x => x.TenantId == student.TenantId && x.Status != "Cancelled" && starts < x.StartsAtUtc.AddMinutes(x.DurationMinutes) && ends > x.StartsAtUtc, ct);
        if (conflict) return Results.Conflict(new { error = "Bu saat aralığında başka bir görüşme bulunuyor." });
        var session = new CoachingSession(student.TenantId, student.Id, starts, request.DurationMinutes, request.Note, "Pending"); db.CoachingSessions.Add(session);
        var coaches = await db.TenantMemberships.Where(x => x.TenantId == student.TenantId && x.Role == "Coach").Select(x => x.UserId).ToListAsync(ct);
        foreach (var coachId in coaches) db.UserNotifications.Add(new UserNotification(coachId, "Yeni görüşme talebi", $"{student.FirstName} {student.LastName} için yeni bir koçluk görüşmesi talebi var.", "SessionRequest"));
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/student/me/session-requests/{session.Id}", ToSessionResponse(session));
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
}).RequireAuthorization();
app.MapPost("/api/student/me/session-requests/{sessionId:guid}/cancel", async (Guid sessionId, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var user = await users.GetUserAsync(principal); if (user?.Email is null) return Results.Unauthorized();
    var student = await db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Email == user.Email, ct); if (student is null) return Results.NotFound();
    var session = await db.CoachingSessions.SingleOrDefaultAsync(x => x.Id == sessionId && x.StudentId == student.Id && x.TenantId == student.TenantId && x.Status == "Pending", ct);
    if (session is null) return Results.NotFound(new { error = "Bekleyen görüşme talebi bulunamadı." });
    session.Cancel(); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, student.TenantId, "Cancelled", "CoachingSession", session.Id, "StudentRequest", ct); return Results.Ok(ToSessionResponse(session));
}).RequireAuthorization();

app.MapGet("/api/admin/audit-logs", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, int? take, CancellationToken ct) =>
{
    var actor = await users.GetUserAsync(principal);
    if (actor is null || !await users.IsInRoleAsync(actor, "Admin")) return Results.Forbid();
    var limit = Math.Clamp(take ?? 100, 1, 500);
    var logs = await db.AuditLogs.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).Take(limit).ToListAsync(ct);
    return Results.Ok(logs);
}).RequireAuthorization();

app.MapGet("/api/admin/audit-logs/export", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var actor = await users.GetUserAsync(principal);
    if (actor is null || !await users.IsInRoleAsync(actor, "Admin")) return Results.Forbid();
    var rows = await db.AuditLogs.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).Take(5000).ToListAsync(ct);
    static string Csv(string value) => $"\"{value.Replace("\"", "\"\"")}\"";
    var csv = "Id,Action,EntityType,EntityId,UserId,TenantId,Details,CreatedAtUtc\n" + string.Join('\n', rows.Select(row => string.Join(',', new[] { row.Id.ToString(), row.Action, row.EntityType, row.EntityId?.ToString() ?? "", row.UserId?.ToString() ?? "", row.TenantId?.ToString() ?? "", row.Details ?? "", row.CreatedAtUtc.ToString("O") }.Select(Csv))));
    return Results.File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "audit-logs.csv");
}).RequireAuthorization();

app.MapGet("/api/admin/users", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
{
    var actor = await users.GetUserAsync(principal);
    if (actor is null || !await users.IsInRoleAsync(actor, "Admin")) return Results.Forbid();
    var result = new List<object>();
    foreach (var user in users.Users.OrderBy(x => x.Email))
        result.Add(new { id = user.Id, email = user.Email, emailConfirmed = user.EmailConfirmed, locked = user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow, roles = await users.GetRolesAsync(user) });
    return Results.Ok(result);
}).RequireAuthorization();
app.MapPost("/api/admin/users/{userId:guid}/lock", async (Guid userId, LockUserRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var actor = await users.GetUserAsync(principal); if (actor is null || !await users.IsInRoleAsync(actor, "Admin")) return Results.Forbid();
    var target = await users.FindByIdAsync(userId.ToString()); if (target is null) return Results.NotFound();
    target.LockoutEnabled = request.Locked; target.LockoutEnd = request.Locked ? DateTimeOffset.UtcNow.AddYears(10) : null;
    var result = await users.UpdateAsync(target); if (!result.Succeeded) return Results.BadRequest(new { error = string.Join(" ", result.Errors.Select(x => x.Description)) });
    await WriteAuditAsync(db, principal, null, request.Locked ? "Locked" : "Unlocked", "User", userId, target.Email, ct);
    return Results.Ok(new { userId, locked = request.Locked });
}).RequireAuthorization();

app.MapPost("/api/auth/role", async (SetRoleRequest request, ClaimsPrincipal principal,
    UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signInManager, KoclukDbContext db, CancellationToken ct) =>
{
    if (principal.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var allowed = new[] { "Student", "Parent", "Coach", "Admin" };
    if (!allowed.Contains(request.Role, StringComparer.OrdinalIgnoreCase))
        return Results.BadRequest(new { error = "Geçersiz rol." });
    var user = await users.GetUserAsync(principal);
    if (user is null) return Results.Unauthorized();
    var current = await users.GetRolesAsync(user);
    if ((request.Role.Equals("Coach", StringComparison.OrdinalIgnoreCase) || request.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
        && !current.Contains("Admin", StringComparer.OrdinalIgnoreCase))
        return Results.Forbid();
    if (current.Count > 0) await users.RemoveFromRolesAsync(user, current);
    await users.AddToRoleAsync(user, allowed.First(x => x.Equals(request.Role, StringComparison.OrdinalIgnoreCase)));
    await signInManager.RefreshSignInAsync(user);
    await WriteAuditAsync(db, principal, null, "RoleChanged", "User", user.Id, request.Role, ct);
    return Results.Ok(new { role = request.Role });
}).RequireAuthorization();

app.MapPost("/api/auth/users/{userId:guid}/role", async (Guid userId, SetRoleRequest request,
    ClaimsPrincipal principal, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signInManager, KoclukDbContext db, CancellationToken ct) =>
{
    if (principal.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var actor = await users.GetUserAsync(principal);
    if (actor is null || !await users.IsInRoleAsync(actor, "Admin")) return Results.Forbid();
    var allowed = new[] { "Student", "Parent", "Coach", "Admin" };
    var role = allowed.FirstOrDefault(x => x.Equals(request.Role, StringComparison.OrdinalIgnoreCase));
    if (role is null) return Results.BadRequest(new { error = "Geçersiz rol." });
    var target = await users.FindByIdAsync(userId.ToString());
    if (target is null) return Results.NotFound();
    var current = await users.GetRolesAsync(target);
    if (current.Count > 0) await users.RemoveFromRolesAsync(target, current);
    await users.AddToRoleAsync(target, role);
    await signInManager.RefreshSignInAsync(target);
    await WriteAuditAsync(db, principal, null, "RoleChanged", "User", userId, role, ct);
    return Results.Ok(new { userId, role });
}).RequireAuthorization();

app.MapPost("/api/tenants", async (
    CreateTenantRequest request, ClaimsPrincipal user,
    ITenantProvisioningService provisioning, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    var currentUser = await users.GetUserAsync(user);
    if (currentUser is null || !await users.IsInRoleAsync(currentUser, "Coach"))
        return Results.Forbid();
    if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var userId))
        return Results.Unauthorized();
    try
    {
        var tenant = await provisioning.CreateForOwnerAsync(request.Name, request.Slug, userId, ct);
        return Results.Created($"/api/tenants/{tenant.Id}", new TenantResponse(tenant.Id, tenant.Name, tenant.Slug));
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
})
.RequireAuthorization();

var tenantApi = app.MapGroup("/api/tenants/{tenantId:guid}")
    .RequireAuthorization()
    .AddEndpointFilter<TenantMembershipFilter>();

tenantApi.MapGet("/plans", async (Guid tenantId, KoclukDbContext db, CancellationToken ct) =>
{
    var plans = await db.StudyPlans.AsNoTracking().Include(nameof(StudyPlan.Tasks))
        .Where(x => x.TenantId == tenantId)
        .OrderByDescending(x => x.WeekStart)
        .ToListAsync(ct);
    return Results.Ok(plans.Select(ToPlanResponse));
});
tenantApi.MapGet("/subscription", async (Guid tenantId, KoclukDbContext db, CancellationToken ct) =>
{
    var subscription = await db.TenantSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
    subscription?.RefreshStatus();
    if (subscription is not null) await db.SaveChangesAsync(ct);
    return subscription is null ? Results.NotFound() : Results.Ok(subscription);
});
tenantApi.MapPost("/subscription/plan", async (Guid tenantId, ChangePlanRequest request, KoclukDbContext db, ClaimsPrincipal principal, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin")) return Results.Forbid();
    if (request.PlanCode is not ("Starter" or "Professional" or "Enterprise")) return Results.BadRequest(new { error = "Geçersiz paket." });
    var subscription = await db.TenantSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
    if (subscription is null) { subscription = new TenantSubscription(tenantId); db.TenantSubscriptions.Add(subscription); }
    subscription.ChangePlan(request.PlanCode); var memberIds = await db.TenantMemberships.Where(x => x.TenantId == tenantId).Select(x => x.UserId).ToListAsync(ct); foreach (var memberId in memberIds) db.UserNotifications.Add(new UserNotification(memberId, "Abonelik paketi güncellendi", $"Koçluk alanının paketi {request.PlanCode} olarak güncellendi.", "Subscription")); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "PlanChanged", "TenantSubscription", subscription.Id, request.PlanCode, ct); return Results.Ok(subscription);
});
tenantApi.MapPost("/subscription/cancel", async (Guid tenantId, KoclukDbContext db, ClaimsPrincipal principal, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin")) return Results.Forbid();
    var subscription = await db.TenantSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
    if (subscription is null) return Results.NotFound();
    subscription.Cancel();
    var memberIds = await db.TenantMemberships.Where(x => x.TenantId == tenantId).Select(x => x.UserId).ToListAsync(ct);
    foreach (var memberId in memberIds) db.UserNotifications.Add(new UserNotification(memberId, "Abonelik iptal edildi", "Koçluk alanının aboneliği iptal edildi.", "Subscription"));
    await db.SaveChangesAsync(ct);
    await WriteAuditAsync(db, principal, tenantId, "SubscriptionCancelled", "TenantSubscription", subscription.Id, subscription.PlanCode, ct);
    return Results.Ok(new { subscription.Id, subscription.Status, subscription.CurrentPeriodEndUtc });
});

tenantApi.MapGet("/messages", async (Guid tenantId, ClaimsPrincipal principal, KoclukDbContext db, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    var current = await users.GetUserAsync(principal);
    if (current is null) return Results.Unauthorized();
    var items = await (from message in db.UserMessages.AsNoTracking()
                       join sender in db.Users.AsNoTracking() on message.SenderUserId equals sender.Id
                       join recipient in db.Users.AsNoTracking() on message.RecipientUserId equals recipient.Id
                       where message.TenantId == tenantId && (message.SenderUserId == current.Id || message.RecipientUserId == current.Id)
                       orderby message.SentAtUtc descending
                       select new { message.Id, message.SenderUserId, SenderName = (sender.FirstName + " " + sender.LastName).Trim(), message.RecipientUserId, RecipientName = (recipient.FirstName + " " + recipient.LastName).Trim(), message.Content, message.SentAtUtc, message.ReadAtUtc }).Take(100).ToListAsync(ct);
    return Results.Ok(items);
});

tenantApi.MapPost("/messages", async (Guid tenantId, SendMessageRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var sender = await users.GetUserAsync(principal);
    if (sender is null) return Results.Unauthorized();
    if (request.RecipientUserId == sender.Id) return Results.BadRequest(new { error = "Kendinize mesaj gönderemezsiniz." });
    var recipientInTenant = await db.TenantMemberships.AnyAsync(x => x.TenantId == tenantId && x.UserId == request.RecipientUserId, ct);
    if (!recipientInTenant) return Results.NotFound(new { error = "Alıcı bu koçluk alanında bulunamadı." });
    try
    {
        var message = new UserMessage(tenantId, sender.Id, request.RecipientUserId, request.Content);
        db.UserMessages.Add(message);
        db.UserNotifications.Add(new UserNotification(request.RecipientUserId, "Yeni mesaj", $"{sender.FirstName} {sender.LastName} size yeni bir mesaj gönderdi.", "Message"));
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/tenants/{tenantId}/messages/{message.Id}", new { message.Id, message.RecipientUserId, message.Content, message.SentAtUtc });
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapPost("/messages/{messageId:guid}/read", async (Guid tenantId, Guid messageId, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var current = await users.GetUserAsync(principal);
    if (current is null) return Results.Unauthorized();
    var message = await db.UserMessages.SingleOrDefaultAsync(x => x.Id == messageId && x.TenantId == tenantId && x.RecipientUserId == current.Id, ct);
    if (message is null) return Results.NotFound();
    message.MarkRead(); await db.SaveChangesAsync(ct);
    return Results.Ok(new { message.Id, message.ReadAtUtc });
});

tenantApi.MapGet("/question-bank", async (Guid tenantId, string? subject, string? topic, string? difficulty, string? examType, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    var includeAnswers = principal.IsInRole("Coach") || principal.IsInRole("Admin");
    var query = db.QuestionBankItems.AsNoTracking().Where(x => x.TenantId == tenantId && (includeAnswers || x.IsPublished));
    if (!string.IsNullOrWhiteSpace(subject)) query = query.Where(x => x.Subject == subject);
    if (!string.IsNullOrWhiteSpace(topic)) query = query.Where(x => x.Topic == topic);
    if (!string.IsNullOrWhiteSpace(difficulty)) query = query.Where(x => x.Difficulty == difficulty);
    if (!string.IsNullOrWhiteSpace(examType)) query = query.Where(x => x.ExamType == examType);
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Take(200).ToListAsync(ct);
    return Results.Ok(items.Select(x => ToQuestionResponse(x, includeAnswers)));
});

tenantApi.MapPost("/question-bank", async (Guid tenantId, QuestionBankRequest request, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin")) return Results.Forbid();
    TryGetUserId(principal, out var userId);
    try { var item = new QuestionBankItem(tenantId, userId, request.Subject, request.Topic, request.Prompt, request.Answer, request.Explanation, request.Difficulty, request.ExamType); item.SetPublished(request.IsPublished); db.QuestionBankItems.Add(item); await db.SaveChangesAsync(ct); return Results.Created($"/api/tenants/{tenantId}/question-bank/{item.Id}", ToQuestionResponse(item, true)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapPut("/question-bank/{questionId:guid}", async (Guid tenantId, Guid questionId, QuestionBankRequest request, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin")) return Results.Forbid();
    var item = await db.QuestionBankItems.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == questionId, ct); if (item is null) return Results.NotFound();
    try { item.Update(request.Subject, request.Topic, request.Prompt, request.Answer, request.Explanation, request.Difficulty, request.ExamType); item.SetPublished(request.IsPublished); await db.SaveChangesAsync(ct); return Results.Ok(ToQuestionResponse(item, true)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapDelete("/question-bank/{questionId:guid}", async (Guid tenantId, Guid questionId, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin")) return Results.Forbid();
    var item = await db.QuestionBankItems.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == questionId, ct); if (item is null) return Results.NotFound(); db.QuestionBankItems.Remove(item); await db.SaveChangesAsync(ct); return Results.NoContent();
});

tenantApi.MapPost("/question-bank/{questionId:guid}/attempt", async (Guid tenantId, Guid questionId, QuestionAttemptRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var current = await users.GetUserAsync(principal); if (current is null) return Results.Unauthorized();
    if (!principal.IsInRole("Student")) return Results.Forbid();
    var student = await db.Students.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Email != null && x.Email == current.Email, ct);
    if (student is null) return Results.Forbid();
    var question = await db.QuestionBankItems.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == questionId && x.IsPublished, ct);
    if (question is null) return Results.NotFound();
    var isCorrect = !string.IsNullOrWhiteSpace(question.Answer) && string.Equals(question.Answer.Trim(), request.Answer?.Trim(), StringComparison.OrdinalIgnoreCase);
    var attempt = new QuestionAttempt(tenantId, questionId, student.Id, request.Answer ?? string.Empty, isCorrect);
    db.QuestionAttempts.Add(attempt); await db.SaveChangesAsync(ct);
    return Results.Ok(new { attempt.Id, attempt.IsCorrect, CorrectAnswer = question.Answer is null ? null : (isCorrect ? question.Answer : null), question.Explanation, attempt.AttemptedAtUtc });
});

tenantApi.MapGet("/students/{studentId:guid}/question-attempts", async (Guid tenantId, Guid studentId, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin") && !principal.IsInRole("Parent")) return Results.Forbid();
    if (principal.IsInRole("Parent"))
    {
        var parent = await users.GetUserAsync(principal);
        if (parent is null || !await db.StudentGuardians.AnyAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.ParentUserId == parent.Id, ct)) return Results.Forbid();
    }
    var attempts = await (from attempt in db.QuestionAttempts.AsNoTracking()
                          join question in db.QuestionBankItems.AsNoTracking() on attempt.QuestionBankItemId equals question.Id
                          where attempt.TenantId == tenantId && attempt.StudentId == studentId
                          orderby attempt.AttemptedAtUtc descending
                          select new { attempt.Id, attempt.QuestionBankItemId, question.Subject, question.Topic, attempt.IsCorrect, attempt.AttemptedAtUtc }).Take(500).ToListAsync(ct);
    return Results.Ok(attempts);
});

tenantApi.MapGet("/students/{studentId:guid}/question-summary", async (Guid tenantId, Guid studentId, ClaimsPrincipal principal, UserManager<ApplicationUser> users, KoclukDbContext db, CancellationToken ct) =>
{
    var allowed = principal.IsInRole("Coach") || principal.IsInRole("Admin");
    if (principal.IsInRole("Student"))
    {
        var current = await users.GetUserAsync(principal);
        allowed = current is not null && await db.Students.AnyAsync(x => x.TenantId == tenantId && x.Id == studentId && x.Email == current.Email, ct);
    }
    else if (principal.IsInRole("Parent"))
    {
        var parent = await users.GetUserAsync(principal);
        allowed = parent is not null && await db.StudentGuardians.AnyAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.ParentUserId == parent.Id, ct);
    }
    if (!allowed) return Results.Forbid();
    var attempts = await (from attempt in db.QuestionAttempts.AsNoTracking()
                          join question in db.QuestionBankItems.AsNoTracking() on attempt.QuestionBankItemId equals question.Id
                          where attempt.TenantId == tenantId && attempt.StudentId == studentId
                          select new { question.Subject, question.Topic, attempt.IsCorrect, attempt.AttemptedAtUtc }).ToListAsync(ct);
    var total = attempts.Count; var correct = attempts.Count(x => x.IsCorrect);
    var bySubject = attempts.GroupBy(x => x.Subject).Select(group => new { subject = group.Key, total = group.Count(), correct = group.Count(x => x.IsCorrect), rate = group.Count() == 0 ? 0 : Math.Round(group.Count(x => x.IsCorrect) * 100m / group.Count(), 1) }).OrderByDescending(x => x.total).ToArray();
    var byTopic = attempts.GroupBy(x => new { x.Subject, x.Topic }).Select(group => new { subject = group.Key.Subject, topic = group.Key.Topic, total = group.Count(), correct = group.Count(x => x.IsCorrect), rate = group.Count() == 0 ? 0 : Math.Round(group.Count(x => x.IsCorrect) * 100m / group.Count(), 1) }).OrderBy(x => x.rate).Take(20).ToArray();
    return Results.Ok(new { total, correct, wrong = total - correct, rate = total == 0 ? 0 : Math.Round(correct * 100m / total, 1), lastAttemptAtUtc = attempts.OrderByDescending(x => x.AttemptedAtUtc).Select(x => (DateTime?)x.AttemptedAtUtc).FirstOrDefault(), bySubject, byTopic });
});

tenantApi.MapGet("/question-summary", async (Guid tenantId, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin")) return Results.Forbid();
    var rows = await (from attempt in db.QuestionAttempts.AsNoTracking()
                      join question in db.QuestionBankItems.AsNoTracking() on attempt.QuestionBankItemId equals question.Id
                      join student in db.Students.AsNoTracking() on attempt.StudentId equals student.Id
                      where attempt.TenantId == tenantId
                      select new { attempt.StudentId, StudentName = student.FirstName + " " + student.LastName, question.Subject, attempt.IsCorrect }).ToListAsync(ct);
    var total = rows.Count; var correct = rows.Count(x => x.IsCorrect);
    var students = rows.GroupBy(x => new { x.StudentId, x.StudentName }).Select(group => new { studentId = group.Key.StudentId, studentName = group.Key.StudentName, total = group.Count(), correct = group.Count(x => x.IsCorrect), rate = Math.Round(group.Count(x => x.IsCorrect) * 100m / group.Count(), 1) }).OrderByDescending(x => x.total).ToArray();
    var subjects = rows.GroupBy(x => x.Subject).Select(group => new { subject = group.Key, total = group.Count(), correct = group.Count(x => x.IsCorrect), rate = Math.Round(group.Count(x => x.IsCorrect) * 100m / group.Count(), 1) }).OrderByDescending(x => x.total).ToArray();
    return Results.Ok(new { total, correct, wrong = total - correct, rate = total == 0 ? 0 : Math.Round(correct * 100m / total, 1), students, subjects });
});

tenantApi.MapGet("/question-summary/export", async (Guid tenantId, ClaimsPrincipal principal, KoclukDbContext db, CancellationToken ct) =>
{
    if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin")) return Results.Forbid();
    var rows = await (from attempt in db.QuestionAttempts.AsNoTracking()
                      join question in db.QuestionBankItems.AsNoTracking() on attempt.QuestionBankItemId equals question.Id
                      join student in db.Students.AsNoTracking() on attempt.StudentId equals student.Id
                      where attempt.TenantId == tenantId
                      select new { student.FirstName, student.LastName, question.Subject, question.Topic, attempt.IsCorrect, attempt.AttemptedAtUtc }).OrderByDescending(x => x.AttemptedAtUtc).ToListAsync(ct);
    var csv = "Öğrenci;Ders;Konu;Sonuç;Tarih\r\n" + string.Join("\r\n", rows.Select(x => $"{(x.FirstName + " " + x.LastName).Replace(';', ',')};{x.Subject.Replace(';', ',')};{x.Topic.Replace(';', ',')};{(x.IsCorrect ? "Doğru" : "Yanlış")};{x.AttemptedAtUtc:yyyy-MM-dd HH:mm}"));
    return Results.File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "soru-performansi.csv");
});

tenantApi.MapPost("/invitations", async (Guid tenantId, CreateInvitationRequest request, KoclukDbContext db, ClaimsPrincipal principal, UserManager<ApplicationUser> users, IEmailSender emailSender, CancellationToken ct) =>
{
    var actor = await users.GetUserAsync(principal);
    if (actor is null || (!await users.IsInRoleAsync(actor, "Coach") && !await users.IsInRoleAsync(actor, "Admin"))) return Results.Forbid();
    if (request.Role is not ("Student" or "Parent" or "Coach")) return Results.BadRequest(new { error = "Sadece Student, Parent veya Coach davet edilebilir." });
    try
    {
        if (request.Role == "Coach")
        {
            var subscription = await db.TenantSubscriptions.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
            if (subscription is not null && !subscription.IsActive) return Results.Conflict(new { error = "Abonelik süresi dolmuş. Yeni koç daveti için paketinizi yenileyin." });
            var coachCount = await db.TenantMemberships.CountAsync(x => x.TenantId == tenantId && x.Role == "Coach", ct);
            var pendingCoachInvites = await db.TenantInvitations.CountAsync(x => x.TenantId == tenantId && x.Role == "Coach" && x.AcceptedAtUtc == null && x.RevokedAtUtc == null && x.ExpiresAtUtc > DateTime.UtcNow, ct);
            if (subscription is not null && coachCount + pendingCoachInvites >= subscription.MaxCoaches) return Results.Conflict(new { error = "Mevcut paket koç limitine ulaştı." });
        }
        var invitation = new TenantInvitation(tenantId, request.Email, request.Role, DateTime.UtcNow.AddDays(7));
        db.TenantInvitations.Add(invitation);
        var recipient = await users.FindByEmailAsync(invitation.Email);
        if (recipient is not null) db.UserNotifications.Add(new UserNotification(recipient.Id, "Yeni kurum daveti", $"{invitation.Role} rolüyle bir koçluk alanına davet edildiniz.", "Invitation"));
        await db.SaveChangesAsync(ct);
        try { var publicUrl = builder.Configuration["APP_PUBLIC_URL"] ?? "https://localhost:7098"; await emailSender.SendAsync(invitation.Email, "Koçluk alanı davetiniz", $"Koçluk alanına davet edildiniz. Daveti açın: {publicUrl.TrimEnd('/')}/#invite/{invitation.Token}\n\nDavet kodu: {invitation.Token}", ct); } catch { /* E-posta servisi geçici olarak kapalıysa token akışı devam eder. */ }
        await WriteAuditAsync(db, principal, tenantId, "Created", "TenantInvitation", invitation.Id, invitation.Email, ct);
        return Results.Created($"/api/invitations/{invitation.Token}", new { invitation.Id, invitation.Email, invitation.Role, invitation.ExpiresAtUtc, invitation.Token });
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
tenantApi.MapGet("/invitations", async (Guid tenantId, KoclukDbContext db, CancellationToken ct) =>
{
    var invitations = await db.TenantInvitations.AsNoTracking().Where(x => x.TenantId == tenantId).OrderByDescending(x => x.CreatedAtUtc).Take(100).ToListAsync(ct);
    return Results.Ok(invitations.Select(x => new { x.Id, x.Email, x.Role, x.ExpiresAtUtc, x.CreatedAtUtc, x.AcceptedAtUtc, x.RevokedAtUtc, active = x.IsActive }));
});
tenantApi.MapGet("/members", async (Guid tenantId, KoclukDbContext db, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    var memberIds = await db.TenantMemberships.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
    var result = new List<object>();
    foreach (var membership in memberIds)
    {
        var user = await users.FindByIdAsync(membership.UserId.ToString());
        if (user is not null) result.Add(new { user.Id, user.Email, user.FirstName, user.LastName, membership.Role });
    }
    return Results.Ok(result);
});
tenantApi.MapPost("/invitations/{invitationId:guid}/revoke", async (Guid tenantId, Guid invitationId, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var invitation = await db.TenantInvitations.SingleOrDefaultAsync(x => x.Id == invitationId && x.TenantId == tenantId, ct);
    if (invitation is null) return Results.NotFound(); invitation.Revoke(); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Revoked", "TenantInvitation", invitationId, invitation.Email, ct); return Results.NoContent();
});

tenantApi.MapGet("/sessions", async (Guid tenantId, KoclukDbContext db, CancellationToken ct) =>
{
    var sessions = await (from session in db.CoachingSessions.AsNoTracking()
                          join student in db.Students.AsNoTracking() on session.StudentId equals student.Id
                          where session.TenantId == tenantId
                          orderby session.StartsAtUtc
                          select new
                          {
                              session.Id, session.StudentId, session.StartsAtUtc, session.DurationMinutes,
                              session.Note, session.Status, StudentName = student.FirstName + " " + student.LastName
                          }).ToListAsync(ct);
    return Results.Ok(sessions);
});
tenantApi.MapGet("/availability", async (Guid tenantId, KoclukDbContext db, CancellationToken ct) =>
{
    var slots = await db.CoachAvailabilities.AsNoTracking().Where(x => x.TenantId == tenantId).OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).ToListAsync(ct);
    return Results.Ok(slots);
});
tenantApi.MapPost("/availability", async (Guid tenantId, CreateAvailabilityRequest request, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    if (!TryGetUserId(principal, out var userId)) return Results.Unauthorized();
    try
    {
        var overlap = await db.CoachAvailabilities.AnyAsync(x => x.TenantId == tenantId && x.CoachUserId == userId && x.DayOfWeek == request.DayOfWeek && request.StartTime < x.EndTime && request.EndTime > x.StartTime, ct);
        if (overlap) return Results.Conflict(new { error = "Bu gün ve saat aralığında mevcut bir müsaitlik bulunuyor." });
        var slot = new CoachAvailability(tenantId, userId, request.DayOfWeek, request.StartTime, request.EndTime); db.CoachAvailabilities.Add(slot); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Created", "CoachAvailability", slot.Id, null, ct); return Results.Created($"/api/tenants/{tenantId}/availability/{slot.Id}", slot);
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
tenantApi.MapDelete("/availability/{availabilityId:guid}", async (Guid tenantId, Guid availabilityId, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    if (!TryGetUserId(principal, out var userId)) return Results.Unauthorized();
    var slot = await db.CoachAvailabilities.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == availabilityId && (x.CoachUserId == userId || principal.IsInRole("Admin")), ct);
    if (slot is null) return Results.NotFound(); db.CoachAvailabilities.Remove(slot); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Deleted", "CoachAvailability", availabilityId, null, ct); return Results.NoContent();
});

tenantApi.MapGet("/students/{studentId:guid}/exams", async (Guid tenantId, Guid studentId, KoclukDbContext db, CancellationToken ct) =>
{
    var exams = await db.ExamAttempts.AsNoTracking().Where(x => x.TenantId == tenantId && x.StudentId == studentId)
        .OrderByDescending(x => x.ExamDate).ToListAsync(ct);
    return Results.Ok(exams.Select(ToExamResponse));
});

tenantApi.MapGet("/students/{studentId:guid}/subjects", async (Guid tenantId, Guid studentId, KoclukDbContext db, CancellationToken ct) =>
{
    var items = await db.SubjectProgresses.AsNoTracking().Where(x => x.TenantId == tenantId && x.StudentId == studentId).OrderBy(x => x.Subject).ThenBy(x => x.Topic).ToListAsync(ct);
    return Results.Ok(items);
});
tenantApi.MapGet("/students/{studentId:guid}/subjects/export", async (Guid tenantId, Guid studentId, KoclukDbContext db, CancellationToken ct) =>
{
    var items = await db.SubjectProgresses.AsNoTracking().Where(x => x.TenantId == tenantId && x.StudentId == studentId).OrderBy(x => x.Subject).ThenBy(x => x.Topic).ToListAsync(ct);
    var csv = "Ders;Konu;İlerleme\r\n" + string.Join("\r\n", items.Select(x => $"{x.Subject.Replace(';', ',')};{x.Topic.Replace(';', ',')};{x.CompletionPercent}"));
    return Results.File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "ders-konu-ilerlemeleri.csv");
});
tenantApi.MapPost("/students/{studentId:guid}/subjects", async (Guid tenantId, Guid studentId, SubjectProgressRequest request, KoclukDbContext db, ClaimsPrincipal principal, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    if (!await db.Students.AnyAsync(x => x.TenantId == tenantId && x.Id == studentId, ct)) return Results.NotFound();
    try
    {
        var item = await db.SubjectProgresses.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Subject == request.Subject && x.Topic == request.Topic, ct);
        if (item is null) db.SubjectProgresses.Add(new SubjectProgress(tenantId, studentId, request.Subject, request.Topic, request.CompletionPercent)); else item.UpdatePercent(request.CompletionPercent);
        var student = await db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Id == studentId && x.TenantId == tenantId, ct);
        if (student?.Email is not null) { var studentUser = await users.FindByEmailAsync(student.Email); if (studentUser is not null) db.UserNotifications.Add(new UserNotification(studentUser.Id, "Konu ilerlemesi güncellendi", $"{request.Subject} · {request.Topic} konusu % {request.CompletionPercent} seviyesine güncellendi.", "SubjectProgress")); }
        var guardian = await db.StudentGuardians.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId, ct);
        if (guardian?.ParentUserId is Guid parentUserId) db.UserNotifications.Add(new UserNotification(parentUserId, "Konu ilerlemesi güncellendi", "Bağlı olduğunuz öğrencinin konu ilerlemesi güncellendi.", "SubjectProgress"));
        await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Updated", "SubjectProgress", studentId, $"{request.Subject}/{request.Topic}", ct); return Results.Ok(new { request.Subject, request.Topic, request.CompletionPercent });
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
tenantApi.MapPut("/students/{studentId:guid}/subjects/{subjectId:guid}", async (Guid tenantId, Guid studentId, Guid subjectId, SubjectProgressRequest request, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var item = await db.SubjectProgresses.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Id == subjectId, ct);
    if (item is null) return Results.NotFound();
    try { item.Update(request.Subject, request.Topic, request.CompletionPercent); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Updated", "SubjectProgress", item.Id, $"Student:{studentId}", ct); return Results.Ok(item); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
tenantApi.MapDelete("/students/{studentId:guid}/subjects/{subjectId:guid}", async (Guid tenantId, Guid studentId, Guid subjectId, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var item = await db.SubjectProgresses.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Id == subjectId, ct);
    if (item is null) return Results.NotFound();
    db.SubjectProgresses.Remove(item); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Deleted", "SubjectProgress", item.Id, $"Student:{studentId}", ct); return Results.NoContent();
});

tenantApi.MapGet("/students/{studentId:guid}/exams/export", async (Guid tenantId, Guid studentId, KoclukDbContext db, CancellationToken ct) =>
{
    var exams = await db.ExamAttempts.AsNoTracking().Where(x => x.TenantId == tenantId && x.StudentId == studentId).OrderByDescending(x => x.ExamDate).ToListAsync(ct);
    var csv = "Deneme;Tarih;Doğru;Yanlış;Boş;Puan\r\n" + string.Join("\r\n", exams.Select(x => $"{x.Title.Replace(';', ',')};{x.ExamDate:yyyy-MM-dd};{x.Correct};{x.Wrong};{x.Blank};{x.Score:0.##}"));
    return Results.File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "deneme-sonuclari.csv");
});

tenantApi.MapPost("/students/{studentId:guid}/exams", async (Guid tenantId, Guid studentId, CreateExamRequest request,
    KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    if (!await db.Students.AnyAsync(x => x.TenantId == tenantId && x.Id == studentId, ct)) return Results.NotFound();
    try
    {
        var exam = new ExamAttempt(tenantId, studentId, request.Title, request.ExamDate, request.Correct, request.Wrong, request.Blank, request.Score);
        db.ExamAttempts.Add(exam);
        var guardian = await db.StudentGuardians.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId, ct);
        if (guardian?.ParentUserId is Guid parentUserId) db.UserNotifications.Add(new UserNotification(parentUserId, "Yeni deneme sonucu", $"Bağlı olduğunuz öğrencinin {exam.Title} sonucu kaydedildi.", "ExamResult"));
        await db.SaveChangesAsync(ct);
        await WriteAuditAsync(db, principal, tenantId, "Created", "ExamAttempt", exam.Id, $"Student:{studentId}", ct);
        return Results.Created($"/api/tenants/{tenantId}/students/{studentId}/exams/{exam.Id}", ToExamResponse(exam));
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapPut("/students/{studentId:guid}/exams/{examId:guid}", async (Guid tenantId, Guid studentId, Guid examId, CreateExamRequest request,
    KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var exam = await db.ExamAttempts.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Id == examId, ct);
    if (exam is null) return Results.NotFound();
    try { exam.Update(request.Title, request.ExamDate, request.Correct, request.Wrong, request.Blank, request.Score); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Updated", "ExamAttempt", exam.Id, $"Student:{studentId}", ct); return Results.Ok(ToExamResponse(exam)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapDelete("/students/{studentId:guid}/exams/{examId:guid}", async (Guid tenantId, Guid studentId, Guid examId,
    KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var exam = await db.ExamAttempts.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Id == examId, ct);
    if (exam is null) return Results.NotFound();
    db.ExamAttempts.Remove(exam); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Deleted", "ExamAttempt", examId, $"Student:{studentId}", ct); return Results.NoContent();
});

tenantApi.MapGet("/students/{studentId:guid}/sessions", async (Guid tenantId, Guid studentId, KoclukDbContext db, CancellationToken ct) =>
{
    var sessions = await db.CoachingSessions.AsNoTracking().Where(x => x.TenantId == tenantId && x.StudentId == studentId)
        .OrderBy(x => x.StartsAtUtc).ToListAsync(ct);
    return Results.Ok(sessions.Select(ToSessionResponse));
});

tenantApi.MapPost("/students/{studentId:guid}/sessions", async (Guid tenantId, Guid studentId, CreateSessionRequest request, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    try
    {
        if (!await db.Students.AnyAsync(x => x.TenantId == tenantId && x.Id == studentId, ct)) return Results.NotFound();
        var starts = request.StartsAtUtc.ToUniversalTime();
        var ends = starts.AddMinutes(request.DurationMinutes);
        var conflict = await db.CoachingSessions.AnyAsync(x => x.TenantId == tenantId && x.Status == "Scheduled" && starts < x.StartsAtUtc.AddMinutes(x.DurationMinutes) && ends > x.StartsAtUtc, ct);
        if (conflict) return Results.Conflict(new { error = "Bu saat aralığında başka bir koçluk görüşmesi bulunuyor." });
        var session = new CoachingSession(tenantId, studentId, starts, request.DurationMinutes, request.Note);
        db.CoachingSessions.Add(session);
        await db.SaveChangesAsync(ct);
        await WriteAuditAsync(db, principal, tenantId, "Created", "CoachingSession", session.Id, $"Student:{studentId}", ct);
        return Results.Created($"/api/tenants/{tenantId}/students/{studentId}/sessions/{session.Id}", ToSessionResponse(session));
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapPut("/students/{studentId:guid}/sessions/{sessionId:guid}", async (Guid tenantId, Guid studentId, Guid sessionId, CreateSessionRequest request, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var session = await db.CoachingSessions.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Id == sessionId, ct);
    if (session is null) return Results.NotFound();
    try {
        var starts = request.StartsAtUtc.ToUniversalTime();
        var ends = starts.AddMinutes(request.DurationMinutes);
        var conflict = await db.CoachingSessions.AnyAsync(x => x.Id != sessionId && x.TenantId == tenantId && x.Status == "Scheduled" && starts < x.StartsAtUtc.AddMinutes(x.DurationMinutes) && ends > x.StartsAtUtc, ct);
        if (conflict) return Results.Conflict(new { error = "Bu saat aralığında başka bir koçluk görüşmesi bulunuyor." });
        session.Reschedule(starts, request.DurationMinutes, request.Note); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Updated", "CoachingSession", session.Id, $"Student:{studentId}", ct); return Results.Ok(ToSessionResponse(session)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapDelete("/students/{studentId:guid}/sessions/{sessionId:guid}", async (Guid tenantId, Guid studentId, Guid sessionId, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var session = await db.CoachingSessions.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Id == sessionId, ct);
    if (session is null) return Results.NotFound();
    db.CoachingSessions.Remove(session); await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Deleted", "CoachingSession", sessionId, $"Student:{studentId}", ct); return Results.NoContent();
});

tenantApi.MapPost("/students/{studentId:guid}/sessions/{sessionId:guid}/confirm", async (Guid tenantId, Guid studentId, Guid sessionId, KoclukDbContext db, ClaimsPrincipal principal, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    var session = await db.CoachingSessions.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Id == sessionId, ct);
    if (session is null) return Results.NotFound(); session.Confirm();
    var student = await db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Id == studentId && x.TenantId == tenantId, ct);
    if (student?.Email is not null) { var studentUser = await users.FindByEmailAsync(student.Email); if (studentUser is not null) db.UserNotifications.Add(new UserNotification(studentUser.Id, "Görüşme onaylandı", "Koçluk görüşme talebiniz onaylandı.", "SessionConfirmed")); }
    var guardian = await db.StudentGuardians.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId, ct);
    if (guardian?.ParentUserId is Guid parentUserId) db.UserNotifications.Add(new UserNotification(parentUserId, "Görüşme onaylandı", "Bağlı olduğunuz öğrencinin koçluk görüşmesi onaylandı.", "SessionConfirmed"));
    await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Confirmed", "CoachingSession", sessionId, $"Student:{studentId}", ct); return Results.Ok(ToSessionResponse(session));
});

tenantApi.MapPost("/students/{studentId:guid}/sessions/{sessionId:guid}/cancel", async (Guid tenantId, Guid studentId, Guid sessionId, KoclukDbContext db, ClaimsPrincipal principal, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    var session = await db.CoachingSessions.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.Id == sessionId, ct);
    if (session is null) return Results.NotFound(); session.Cancel();
    var student = await db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Id == studentId && x.TenantId == tenantId, ct);
    if (student?.Email is not null) { var studentUser = await users.FindByEmailAsync(student.Email); if (studentUser is not null) db.UserNotifications.Add(new UserNotification(studentUser.Id, "Görüşme iptal edildi", "Koçluk görüşme takviminizdeki görüşme iptal edildi.", "SessionCancelled")); }
    var guardian = await db.StudentGuardians.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId, ct);
    if (guardian?.ParentUserId is Guid parentUserId) db.UserNotifications.Add(new UserNotification(parentUserId, "Görüşme iptal edildi", "Bağlı olduğunuz öğrencinin koçluk görüşmesi iptal edildi.", "SessionCancelled"));
    await db.SaveChangesAsync(ct); await WriteAuditAsync(db, principal, tenantId, "Cancelled", "CoachingSession", sessionId, $"Student:{studentId}", ct); return Results.Ok(ToSessionResponse(session));
});

tenantApi.MapPost("/students", async (
    Guid tenantId, CreateStudentRequest request, IStudentRepository students, KoclukDbContext db,
    UserManager<ApplicationUser> users, ClaimsPrincipal principal, CancellationToken ct) =>
{
    try
    {
        var subscription = await db.TenantSubscriptions.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (subscription is not null && !subscription.IsActive) return Results.Conflict(new { error = "Abonelik süresi dolmuş. Öğrenci eklemek için paketinizi yenileyin." });
        var studentCount = await db.Students.CountAsync(x => x.TenantId == tenantId, ct);
        if (subscription is not null && studentCount >= subscription.MaxStudents) return Results.Conflict(new { error = "Mevcut paket öğrenci limitine ulaştı." });
        var student = new Student(tenantId, request.FirstName, request.LastName, request.Email, request.PhoneNumber);
        await students.AddAsync(student, ct);
        StudentGuardian? guardian = null;
        if (!string.IsNullOrWhiteSpace(request.ParentFirstName) || !string.IsNullOrWhiteSpace(request.ParentLastName) || !string.IsNullOrWhiteSpace(request.ParentPhone))
        {
            guardian = new StudentGuardian(tenantId, student.Id, request.ParentFirstName ?? "", request.ParentLastName ?? "", request.ParentEmail, request.ParentPhone ?? "");
            if (!string.IsNullOrWhiteSpace(request.ParentEmail))
            {
                var parent = await users.FindByEmailAsync(request.ParentEmail);
                if (parent is not null && await users.IsInRoleAsync(parent, "Parent")) guardian.LinkUser(parent.Id);
            }
            db.StudentGuardians.Add(guardian);
            await db.SaveChangesAsync(ct);
        }
        await WriteAuditAsync(db, principal, tenantId, "Created", "Student", student.Id, $"{student.FirstName} {student.LastName}", ct);
        return Results.Created($"/api/tenants/{tenantId}/students/{student.Id}", ToStudentResponse(student, guardian));
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapGet("/students", async (Guid tenantId, IStudentRepository students, KoclukDbContext db, CancellationToken ct) =>
{
    var result = await students.ListAsync(tenantId, ct);
    var guardians = await db.StudentGuardians.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
    return Results.Ok(result.Select(student => ToStudentResponse(student, guardians.FirstOrDefault(x => x.StudentId == student.Id))));
});

tenantApi.MapGet("/students/{studentId:guid}", async (
    Guid tenantId, Guid studentId, IStudentRepository students, KoclukDbContext db, CancellationToken ct) =>
{
    var student = await students.GetAsync(tenantId, studentId, ct);
    var guardian = student is null ? null : await db.StudentGuardians.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId, ct);
    return student is null ? Results.NotFound() : Results.Ok(ToStudentResponse(student, guardian));
});

tenantApi.MapPut("/students/{studentId:guid}", async (
    Guid tenantId, Guid studentId, UpdateStudentRequest request,
    IStudentRepository students, KoclukDbContext db, UserManager<ApplicationUser> users, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var student = await students.GetAsync(tenantId, studentId, ct);
    if (student is null) return Results.NotFound();
    try
    {
        student.UpdateProfile(request.FirstName, request.LastName, request.Email, request.PhoneNumber);
        await students.UpdateAsync(student, ct);
        var guardian = await db.StudentGuardians.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId, ct);
        if (!string.IsNullOrWhiteSpace(request.ParentFirstName) || guardian is not null)
        {
            if (guardian is null)
            {
                guardian = new StudentGuardian(tenantId, studentId, request.ParentFirstName ?? "", request.ParentLastName ?? "", request.ParentEmail, request.ParentPhone ?? "");
                db.StudentGuardians.Add(guardian);
            }
            else guardian.UpdateProfile(request.ParentFirstName ?? "", request.ParentLastName ?? "", request.ParentEmail, request.ParentPhone ?? "");
            if (!string.IsNullOrWhiteSpace(request.ParentEmail))
            {
                var parent = await users.FindByEmailAsync(request.ParentEmail);
                if (parent is not null && await users.IsInRoleAsync(parent, "Parent")) guardian.LinkUser(parent.Id);
            }
            await db.SaveChangesAsync(ct);
        }
        await WriteAuditAsync(db, principal, tenantId, "Updated", "Student", student.Id, $"{student.FirstName} {student.LastName}", ct);
        return Results.Ok(ToStudentResponse(student, guardian));
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapDelete("/students/{studentId:guid}", async (
    Guid tenantId, Guid studentId, IStudentRepository students, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    if (!await students.DeleteAsync(tenantId, studentId, ct)) return Results.NotFound();
    await WriteAuditAsync(db, principal, tenantId, "Deleted", "Student", studentId, null, ct);
    return Results.NoContent();
});

tenantApi.MapPost("/students/{studentId:guid}/plans", async (
    Guid tenantId, Guid studentId, CreateStudyPlanRequest request,
    IStudentRepository students, IStudyPlanRepository plans, KoclukDbContext db, ClaimsPrincipal principal, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    if (await students.GetAsync(tenantId, studentId, ct) is null)
        return Results.NotFound(new { error = "Bu kurumda öğrenci bulunamadı." });
    try
    {
        var plan = new StudyPlan(tenantId, studentId, request.Title, request.WeekStart);
        foreach (var task in request.Tasks) plan.AddTask(task.Title, task.DueDate, task.TargetQuestions);
        await plans.AddAsync(plan, ct);
        var student = await db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Id == studentId && x.TenantId == tenantId, ct);
        if (student?.Email is not null) { var studentUser = await users.FindByEmailAsync(student.Email); if (studentUser is not null) db.UserNotifications.Add(new UserNotification(studentUser.Id, "Yeni çalışma planı", $"{plan.Title} adlı çalışma planınız oluşturuldu.", "StudyPlan")); }
        var guardian = await db.StudentGuardians.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId, ct);
        if (guardian?.ParentUserId is Guid parentUserId) db.UserNotifications.Add(new UserNotification(parentUserId, "Yeni çalışma planı", $"Bağlı olduğunuz öğrenci için {plan.Title} adlı plan oluşturuldu.", "StudyPlan"));
        await db.SaveChangesAsync(ct);
        await WriteAuditAsync(db, principal, tenantId, "Created", "StudyPlan", plan.Id, $"Student:{studentId}", ct);
        return Results.Created($"/api/tenants/{tenantId}/students/{studentId}/plans/{plan.Id}", ToPlanResponse(plan));
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

tenantApi.MapGet("/students/{studentId:guid}/plans", async (
    Guid tenantId, Guid studentId, IStudentRepository students,
    IStudyPlanRepository plans, CancellationToken ct) =>
{
    if (await students.GetAsync(tenantId, studentId, ct) is null)
        return Results.NotFound(new { error = "Bu kurumda öğrenci bulunamadı." });
    var result = await plans.ListByStudentAsync(tenantId, studentId, ct);
    return Results.Ok(result.Select(ToPlanResponse));
});

tenantApi.MapGet("/students/{studentId:guid}/plans/export", async (Guid tenantId, Guid studentId, IStudyPlanRepository plans, CancellationToken ct) =>
{
    var items = await plans.ListByStudentAsync(tenantId, studentId, ct);
    var rows = items.SelectMany(plan => plan.Tasks.Select(task => $"{plan.Title.Replace(';', ',')};{plan.WeekStart:yyyy-MM-dd};{task.Title.Replace(';', ',')};{task.DueDate:yyyy-MM-dd};{task.TargetQuestions};{task.CompletedQuestions};{(task.IsCompleted ? "Tamamlandı" : "Bekliyor")}"));
    var csv = "Plan;Hafta;Görev;Son tarih;Hedef soru;Tamamlanan soru;Durum\r\n" + string.Join("\r\n", rows);
    return Results.File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "calisma-planlari.csv");
});

tenantApi.MapPut("/plans/{planId:guid}/tasks/{taskId:guid}/progress", async (
    Guid tenantId, Guid planId, Guid taskId, UpdateTaskProgressRequest request,
    IStudyPlanRepository plans, KoclukDbContext db, ClaimsPrincipal principal, UserManager<ApplicationUser> users, CancellationToken ct) =>
{
    try
    {
        if (!principal.IsInRole("Coach") && !principal.IsInRole("Admin"))
        {
            var userEmail = principal.FindFirstValue(ClaimTypes.Email) ?? principal.FindFirstValue("email");
            var existingPlan = await plans.GetAsync(tenantId, planId, ct);
            if (existingPlan is null) return Results.NotFound(new { error = "Plan veya görev bulunamadı." });
            var planOwner = await db.Students.AsNoTracking().Where(x => x.TenantId == tenantId && x.Id == existingPlan.StudentId).Select(x => x.Email).SingleOrDefaultAsync(ct);
            if (string.IsNullOrWhiteSpace(userEmail) || !string.Equals(userEmail, planOwner, StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
        }
        var plan = await plans.UpdateTaskProgressAsync(tenantId, planId, taskId,
            request.CompletedQuestions, request.IsCompleted, ct);
        if (plan is not null)
        {
            if (request.IsCompleted)
            {
                var guardian = await db.StudentGuardians.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == plan.StudentId, ct);
                if (guardian?.ParentUserId is Guid parentUserId) db.UserNotifications.Add(new UserNotification(parentUserId, "Görev tamamlandı", "Bağlı olduğunuz öğrenci bir çalışma görevini tamamladı.", "TaskCompleted"));
            }
            await WriteAuditAsync(db, principal, tenantId, "Updated", "StudyTask", taskId, $"Plan:{planId}", ct);
        }
        return plan is null ? Results.NotFound(new { error = "Plan veya görev bulunamadı." }) : Results.Ok(ToPlanResponse(plan));
    }
    catch (ArgumentOutOfRangeException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
tenantApi.MapPut("/plans/{planId:guid}/tasks/{taskId:guid}", async (Guid tenantId, Guid planId, Guid taskId, UpdateStudyTaskRequest request, IStudyPlanRepository plans, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    try { var plan = await plans.UpdateTaskAsync(tenantId, planId, taskId, request.Title, request.DueDate, request.TargetQuestions, ct); if (plan is null) return Results.NotFound(new { error = "Plan veya görev bulunamadı." }); await WriteAuditAsync(db, principal, tenantId, "Updated", "StudyTask", taskId, $"Plan:{planId}", ct); return Results.Ok(ToPlanResponse(plan)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
tenantApi.MapDelete("/plans/{planId:guid}/tasks/{taskId:guid}", async (Guid tenantId, Guid planId, Guid taskId, IStudyPlanRepository plans, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    var plan = await plans.DeleteTaskAsync(tenantId, planId, taskId, ct); if (plan is null) return Results.NotFound(new { error = "Plan veya görev bulunamadı." }); await WriteAuditAsync(db, principal, tenantId, "Deleted", "StudyTask", taskId, $"Plan:{planId}", ct); return Results.Ok(ToPlanResponse(plan));
});
tenantApi.MapPut("/plans/{planId:guid}", async (Guid tenantId, Guid planId, RenameStudyPlanRequest request, IStudyPlanRepository plans, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    try { var plan = await plans.RenameAsync(tenantId, planId, request.Title, ct); if (plan is null) return Results.NotFound(new { error = "Çalışma planı bulunamadı." }); await WriteAuditAsync(db, principal, tenantId, "Updated", "StudyPlan", planId, null, ct); return Results.Ok(ToPlanResponse(plan)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
tenantApi.MapDelete("/plans/{planId:guid}", async (Guid tenantId, Guid planId, IStudyPlanRepository plans, KoclukDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
{
    if (!await plans.DeleteAsync(tenantId, planId, ct)) return Results.NotFound(new { error = "Çalışma planı bulunamadı." });
    await WriteAuditAsync(db, principal, tenantId, "Deleted", "StudyPlan", planId, null, ct); return Results.NoContent();
});

// Stripe/iyzico adaptörü bağlandığında bu ortak webhook sözleşmesi kullanılabilir.
// Olay kimliği + sağlayıcı birleşimi benzersizdir; aynı webhook ikinci kez işlenmez.
app.MapPost("/api/billing/webhook", async (HttpRequest request, IConfiguration configuration, KoclukDbContext db, CancellationToken ct) =>
{
    var secret = configuration["BILLING_WEBHOOK_SECRET"];
    if (string.IsNullOrWhiteSpace(secret)) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    using var reader = new StreamReader(request.Body);
    var raw = await reader.ReadToEndAsync(ct);
    var signature = request.Headers["X-Billing-Signature"].FirstOrDefault();
    if (string.IsNullOrWhiteSpace(signature)) return Results.Unauthorized();
    using var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(secret));
    var expected = Convert.ToHexString(hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
    if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
        System.Text.Encoding.UTF8.GetBytes(expected), System.Text.Encoding.UTF8.GetBytes(signature.Trim().ToLowerInvariant())))
        return Results.Unauthorized();
    BillingWebhookPayload? payload;
    try { payload = System.Text.Json.JsonSerializer.Deserialize<BillingWebhookPayload>(raw, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
    catch (System.Text.Json.JsonException) { return Results.BadRequest(new { error = "Geçersiz webhook gövdesi." }); }
    if (payload is null || !Guid.TryParse(payload.TenantId, out var tenantId) || string.IsNullOrWhiteSpace(payload.EventId) || string.IsNullOrWhiteSpace(payload.EventType))
        return Results.BadRequest(new { error = "eventId, eventType ve tenantId zorunludur." });
    var provider = configuration["BILLING_PROVIDER"] ?? "unknown";
    if (await db.BillingWebhookEvents.AnyAsync(x => x.Provider == provider && x.EventId == payload.EventId, ct))
        return Results.Ok(new { processed = true, duplicate = true });
    var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
    var subscription = await db.TenantSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
    if (subscription is null) return Results.NotFound(new { error = "Koçluk alanı aboneliği bulunamadı." });
    switch (payload.EventType.Trim().ToLowerInvariant())
    {
        case "payment_succeeded":
        case "subscription_renewed":
            subscription.Activate(payload.PlanCode, payload.PeriodEndUtc);
            break;
        case "payment_failed":
            subscription.MarkPaymentFailed();
            break;
        case "subscription_cancelled":
            subscription.Cancel();
            break;
        default:
            return Results.BadRequest(new { error = "Desteklenmeyen webhook olayı." });
    }
    db.BillingWebhookEvents.Add(new BillingWebhookEvent(provider, payload.EventId, payload.EventType, tenantId, hash));
    db.AuditLogs.Add(new AuditLog(tenantId, null, $"BillingWebhook:{payload.EventType}", "TenantSubscription", subscription.Id, payload.EventId));
    await db.SaveChangesAsync(ct);
    return Results.Ok(new { processed = true, subscription.Status, subscription.CurrentPeriodEndUtc });
}).AllowAnonymous();

app.Run();

static async Task WriteAuditAsync(KoclukDbContext db, ClaimsPrincipal principal, Guid? tenantId,
    string action, string entityType, Guid? entityId, string? details, CancellationToken ct)
{
    Guid? userId = Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub"), out var parsed)
        ? parsed : null;
    db.AuditLogs.Add(new AuditLog(tenantId, userId, action, entityType, entityId, details));
    await db.SaveChangesAsync(ct);
}
static bool TryGetUserId(ClaimsPrincipal principal, out Guid userId) => Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub"), out userId);

static StudentResponse ToStudentResponse(Student student, StudentGuardian? guardian = null) => new(
    student.Id, student.TenantId, student.FirstName, student.LastName, student.Email, student.PhoneNumber, student.CreatedAtUtc,
    guardian is null ? null : new GuardianResponse(guardian.FirstName, guardian.LastName, guardian.Email, guardian.PhoneNumber, guardian.ParentUserId));
static CoachingSessionResponse ToSessionResponse(CoachingSession session) => new(session.Id, session.StudentId, session.StartsAtUtc, session.DurationMinutes, session.Note, session.Status);
static ExamResponse ToExamResponse(ExamAttempt exam) => new(exam.Id, exam.StudentId, exam.Title, exam.ExamDate, exam.Correct, exam.Wrong, exam.Blank, exam.Score);
static StudyPlanResponse ToPlanResponse(StudyPlan plan) => new(
    plan.Id, plan.TenantId, plan.StudentId, plan.Title, plan.WeekStart,
    plan.Tasks.Select(task => new StudyTaskResponse(task.Id, task.Title, task.DueDate,
        task.TargetQuestions, task.CompletedQuestions, task.IsCompleted)).ToArray());
static QuestionBankResponse ToQuestionResponse(QuestionBankItem item, bool includeAnswers) => new(item.Id, item.TenantId, item.Subject, item.Topic, item.Prompt, includeAnswers ? item.Answer : null, includeAnswers ? item.Explanation : null, item.Difficulty, item.ExamType, item.IsPublished, item.CreatedAtUtc);

public sealed record CreateTenantRequest(string Name, string Slug);
public sealed record TenantResponse(Guid Id, string Name, string Slug);
public sealed record CreateStudentRequest(string FirstName, string LastName, string? Email, string? PhoneNumber = null, string? ParentFirstName = null, string? ParentLastName = null, string? ParentEmail = null, string? ParentPhone = null);
public sealed record UpdateStudentRequest(string FirstName, string LastName, string? Email, string? PhoneNumber = null, string? ParentFirstName = null, string? ParentLastName = null, string? ParentEmail = null, string? ParentPhone = null);
public sealed record StudentResponse(Guid Id, Guid TenantId, string FirstName, string LastName, string? Email, string? PhoneNumber, DateTime CreatedAtUtc, GuardianResponse? Guardian);
public sealed record GuardianResponse(string FirstName, string LastName, string? Email, string PhoneNumber, Guid? ParentUserId);
public sealed record CreateSessionRequest(DateTime StartsAtUtc, int DurationMinutes, string? Note);
public sealed record CoachingSessionResponse(Guid Id, Guid StudentId, DateTime StartsAtUtc, int DurationMinutes, string? Note, string Status);
public sealed record CreateExamRequest(string Title, DateOnly ExamDate, int Correct, int Wrong, int Blank, decimal Score);
public sealed record ExamResponse(Guid Id, Guid StudentId, string Title, DateOnly ExamDate, int Correct, int Wrong, int Blank, decimal Score);
public sealed record CreateStudyPlanRequest(string Title, DateOnly WeekStart, IReadOnlyList<CreateStudyTaskRequest> Tasks);
public sealed record CreateStudyTaskRequest(string Title, DateOnly DueDate, int TargetQuestions);
public sealed record UpdateTaskProgressRequest(int CompletedQuestions, bool IsCompleted);
public sealed record SetRoleRequest(string Role);
public sealed record CreateInvitationRequest(string Email, string Role);
public sealed record SubjectProgressRequest(string Subject, string Topic, int CompletionPercent);
public sealed record UpdateProfileRequest(string? FirstName, string? LastName);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record PrivacyConsentRequest(bool Accepted, string PolicyVersion);
public sealed record DataDeletionRequestPayload(string? Reason);
public sealed record LockUserRequest(bool Locked);
public sealed record ChangePlanRequest(string PlanCode);
public sealed record StudyPlanResponse(Guid Id, Guid TenantId, Guid StudentId, string Title, DateOnly WeekStart, IReadOnlyList<StudyTaskResponse> Tasks);
public sealed record UpdateStudyTaskRequest(string Title, DateOnly DueDate, int TargetQuestions);
public sealed record RenameStudyPlanRequest(string Title);
public sealed record BillingWebhookPayload(string EventId, string EventType, string TenantId, string? PlanCode, DateTime? PeriodEndUtc);
public sealed record SendMessageRequest(Guid RecipientUserId, string Content);
public sealed record QuestionBankRequest(string Subject, string Topic, string Prompt, string? Answer, string? Explanation, string Difficulty, string ExamType, bool IsPublished);
public sealed record QuestionBankResponse(Guid Id, Guid TenantId, string Subject, string Topic, string Prompt, string? Answer, string? Explanation, string Difficulty, string ExamType, bool IsPublished, DateTime CreatedAtUtc);
public sealed record QuestionAttemptRequest(string? Answer);
public sealed record CreateAvailabilityRequest(int DayOfWeek, TimeOnly StartTime, TimeOnly EndTime);
public sealed record StudyTaskResponse(Guid Id, string Title, DateOnly DueDate, int TargetQuestions, int CompletedQuestions, bool IsCompleted);
