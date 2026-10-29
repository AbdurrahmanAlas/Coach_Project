using System.Security.Claims;
using Kocluk.Application.Tenants;

public sealed class TenantMembershipFilter(ITenantMembershipRepository memberships) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var userIdValue = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.HttpContext.User.FindFirstValue("sub");
        var tenantIdValue = context.HttpContext.Request.RouteValues["tenantId"]?.ToString();
        if (!Guid.TryParse(userIdValue, out var userId) || !Guid.TryParse(tenantIdValue, out var tenantId))
            return Results.Unauthorized();
        var membershipRole = await memberships.GetRoleAsync(tenantId, userId, context.HttpContext.RequestAborted);
        if (membershipRole is null)
            return Results.Forbid();
        var path = context.HttpContext.Request.Path.Value ?? string.Empty;
        var isWrite = HttpMethods.IsPost(context.HttpContext.Request.Method)
            || HttpMethods.IsPut(context.HttpContext.Request.Method)
            || HttpMethods.IsDelete(context.HttpContext.Request.Method);
        var isCoachOrAdmin = context.HttpContext.User.IsInRole("Coach") || context.HttpContext.User.IsInRole("Admin");
        if (isCoachOrAdmin) return await next(context);
        if (membershipRole is not ("Student" or "Parent")) return Results.Forbid();

        // Student/Parent hesapları tenant içindeki genel koç endpoint'lerine üye oldukları için erişemez.
        // Kendilerine ayrılmış endpoint'ler burada açıkça listelenir; kayıt sahipliği ilgili endpoint'te ayrıca doğrulanır.
        var isStudentProgress = isWrite && path.Contains("/plans/", StringComparison.OrdinalIgnoreCase) && path.EndsWith("/progress", StringComparison.OrdinalIgnoreCase);
        var isQuestionAttempt = HttpMethods.IsPost(context.HttpContext.Request.Method) && path.Contains("/question-bank/", StringComparison.OrdinalIgnoreCase) && path.EndsWith("/attempt", StringComparison.OrdinalIgnoreCase);
        var isQuestionRead = HttpMethods.IsGet(context.HttpContext.Request.Method) && path.EndsWith("/question-bank", StringComparison.OrdinalIgnoreCase);
        var isQuestionSummary = HttpMethods.IsGet(context.HttpContext.Request.Method) && (path.Contains("/question-summary", StringComparison.OrdinalIgnoreCase) || path.Contains("/question-attempts", StringComparison.OrdinalIgnoreCase));
        var isAssignmentRead = context.HttpContext.User.IsInRole("Student") && HttpMethods.IsGet(context.HttpContext.Request.Method) && path.Contains("/my/question-assignments", StringComparison.OrdinalIgnoreCase);
        var isAssignmentComplete = context.HttpContext.User.IsInRole("Student") && HttpMethods.IsPost(context.HttpContext.Request.Method) && path.Contains("/question-assignments/", StringComparison.OrdinalIgnoreCase) && path.EndsWith("/complete", StringComparison.OrdinalIgnoreCase);
        var isResourceRead = HttpMethods.IsGet(context.HttpContext.Request.Method) && path.Contains("/resources", StringComparison.OrdinalIgnoreCase);
        if (context.HttpContext.User.IsInRole("Student") && (isStudentProgress || isQuestionAttempt || isQuestionRead || isQuestionSummary || isAssignmentRead || isAssignmentComplete || isResourceRead))
            return await next(context);
        if (context.HttpContext.User.IsInRole("Parent") && (isQuestionRead || isQuestionSummary))
            return await next(context);
        return Results.Forbid();
    }
}
