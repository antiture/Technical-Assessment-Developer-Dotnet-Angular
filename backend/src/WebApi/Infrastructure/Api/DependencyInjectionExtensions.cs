using WebApi.Modules.Users.Contracts;
using WebApi.Modules.Users.Infrastructure;

namespace WebApi.Infrastructure.Api;

internal static class DependencyInjectionExtensions
{
    public static IServiceCollection AddModuleServices(this IServiceCollection services)
    {
        services.AddScoped<IUserPolicyReader, UserPolicyReader>();
        return services;
    }
}
