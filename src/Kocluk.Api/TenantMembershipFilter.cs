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
        if (!await memberships.IsMemberAsync(tenantId, userId, context.HttpContext.RequestAborted))
            return Results.Forbid();
        var path = context.HttpContext.Request.Path.Value ?? string.Empty;
        var isWrite = HttpMethods.IsPost(context.HttpContext.Request.Method)
            || HttpMethods.IsPut(context.HttpContext.Request.Method)
            || HttpMethods.IsDelete(context.HttpContext.Request.Method);
        var isStudentProgress = path.Contains("/progress", StringComparison.OrdinalIgnoreCase);
        if (isWrite && !isStudentProgress && !context.HttpContext.User.IsInRole("Coach") && !context.HttpContext.User.IsInRole("Admin"))
            return Results.Forbid();
        if (isWrite && isStudentProgress && !context.HttpContext.User.IsInRole("Student") && !context.HttpContext.User.IsInRole("Coach") && !context.HttpContext.User.IsInRole("Admin"))
            return Results.Forbid();
        return await next(context);
    }
}
