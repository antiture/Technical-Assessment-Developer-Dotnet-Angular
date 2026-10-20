var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres");
var mainDatabase = postgres.AddDatabase("database");

var cache = builder.AddRedis("cache");
var webapi = builder.AddProject<Projects.WebApi>("webapi")
    .WithReference(cache)
    .WithReference(mainDatabase)
    .WaitFor(postgres)
    .WaitFor(mainDatabase)
    .WaitFor(cache);
var angular = builder.AddNpmApp("angular", "../../../frontend/")
    .WithReference(webapi)
    .WaitFor(webapi)
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();


builder.Build().Run();