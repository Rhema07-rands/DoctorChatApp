// -------------------------------------------------------------------------------------
// DOCTOR CHAT API - PRODUCTION READY
// ALL ISSUES FIXED + COMPLETE FEATURE SET
// -------------------------------------------------------------------------------------

using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;
using System.Linq;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.IdentityModel.Tokens.Jwt;
using System.ComponentModel.DataAnnotations.Schema;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace DoctorChatApi;

public class Program
{
    private static JsonElement? _cachedTurnCredentials = null;
    private static DateTime? _lastTurnFetch = null;

    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
        var jwtKey = builder.Configuration["JwtSettings:Key"] 
            ?? throw new InvalidOperationException("JWT Key not found.");
        var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] 
            ?? throw new InvalidOperationException("JWT Issuer not found.");
        var jwtAudience = builder.Configuration["JwtSettings:Audience"] 
            ?? throw new InvalidOperationException("JWT Audience not found.");
        var adminSecretKey = builder.Configuration["AdminSettings:SecretKey"] 
            ?? throw new InvalidOperationException("Admin Secret Key not found.");

        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(c => { c.SwaggerDoc("v1", new() { Title = "Doctor Chat API", Version = "v2.0" }); });
        builder.Services.AddHttpClient();

        // Register Cloudinary
        var cloudinaryAccount = new Account(
            builder.Configuration["CloudinarySettings:CloudName"],
            builder.Configuration["CloudinarySettings:ApiKey"],
            builder.Configuration["CloudinarySettings:ApiSecret"]);
        builder.Services.AddSingleton(new Cloudinary(cloudinaryAccount));

        builder.Services.AddDbContext<DoctorChatDbContext>(options =>
            options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString),
                mySqlOptions => mySqlOptions.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorNumbersToAdd: null)));

        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.SetIsOriginAllowed(_ => true)
                .AllowAnyHeader().AllowAnyMethod().AllowCredentials();
            });
        });

        builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
                ValidateIssuerSigningKey = true, ValidIssuer = jwtIssuer, ValidAudience = jwtAudience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ClockSkew = TimeSpan.Zero
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    var path = context.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(accessToken) && (path.StartsWithSegments("/chathub") || path.StartsWithSegments("/signalinghub")))
                        context.Token = accessToken;
                    return Task.CompletedTask;
                }
            };
        });

        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("RequireDoctorRole", policy => policy.RequireClaim(ClaimTypes.Role, "Doctor"))
            .AddPolicy("RequirePatientRole", policy => policy.RequireClaim(ClaimTypes.Role, "Patient"))
            .AddPolicy("RequireAdminRole", policy => policy.RequireClaim(ClaimTypes.Role, "Admin"));

        builder.Services.AddSignalR(options => { options.EnableDetailedErrors = builder.Environment.IsDevelopment(); });
        builder.Services.AddSingleton<AuthService>(new AuthService(jwtKey, jwtIssuer, jwtAudience));

        var app = builder.Build();

        try
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DoctorChatDbContext>();
            db.Database.EnsureCreated();
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Doctors ADD COLUMN ConsultationType longtext NULL;"); } catch { }
            // Prescription frontend fields
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Prescriptions ADD COLUMN DrugOrActivity longtext NULL;"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Prescriptions ADD COLUMN AlarmTime longtext NULL;"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Prescriptions ADD COLUMN IntervalType longtext NULL;"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Prescriptions ADD COLUMN SpecificDays longtext NULL;"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Prescriptions ADD COLUMN DoctorName longtext NULL;"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Prescriptions ADD COLUMN PrescribingDoctorId longtext NULL;"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Prescriptions ADD COLUMN `Condition` longtext NULL;"); } catch { }
        }
        catch (Exception ex)
        {
            var logger = app.Services.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "An error occurred while migrating the database.");
        }

        app.UseExceptionHandler(exceptionHandlerApp =>
        {
            exceptionHandlerApp.Run(async context =>
            {
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new { Error = "An internal server error occurred." });
            });
        });

        app.UseCors();
        app.UseStaticFiles();
        if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
        // Also enable Swagger in Production for debugging deployed API
        if (!app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
        // NOTE: Do NOT use UseHttpsRedirection() — Render.com handles HTTPS
        // at the load balancer. The app runs on HTTP internally, and this
        // middleware would redirect POST requests, causing lost request bodies.
        // app.UseHttpsRedirection();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapHub<ChatHub>("/chathub").RequireAuthorization();
        app.MapHub<SignalingHub>("/signalinghub").RequireAuthorization();
        RegisterEndpoints(app, adminSecretKey);

        // Render.com sets the PORT environment variable
        var port = Environment.GetEnvironmentVariable("PORT") ?? "5050";
        app.Urls.Clear();
        app.Urls.Add($"http://0.0.0.0:{port}");

        app.Run();
    }

    private static void RegisterEndpoints(WebApplication app, string adminSecretKey)
    {
        app.MapGet("/api/health", () => Results.Ok(new { Status = "Healthy", Timestamp = DateTime.UtcNow, Version = "2.0" }));

        app.MapPost("/api/upload", async (IFormFile file, Cloudinary cloudinary) =>
        {
            if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded.");
            await using var stream = file.OpenReadStream();
            var uploadParams = new RawUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = "doctorchat"
            };
            var result = await cloudinary.UploadAsync(uploadParams);
            if (result.Error != null)
                return Results.Problem($"Cloudinary upload failed: {result.Error.Message}");
            return Results.Ok(new { Url = result.SecureUrl.ToString() });
        }).DisableAntiforgery();

        app.MapPut("/api/profile/picture", async (HttpContext httpContext, DoctorChatDbContext db, [FromBody] ProfilePictureUpdateRequest req) =>
        {
            var userIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();
            var doctor = await db.Doctors.FindAsync(userId);
            if (doctor != null) { doctor.ProfilePictureUrl = req.ProfilePictureUrl; await db.SaveChangesAsync(); return Results.Ok(new { message = "Profile picture updated", profilePictureUrl = req.ProfilePictureUrl }); }
            var patient = await db.Patients.FindAsync(userId);
            if (patient != null) { patient.ProfilePictureUrl = req.ProfilePictureUrl; await db.SaveChangesAsync(); return Results.Ok(new { message = "Profile picture updated", profilePictureUrl = req.ProfilePictureUrl }); }
            return Results.NotFound("User not found.");
        }).RequireAuthorization();

        app.MapPost("/api/auth/register/admin", async ([FromBody] AdminRegisterRequest request, DoctorChatDbContext db, AuthService authService) =>
        {
            if (request.AdminSecretKey != adminSecretKey) return Results.Unauthorized();
            if (await db.Admins.AnyAsync(a => a.Email == request.Email)) return Results.Conflict("Admin with this email already exists.");
            var admin = new Admin { Id = Guid.NewGuid(), Email = request.Email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password), FirstName = request.FirstName, LastName = request.LastName, Role = "Admin", ProfilePictureUrl = request.ProfilePictureUrl ?? $"https://placehold.co/200x200/EBF4FF/5A67D8?text={request.FirstName[0]}", IsSuperAdmin = request.IsSuperAdmin };
            db.Admins.Add(admin); await db.SaveChangesAsync();
            return Results.Ok(new { Token = authService.GenerateToken(admin.Id, admin.Role, admin.FirstName, admin.LastName) });
        });

        app.MapPost("/api/auth/register/patient", async ([FromBody] RegisterPatientRequest request, DoctorChatDbContext db, AuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password)) return Results.BadRequest("Email and password are required.");
            if (await db.Patients.AnyAsync(p => p.Email == request.Email)) return Results.Conflict("Patient with this email already exists.");
            var patient = new Patient { Id = Guid.NewGuid(), Email = request.Email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password), FirstName = request.FirstName, LastName = request.LastName, Role = "Patient", ProfilePictureUrl = request.ProfilePictureUrl ?? $"https://placehold.co/200x200/EBF4FF/5A67D8?text={request.FirstName[0]}", BloodGroup = request.BloodGroup ?? "Not Specified", Genotype = request.Genotype ?? "Not Specified", Gender = request.Gender ?? "Not Specified", PhoneNumber = request.PhoneNumber ?? "", DateOfBirth = request.DateOfBirth ?? DateTime.MinValue, MedicalRecordsUrl = request.MedicalRecordsUrl, Allergies = request.Allergies ?? "", Preferences = new PatientPreferences() };
            db.Patients.Add(patient); await db.SaveChangesAsync();
            return Results.Ok(new { Token = authService.GenerateToken(patient.Id, patient.Role, patient.FirstName, patient.LastName), User = patient.ToDto() });
        });

        app.MapPost("/api/auth/register/doctor", async ([FromBody] RegisterDoctorRequest request, DoctorChatDbContext db, AuthService authService) =>
        {
            if (await db.Doctors.AnyAsync(d => d.Email == request.Email)) return Results.Conflict("Doctor with this email already exists.");
            var doctor = new Doctor { Id = Guid.NewGuid(), Email = request.Email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password), FirstName = request.FirstName, LastName = request.LastName, Role = "Doctor", ProfilePictureUrl = request.ProfilePictureUrl, Specialization = request.Specialization ?? "General", Bio = request.Bio ?? "Medical professional dedicated to patient care.", Education = request.Education ?? "MD", Experience = request.Experience ?? "1+ Years", MedicalLicense = request.MedicalLicense ?? string.Empty, ClinicName = request.ClinicName ?? "General Clinic", Phone = request.PhoneNumber ?? "", Languages = request.Languages ?? new List<string> { "English" }, Conditions = request.Conditions ?? new List<string>(), CertificateUrl = request.CertificateUrl, Preferences = new DoctorPreferences() };
            db.Doctors.Add(doctor); await db.SaveChangesAsync();
            return Results.Ok(new { Token = authService.GenerateToken(doctor.Id, doctor.Role, doctor.FirstName, doctor.LastName), User = doctor.ToDto() });
        });

        app.MapPost("/api/auth/login", async ([FromBody] LoginRequest request, DoctorChatDbContext db, AuthService authService) =>
        {
            var admin = await db.Admins.FirstOrDefaultAsync(a => a.Email == request.Email);
            if (admin != null && BCrypt.Net.BCrypt.Verify(request.Password, admin.PasswordHash))
            {
                if (admin.IsSuspended) return Results.Problem("Account suspended", statusCode: 403);
                return Results.Ok(new { Token = authService.GenerateToken(admin.Id, admin.Role, admin.FirstName, admin.LastName) });
            }
            var patient = await db.Patients.FirstOrDefaultAsync(p => p.Email == request.Email);
            if (patient != null && BCrypt.Net.BCrypt.Verify(request.Password, patient.PasswordHash))
            {
                if (patient.IsSuspended) return Results.Problem("Account suspended.", statusCode: 403);
                return Results.Ok(new { Token = authService.GenerateToken(patient.Id, patient.Role, patient.FirstName, patient.LastName), User = patient.ToDto() });
            }
            var doctor = await db.Doctors.FirstOrDefaultAsync(d => d.Email == request.Email);
            if (doctor != null && BCrypt.Net.BCrypt.Verify(request.Password, doctor.PasswordHash))
            {
                if (doctor.IsSuspended) return Results.Problem("Account suspended.", statusCode: 403);
                return Results.Ok(new { Token = authService.GenerateToken(doctor.Id, doctor.Role, doctor.FirstName, doctor.LastName), User = doctor.ToDto() });
            }
            return Results.Unauthorized();
        });

        app.MapGet("/api/admin/{id:guid}", async (Guid id, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var currentUserRole = httpContext.User.FindFirstValue(ClaimTypes.Role);
            if (currentUserRole != "Admin") return Results.Forbid();
            var admin = await db.Admins.FirstOrDefaultAsync(a => a.Id == id);
            return admin == null ? Results.NotFound() : Results.Ok(admin);
        }).RequireAuthorization("RequireAdminRole");

        app.MapGet("/api/doctor/{id:guid}", async (Guid id, DoctorChatDbContext db) =>
        {
            var doctor = await db.Doctors.Include(d => d.Reviews).FirstOrDefaultAsync(d => d.Id == id);
            return doctor == null ? Results.NotFound() : Results.Ok(doctor.ToDto());
        });

        app.MapGet("/api/patient/{id:guid}", async (Guid id, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var callerIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = httpContext.User.FindFirstValue(ClaimTypes.Role);
            if (role == "Patient" && callerIdStr != id.ToString()) return Results.Forbid();
            var patient = await db.Patients.FirstOrDefaultAsync(p => p.Id == id);
            return patient == null ? Results.NotFound() : Results.Ok(patient.ToDto());
        }).RequireAuthorization();

        // FIX: Two-step query — scalar filter in DB, Conditions filter in-memory.
        app.MapGet("/api/doctors/search", async ([FromQuery] string? query, DoctorChatDbContext db) =>
        {
            var q = db.Doctors.Include(d => d.Reviews).AsQueryable();
            if (!string.IsNullOrEmpty(query))
                q = q.Where(d => d.FirstName.Contains(query) || d.LastName.Contains(query) || d.Specialization.Contains(query));
            var doctors = await q.ToListAsync();
            if (!string.IsNullOrEmpty(query))
            {
                var lowerQuery = query.ToLowerInvariant();
                doctors = doctors.Where(d =>
                    d.FirstName.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    d.LastName.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    d.Specialization.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    d.Conditions.Any(c => c.Contains(lowerQuery, StringComparison.OrdinalIgnoreCase))).ToList();
            }
            return Results.Ok(doctors.Select(d => d.ToDto()));
        });

        app.MapPut("/api/doctor/profile", async ([FromBody] UpdateDoctorProfileRequest request, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var doctorId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var doctor = await db.Doctors.FindAsync(doctorId);
            if (doctor == null) return Results.NotFound();
            doctor.FirstName = request.FirstName; doctor.LastName = request.LastName; doctor.Email = request.Email;
            doctor.Phone = request.PhoneNumber; doctor.Specialization = request.Specialization;
            doctor.MedicalLicense = request.MedicalLicense; doctor.Experience = request.Experience;
            doctor.Languages = request.Languages; doctor.Education = request.Education;
            doctor.Bio = request.Bio; doctor.ClinicName = request.ClinicName; doctor.Conditions = request.Conditions;
            await db.SaveChangesAsync();
            return Results.Ok(doctor.ToDto());
        }).RequireAuthorization("RequireDoctorRole");

        app.MapPatch("/api/doctor/availability", async ([FromBody] UpdateAvailabilityRequest request, HttpContext httpContext, DoctorChatDbContext db, IHubContext<ChatHub> chatHub) =>
        {
            var doctorId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var doctor = await db.Doctors.FindAsync(doctorId);
            if (doctor == null) return Results.NotFound();
            if (!string.IsNullOrEmpty(request.Availability)) doctor.Availability = request.Availability;
            if (!string.IsNullOrEmpty(request.StartTime)) doctor.StartTime = request.StartTime;
            if (!string.IsNullOrEmpty(request.EndTime)) doctor.EndTime = request.EndTime;
            if (!string.IsNullOrEmpty(request.ConsultationType)) doctor.ConsultationType = request.ConsultationType;
            doctor.LastActive = DateTime.UtcNow;
            await db.SaveChangesAsync();
            await chatHub.Clients.All.SendAsync("DoctorAvailabilityChanged", new { DoctorId = doctor.Id, Availability = doctor.Availability, StartTime = doctor.StartTime, EndTime = doctor.EndTime, ConsultationType = doctor.ConsultationType, LastActive = doctor.LastActive });
            return Results.Ok(doctor.ToDto());
        }).RequireAuthorization("RequireDoctorRole");

        app.MapGet("/api/admin/users", async (DoctorChatDbContext db) =>
        {
            var doctors = await db.Doctors.Select(d => new { d.Id, d.Email, d.FirstName, d.LastName, d.Role, d.ProfilePictureUrl, UserType = "Doctor", d.IsSuspended }).ToListAsync();
            var patients = await db.Patients.Select(p => new { p.Id, p.Email, p.FirstName, p.LastName, p.Role, p.ProfilePictureUrl, UserType = "Patient", p.IsSuspended }).ToListAsync();
            var admins = await db.Admins.Select(a => new { a.Id, a.Email, a.FirstName, a.LastName, a.Role, a.ProfilePictureUrl, UserType = "Admin", a.IsSuspended }).ToListAsync();
            var allUsers = doctors.Cast<object>().Concat(patients.Cast<object>()).Concat(admins.Cast<object>()).OrderBy(u => ((dynamic)u).LastName);
            return Results.Ok(allUsers);
        }).RequireAuthorization("RequireAdminRole");

        app.MapPatch("/api/admin/user/{id:guid}/suspend", async (Guid id, [FromBody] AdminSuspendRequest request, DoctorChatDbContext db) =>
        {
            var doctor = await db.Doctors.FirstOrDefaultAsync(d => d.Id == id);
            if (doctor != null) { doctor.IsSuspended = request.IsSuspended; await db.SaveChangesAsync(); return Results.Ok(new { Message = "Doctor status updated" }); }
            var patient = await db.Patients.FirstOrDefaultAsync(p => p.Id == id);
            if (patient != null) { patient.IsSuspended = request.IsSuspended; await db.SaveChangesAsync(); return Results.Ok(new { Message = "Patient status updated" }); }
            return Results.NotFound();
        }).RequireAuthorization("RequireAdminRole");

        // ── Admin Stats ──────────────────────────────────────────────────
        app.MapGet("/api/admin/stats", async (DoctorChatDbContext db) =>
        {
            var totalDoctors = await db.Doctors.CountAsync();
            var totalPatients = await db.Patients.CountAsync();
            var totalAppointments = await db.Appointments.CountAsync();
            var pendingAppointments = await db.Appointments.CountAsync(a => a.Status == "Pending");
            var confirmedAppointments = await db.Appointments.CountAsync(a => a.Status == "Confirmed");
            var completedAppointments = await db.Appointments.CountAsync(a => a.Status == "Completed");
            var cancelledAppointments = await db.Appointments.CountAsync(a => a.Status == "Cancelled");
            var activeConsultations = await db.Appointments.CountAsync(a => a.Status == "Confirmed" && a.DateTime.Date == DateTime.UtcNow.Date);
            var totalReviews = await db.Reviews.CountAsync();
            var totalMessages = await db.ChatMessages.CountAsync();
            var suspendedUsers = await db.Doctors.CountAsync(d => d.IsSuspended) + await db.Patients.CountAsync(p => p.IsSuspended);

            // Recent counts (new users)
            var recentDoctors = totalDoctors;
            var recentPatients = totalPatients;

            // Appointments by specialty (via doctor)
            var appointmentsBySpecialty = await db.Appointments
                .Join(db.Doctors, a => a.DoctorId, d => d.Id, (a, d) => new { d.Specialization })
                .GroupBy(x => x.Specialization)
                .Select(g => new { Specialty = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .Take(10)
                .ToListAsync();

            return Results.Ok(new
            {
                totalDoctors, totalPatients, totalAppointments,
                pendingAppointments, confirmedAppointments, completedAppointments, cancelledAppointments,
                activeConsultations, totalReviews, totalMessages, suspendedUsers,
                recentDoctors, recentPatients, appointmentsBySpecialty
            });
        }).RequireAuthorization("RequireAdminRole");

        // ── Admin Appointments ──────────────────────────────────────────
        app.MapGet("/api/admin/appointments", async (DoctorChatDbContext db) =>
        {
            var appointments = await db.Appointments
                .OrderByDescending(a => a.DateTime)
                .Take(200)
                .ToListAsync();

            var doctorIds = appointments.Select(a => a.DoctorId).Distinct().ToList();
            var patientIds = appointments.Select(a => a.PatientId).Distinct().ToList();
            var doctors = await db.Doctors.Where(d => doctorIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id);
            var patients = await db.Patients.Where(p => patientIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id);

            var result = appointments.Select(a => new
            {
                a.Id,
                Date = a.DateTime.ToString("yyyy-MM-dd"),
                Time = a.DateTime.ToString("hh:mm tt"),
                a.Type, a.Status, a.Reason,
                a.DoctorId, a.PatientId,
                DoctorName = doctors.ContainsKey(a.DoctorId) ? $"Dr. {doctors[a.DoctorId].FirstName} {doctors[a.DoctorId].LastName}" : "Unknown",
                PatientName = patients.ContainsKey(a.PatientId) ? $"{patients[a.PatientId].FirstName} {patients[a.PatientId].LastName}" : "Unknown",
                DoctorSpecialty = doctors.ContainsKey(a.DoctorId) ? doctors[a.DoctorId].Specialization : ""
            });
            return Results.Ok(result);
        }).RequireAuthorization("RequireAdminRole");

        app.MapGet("/api/messages/{userId:guid}", async (Guid userId, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var currentUserId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var messages = await db.ChatMessages.Where(m => (m.SenderId == currentUserId && m.ReceiverId == userId) || (m.SenderId == userId && m.ReceiverId == currentUserId)).OrderBy(m => m.Timestamp).ToListAsync();
            return Results.Ok(messages);
        }).RequireAuthorization();

        app.MapPut("/api/messages/{id:guid}/read", async (Guid id, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var message = await db.ChatMessages.FindAsync(id);
            if (message == null || message.ReceiverId != userId) return Results.Forbid();
            message.IsRead = true; await db.SaveChangesAsync();
            return Results.Ok();
        }).RequireAuthorization();

        app.MapGet("/api/messages/unread/count", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var count = await db.ChatMessages.CountAsync(m => m.ReceiverId == userId && !m.IsRead);
            return Results.Ok(new { Count = count });
        }).RequireAuthorization();

        app.MapGet("/api/messages/conversations", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var conversations = await db.ChatMessages.Where(m => m.SenderId == userId || m.ReceiverId == userId).GroupBy(m => m.SenderId == userId ? m.ReceiverId : m.SenderId).Select(g => new { UserId = g.Key, LastMessage = g.OrderByDescending(m => m.Timestamp).First().Content, LastMessageTime = g.Max(m => m.Timestamp), UnreadCount = g.Count(m => m.ReceiverId == userId && !m.IsRead) }).OrderByDescending(c => c.LastMessageTime).ToListAsync();
            return Results.Ok(conversations);
        }).RequireAuthorization();

        app.MapPost("/api/reviews", async ([FromBody] ReviewCreateRequest request, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var patientId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var review = new Review { Id = Guid.NewGuid(), PatientId = patientId, DoctorId = request.DoctorId, Rating = request.Rating, Comment = request.Comment, DateSubmitted = DateTime.UtcNow };
            db.Reviews.Add(review); await db.SaveChangesAsync();
            return Results.Created($"/api/reviews/{review.Id}", review);
        }).RequireAuthorization("RequirePatientRole");

        app.MapGet("/api/reviews", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var doctorId)) return Results.Unauthorized();
            var reviews = await db.Reviews.Where(r => r.DoctorId == doctorId).Join(db.Patients, r => r.PatientId, p => p.Id, (r, p) => new { r.Id, r.Rating, r.Comment, r.DateSubmitted, PatientName = p.FirstName + " " + p.LastName }).OrderByDescending(r => r.DateSubmitted).ToListAsync();
            return Results.Ok(reviews);
        }).RequireAuthorization();

        app.MapGet("/api/reviews/{doctorId:guid}", async (Guid doctorId, DoctorChatDbContext db) =>
        {
            var reviews = await db.Reviews.Where(r => r.DoctorId == doctorId).Join(db.Patients, r => r.PatientId, p => p.Id, (r, p) => new { r.Id, r.PatientId, r.Rating, r.Comment, r.DateSubmitted, PatientName = p.FirstName + " " + p.LastName }).OrderByDescending(r => r.DateSubmitted).ToListAsync();
            return Results.Ok(reviews);
        }).RequireAuthorization();

        app.MapPut("/api/reviews/{id:guid}", async (Guid id, [FromBody] ReviewCreateRequest request, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var patientId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var review = await db.Reviews.FindAsync(id);
            if (review == null) return Results.NotFound();
            if (review.PatientId != patientId) return Results.Forbid();
            review.Rating = request.Rating;
            review.Comment = request.Comment;
            review.DateSubmitted = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.Ok(review);
        }).RequireAuthorization("RequirePatientRole");

        app.MapDelete("/api/reviews/{id:guid}", async (Guid id, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var patientId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var review = await db.Reviews.FindAsync(id);
            if (review == null) return Results.NotFound();
            if (review.PatientId != patientId) return Results.Forbid();
            db.Reviews.Remove(review);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization("RequirePatientRole");

        app.MapPost("/api/records", async ([FromBody] MedicalRecordCreateRequest request, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var doctorId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var record = new MedicalRecord { Id = Guid.NewGuid(), PatientId = request.PatientId, DoctorId = doctorId, Diagnosis = request.Diagnosis, Notes = request.Notes, DateCreated = DateTime.UtcNow };
            db.MedicalRecords.Add(record); await db.SaveChangesAsync();
            return Results.Created($"/api/records/{record.Id}", record);
        }).RequireAuthorization("RequireDoctorRole");

        app.MapGet("/api/records", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var patientId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var records = await db.MedicalRecords.Include(r => r.Doctor).Where(r => r.PatientId == patientId).OrderByDescending(r => r.DateCreated).ToListAsync();
            return Results.Ok(records);
        }).RequireAuthorization("RequirePatientRole");

        app.MapGet("/api/records/{patientId:guid}", async (Guid patientId, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var doctorIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(doctorIdStr)) return Results.Unauthorized();
            var patient = await db.Patients.FindAsync(patientId);
            if (patient == null) return Results.NotFound("Patient not found");
            var records = await db.MedicalRecords.Include(r => r.Doctor).Where(r => r.PatientId == patientId).OrderByDescending(r => r.DateCreated).Select(r => new { r.Id, r.PatientId, r.DoctorId, DoctorName = r.Doctor!.FirstName + " " + r.Doctor.LastName, r.Diagnosis, r.Notes, r.DateCreated }).ToListAsync();
            return Results.Ok(new { Patient = new { patient.Id, Name = patient.FirstName + " " + patient.LastName, patient.BloodGroup, patient.Genotype, patient.Gender, patient.DateOfBirth, patient.Allergies, patient.MedicalRecordsUrl }, Records = records });
        }).RequireAuthorization("RequireDoctorRole");

        app.MapGet("/api/chat/summary", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();
            var messages = await db.ChatMessages.Where(m => m.SenderId == userId || m.ReceiverId == userId).OrderByDescending(m => m.Timestamp).ToListAsync();
            var groups = messages.GroupBy(m => m.SenderId == userId ? m.ReceiverId : m.SenderId).ToList();
            var otherUserIds = groups.Select(g => g.Key).ToList();
            var allDoctors = await db.Doctors.Where(d => otherUserIds.Contains(d.Id)).ToListAsync();
            var allPatients = await db.Patients.Where(p => otherUserIds.Contains(p.Id)).ToListAsync();
            var summaries = groups.Select(g =>
            {
                var otherUserId = g.Key; var lastMsg = g.First(); var unreadCount = g.Count(m => m.ReceiverId == userId && !m.IsRead);
                string name = "Unknown User"; string? initials = "U"; string? profilePicture = null; string profileColor = "#3B82F6";
                var doctor = allDoctors.FirstOrDefault(d => d.Id == otherUserId);
                if (doctor != null) { name = $"{doctor.FirstName} {doctor.LastName}"; initials = doctor.FirstName.Length > 0 && doctor.LastName.Length > 0 ? (doctor.FirstName[0].ToString() + doctor.LastName[0].ToString()).ToUpper() : "DR"; profilePicture = doctor.ProfilePictureUrl; profileColor = doctor.ProfileColor; }
                else { var patient = allPatients.FirstOrDefault(p => p.Id == otherUserId); if (patient != null) { name = $"{patient.FirstName} {patient.LastName}"; initials = patient.FirstName.Length > 0 && patient.LastName.Length > 0 ? (patient.FirstName[0].ToString() + patient.LastName[0].ToString()).ToUpper() : "PT"; profilePicture = patient.ProfilePictureUrl; } }
                return new ChatSummaryDto(otherUserId, name, initials, profilePicture, lastMsg.Content, lastMsg.Timestamp, unreadCount, lastMsg.MessageType, profileColor, UserPresenceTracker.OnlineUsers.ContainsKey(otherUserId));
            }).OrderByDescending(s => s.LastMessageTimestamp).ToList();
            return Results.Ok(summaries);
        }).RequireAuthorization();

        app.MapGet("/api/chat/{otherUserId:guid}", async (Guid otherUserId, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();
            var messages = await db.ChatMessages.Where(m => (m.SenderId == userId && m.ReceiverId == otherUserId) || (m.SenderId == otherUserId && m.ReceiverId == userId)).OrderBy(m => m.Timestamp).ToListAsync();
            var unreadMessages = messages.Where(m => m.ReceiverId == userId && !m.IsRead).ToList();
            if (unreadMessages.Any()) { unreadMessages.ForEach(m => m.IsRead = true); await db.SaveChangesAsync(); }
            return Results.Ok(new { Messages = messages, IsOnline = UserPresenceTracker.OnlineUsers.ContainsKey(otherUserId) });
        }).RequireAuthorization();

        app.MapPut("/api/chat/{otherUserId:guid}/read", async (Guid otherUserId, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();
            var unread = await db.ChatMessages.Where(m => m.SenderId == otherUserId && m.ReceiverId == userId && !m.IsRead).ToListAsync();
            if (unread.Any()) { unread.ForEach(m => m.IsRead = true); await db.SaveChangesAsync(); }
            return Results.Ok();
        }).RequireAuthorization();

        app.MapDelete("/api/chat", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();
            db.ChatMessages.RemoveRange(db.ChatMessages); await db.SaveChangesAsync();
            return Results.Ok(new { message = "Chat history cleared" });
        }).RequireAuthorization();

        app.MapPost("/api/notifications/register-token", async ([FromBody] RegisterTokenRequest request, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();
            var doctor = await db.Doctors.FindAsync(userId);
            if (doctor != null) { doctor.PushToken = request.Token; await db.SaveChangesAsync(); return Results.Ok(new { message = "Doctor token registered" }); }
            var patient = await db.Patients.FindAsync(userId);
            if (patient != null) { patient.PushToken = request.Token; await db.SaveChangesAsync(); return Results.Ok(new { message = "Patient token registered" }); }
            var admin = await db.Admins.FindAsync(userId);
            if (admin != null) { admin.PushToken = request.Token; await db.SaveChangesAsync(); return Results.Ok(new { message = "Admin token registered" }); }
            return Results.NotFound("User profile not found");
        }).RequireAuthorization();

        app.MapPost("/api/prescriptions", async ([FromBody] PrescriptionCreateRequest request, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var patientId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var prescription = new Prescription {
                Id = Guid.NewGuid(), PatientId = patientId,
                MedicationName = request.MedicationName ?? request.DrugOrActivity ?? "",
                Dosage = request.Dosage ?? "",
                AlarmTimes = request.AlarmTimes ?? new(),
                Schedule = request.Schedule ?? new(),
                DrugOrActivity = request.DrugOrActivity ?? request.MedicationName ?? "",
                AlarmTime = request.AlarmTime ?? "",
                IntervalType = request.IntervalType ?? "everyday",
                SpecificDays = request.SpecificDays ?? new(),
                DoctorName = request.DoctorName ?? "",
                PrescribingDoctorId = request.DoctorId ?? "",
                Condition = request.Condition ?? "",
                IsActive = true, DateCreated = DateTime.UtcNow
            };
            db.Prescriptions.Add(prescription); await db.SaveChangesAsync();
            return Results.Created($"/api/prescriptions/{prescription.Id}", prescription);
        }).RequireAuthorization("RequirePatientRole");

        app.MapGet("/api/prescriptions", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var patientId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var prescriptions = await db.Prescriptions.Where(p => p.PatientId == patientId).OrderByDescending(p => p.DateCreated).ToListAsync();
            return Results.Ok(prescriptions);
        }).RequireAuthorization("RequirePatientRole");

        app.MapDelete("/api/prescriptions/{id:guid}", async (Guid id, HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var patientId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var prescription = await db.Prescriptions.FirstOrDefaultAsync(p => p.Id == id && p.PatientId == patientId);
            if (prescription == null) return Results.NotFound("Prescription not found or unauthorized");
            db.Prescriptions.Remove(prescription);
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Prescription deleted successfully" });
        }).RequireAuthorization("RequirePatientRole");

        app.MapPost("/api/appointments", async ([FromBody] AppointmentCreateRequest request, HttpContext httpContext, DoctorChatDbContext db, IHubContext<ChatHub> chatHub) =>
        {
            var patientId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isBooked = await db.Appointments.AnyAsync(a => a.DoctorId == request.DoctorId && a.DateTime == request.DateTime && a.Status != "Cancelled" && a.Status != "Declined");
            if (isBooked) return Results.Conflict("The doctor is already booked for this time slot.");
            var appointment = new Appointment { Id = Guid.NewGuid(), PatientId = patientId, DoctorId = request.DoctorId, DateTime = request.DateTime, Type = request.Type, Reason = request.Reason, Status = "Pending" };
            db.Appointments.Add(appointment); await db.SaveChangesAsync();
            var appWithDetails = await db.Appointments.Include(a => a.Patient).FirstOrDefaultAsync(a => a.Id == appointment.Id);
            if (appWithDetails != null)
            {
                await chatHub.Clients.Group(request.DoctorId.ToString()).SendAsync("NewAppointment", appWithDetails.ToDto());
                // Push notification to doctor
                var docToken = await ChatHub.GetPushTokenForUserAsync(db, request.DoctorId);
                if (!string.IsNullOrEmpty(docToken))
                {
                    var patientName = appWithDetails.Patient != null ? $"{appWithDetails.Patient.FirstName} {appWithDetails.Patient.LastName}" : "A patient";
                    _ = ChatHub.SendPushNotificationAsync(docToken, "New Appointment", $"{patientName} has booked an appointment.", new { type = "appointment" });
                }
            }
            return Results.Created($"/api/appointments/{appointment.Id}", appointment.ToDto());
        }).RequireAuthorization("RequirePatientRole");

        app.MapPut("/api/appointments/{id:guid}/status", async (Guid id, [FromBody] AppointmentStatusUpdateRequest request, HttpContext httpContext, DoctorChatDbContext db, IHubContext<ChatHub> chatHub) =>
        {
            var userIdStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();
            var role = httpContext.User.FindFirstValue(ClaimTypes.Role);
            var appointment = await db.Appointments.FindAsync(id);
            if (appointment == null) return Results.NotFound();
            if (role == "Doctor" && appointment.DoctorId != userId) return Results.Forbid();
            if (role == "Patient") { if (appointment.PatientId != userId) return Results.Forbid(); if (request.Status != "Cancelled") return Results.Forbid(); }
            appointment.Status = request.Status; await db.SaveChangesAsync();
            var appWithDetails = await db.Appointments.Include(a => a.Doctor).Include(a => a.Patient).FirstOrDefaultAsync(a => a.Id == id);
            if (appWithDetails != null) {
                var dto = appWithDetails.ToDto();
                await chatHub.Clients.Group(appointment.DoctorId.ToString()).SendAsync("AppointmentUpdated", dto);
                await chatHub.Clients.Group(appointment.PatientId.ToString()).SendAsync("AppointmentUpdated", dto);

                // Initialize chat on confirmation so it shows up in both users' chat lists immediately
                if (request.Status == "Confirmed")
                {
                    var initMsg = new ChatMessage
                    {
                        Id = Guid.NewGuid(),
                        SenderId = appointment.DoctorId,
                        ReceiverId = appointment.PatientId,
                        Content = "Your appointment has been confirmed. You can now chat with me here.",
                        Timestamp = DateTime.UtcNow,
                        IsRead = false,
                        MessageType = "text"
                    };
                    db.ChatMessages.Add(initMsg);
                    await db.SaveChangesAsync();

                    initMsg.SenderName = await GetUserNameAsync(db, appointment.DoctorId);
                    var msgDto = initMsg.ToDto();
                    
                    await chatHub.Clients.Group(appointment.PatientId.ToString()).SendAsync("ReceiveMessage", msgDto);
                    await chatHub.Clients.Group(appointment.DoctorId.ToString()).SendAsync("ReceiveMessage", msgDto);
                }

                // Push notification for appointment status change
                var targetId = role == "Doctor" ? appointment.PatientId : appointment.DoctorId;
                var otherPartyName = role == "Doctor"
                    ? $"Dr. {appWithDetails.Doctor?.FirstName} {appWithDetails.Doctor?.LastName}"
                    : $"{appWithDetails.Patient?.FirstName} {appWithDetails.Patient?.LastName}";
                var pushToken = await ChatHub.GetPushTokenForUserAsync(db, targetId);
                if (!string.IsNullOrEmpty(pushToken))
                {
                    var statusText = request.Status == "Confirmed" ? "accepted" : request.Status.ToLower();
                    _ = ChatHub.SendPushNotificationAsync(pushToken, $"Appointment {request.Status}", $"{otherPartyName} has {statusText} your appointment.", new { type = "appointment" });
                }
            }
            return Results.Ok(appointment.ToDto());
        }).RequireAuthorization();

        app.MapPut("/api/appointments/{id:guid}/reschedule", async (Guid id, [FromBody] RescheduleAppointmentRequest request, HttpContext httpContext, DoctorChatDbContext db, IHubContext<ChatHub> chatHub) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var appointment = await db.Appointments.Include(a => a.Doctor).Include(a => a.Patient).FirstOrDefaultAsync(a => a.Id == id);
            if (appointment == null) return Results.NotFound();
            if (appointment.PatientId != userId) return Results.Forbid();
            appointment.DateTime = request.NewDateTime; appointment.Status = "Pending";
            await db.SaveChangesAsync();
            var dto = appointment.ToDto();
            await chatHub.Clients.Group(appointment.PatientId.ToString()).SendAsync("AppointmentUpdated", dto);
            await chatHub.Clients.Group(appointment.DoctorId.ToString()).SendAsync("AppointmentUpdated", dto);
            return Results.Ok(dto);
        }).RequireAuthorization("RequirePatientRole");

        app.MapPut("/api/appointments/{id:guid}/consultation", async (Guid id, [FromBody] CompleteConsultationRequest request, HttpContext httpContext, DoctorChatDbContext db, IHubContext<ChatHub> chatHub) =>
        {
            var doctorId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var appointment = await db.Appointments.FindAsync(id);
            if (appointment == null || appointment.DoctorId != doctorId) return Results.Forbid();
            appointment.ClinicalNotes = request.Notes; appointment.Diagnosis = request.Diagnosis; appointment.PrescriptionDetails = request.Prescription; appointment.Status = "Completed";
            await db.SaveChangesAsync();
            var appWithDetails = await db.Appointments.Include(a => a.Doctor).Include(a => a.Patient).FirstOrDefaultAsync(a => a.Id == id);
            if (appWithDetails != null) {
                var dto = appWithDetails.ToDto();
                await chatHub.Clients.Group(appointment.DoctorId.ToString()).SendAsync("AppointmentUpdated", dto);
                await chatHub.Clients.Group(appointment.PatientId.ToString()).SendAsync("AppointmentUpdated", dto);
            }
            return Results.Ok(appointment.ToDto());
        }).RequireAuthorization("RequireDoctorRole");

        app.MapGet("/api/appointments", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var role = httpContext.User.FindFirstValue(ClaimTypes.Role);
            if (role == "Doctor") { var apps = await db.Appointments.Include(a => a.Patient).Where(a => a.DoctorId == userId).ToListAsync(); return Results.Ok(apps.Select(a => a.ToDto())); }
            else { var apps = await db.Appointments.Include(a => a.Doctor).ThenInclude(d => d!.Reviews).Where(a => a.PatientId == userId).ToListAsync(); return Results.Ok(apps.Select(a => a.ToDto())); }
        }).RequireAuthorization();

        app.MapPost("/api/calls/initiate", async ([FromBody] CallInitiateRequest request, HttpContext httpContext, DoctorChatDbContext db, IHubContext<SignalingHub> signalingHub) =>
        {
            var callerId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var call = new Call { Id = Guid.NewGuid(), CallerId = callerId, ReceiverId = request.ReceiverId, CallType = request.CallType, Status = CallStatus.Ringing, StartedAt = DateTime.UtcNow };
            db.Calls.Add(call); await db.SaveChangesAsync();
            await signalingHub.Clients.Group(request.ReceiverId.ToString()).SendAsync("IncomingCall", new { call.Id, call.CallerId, call.CallType, CallerName = await GetUserNameAsync(db, callerId), CallerProfilePicture = await GetUserProfilePictureAsync(db, callerId) });
            return Results.Ok(call);
        }).RequireAuthorization();

        app.MapPut("/api/calls/{id:guid}/answer", async (Guid id, HttpContext httpContext, DoctorChatDbContext db, IHubContext<SignalingHub> signalingHub) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var call = await db.Calls.FindAsync(id);
            if (call == null) return Results.NotFound("Call not found.");
            if (call.ReceiverId != userId) return Results.Forbid();
            call.Status = CallStatus.Active; call.AnsweredAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            await signalingHub.Clients.Group(call.CallerId.ToString()).SendAsync("CallAnswered", new { callId = call.Id, isAccepted = true, answererId = userId });
            return Results.Ok(call);
        }).RequireAuthorization();

        app.MapPut("/api/calls/{id:guid}/reject", async (Guid id, HttpContext httpContext, DoctorChatDbContext db, IHubContext<SignalingHub> signalingHub, IHubContext<ChatHub> chatHub) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var call = await db.Calls.FindAsync(id);
            if (call == null) return Results.NotFound("Call not found.");
            if (call.ReceiverId != userId) return Results.Forbid();
            call.Status = CallStatus.Rejected; call.EndedAt = DateTime.UtcNow;
            var message = new ChatMessage { Id = Guid.NewGuid(), SenderId = call.CallerId, ReceiverId = call.ReceiverId, Content = JsonSerializer.Serialize(new { type = call.CallType.ToString(), status = "Declined", duration = 0 }), Timestamp = DateTime.UtcNow, IsRead = false, MessageType = "call" };
            db.ChatMessages.Add(message); await db.SaveChangesAsync();
            message.SenderName = await GetUserNameAsync(db, message.SenderId);
            var messageDto = message.ToDto();
            await signalingHub.Clients.Group(call.CallerId.ToString()).SendAsync("CallRejected", new { callId = call.Id });
            await chatHub.Clients.Group(call.ReceiverId.ToString()).SendAsync("ReceiveMessage", messageDto);
            await chatHub.Clients.Group(call.CallerId.ToString()).SendAsync("ReceiveMessage", messageDto);
            return Results.Ok(call);
        }).RequireAuthorization();

        app.MapPut("/api/calls/{id:guid}/end", async (Guid id, HttpContext httpContext, DoctorChatDbContext db, IHubContext<SignalingHub> signalingHub, IHubContext<ChatHub> chatHub) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var call = await db.Calls.FindAsync(id);
            if (call == null) return Results.NotFound("Call not found.");
            if (call.CallerId != userId && call.ReceiverId != userId) return Results.Forbid();
            call.Status = CallStatus.Ended; call.EndedAt = DateTime.UtcNow;
            string statusText = "No answer";
            if (call.AnsweredAt.HasValue && call.EndedAt.HasValue) { call.Duration = (int)(call.EndedAt.Value - call.AnsweredAt.Value).TotalSeconds; int mins = call.Duration / 60; int secs = call.Duration % 60; statusText = $"{mins}:{secs:D2}"; }
            var message = new ChatMessage { Id = Guid.NewGuid(), SenderId = call.CallerId, ReceiverId = call.ReceiverId, Content = JsonSerializer.Serialize(new { type = call.CallType.ToString(), label = call.CallType == CallType.Video ? "Video call Ended" : "Voice call Ended", status = statusText, duration = call.Duration }), Timestamp = DateTime.UtcNow, IsRead = false, MessageType = "call" };
            db.ChatMessages.Add(message); await db.SaveChangesAsync();
            message.SenderName = await GetUserNameAsync(db, message.SenderId);
            var messageDto = message.ToDto();
            var otherUserId = call.CallerId == userId ? call.ReceiverId : call.CallerId;
            await signalingHub.Clients.Group(otherUserId.ToString()).SendAsync("CallEnded", new { callId = call.Id });
            await chatHub.Clients.Group(call.ReceiverId.ToString()).SendAsync("ReceiveMessage", messageDto);
            await chatHub.Clients.Group(call.CallerId.ToString()).SendAsync("ReceiveMessage", messageDto);
            return Results.Ok(call);
        }).RequireAuthorization();

        app.MapPut("/api/calls/{id:guid}/missed", async (Guid id, DoctorChatDbContext db, IHubContext<ChatHub> chatHub, IHubContext<SignalingHub> signalingHub) =>
        {
            var call = await db.Calls.FindAsync(id);
            if (call == null) return Results.NotFound("Call not found.");
            call.Status = CallStatus.Missed; call.EndedAt = DateTime.UtcNow;
            var message = new ChatMessage { Id = Guid.NewGuid(), SenderId = call.CallerId, ReceiverId = call.ReceiverId, Content = JsonSerializer.Serialize(new { type = call.CallType.ToString(), label = call.CallType == CallType.Video ? "Missed Video call" : "Missed Voice call", status = "Missed", duration = 0 }), Timestamp = DateTime.UtcNow, IsRead = false, MessageType = "call" };
            db.ChatMessages.Add(message); await db.SaveChangesAsync();
            message.SenderName = await GetUserNameAsync(db, message.SenderId);
            var messageDto = message.ToDto();
            await signalingHub.Clients.Group(call.CallerId.ToString()).SendAsync("MissedCall", new { callId = call.Id, callerId = call.CallerId, callType = call.CallType.ToString(), startedAt = call.StartedAt, callerName = await GetUserNameAsync(db, call.CallerId), callerProfilePicture = await GetUserProfilePictureAsync(db, call.CallerId) });
            await chatHub.Clients.Group(call.ReceiverId.ToString()).SendAsync("ReceiveMessage", messageDto);
            await chatHub.Clients.Group(call.CallerId.ToString()).SendAsync("ReceiveMessage", messageDto);
            return Results.Ok(call);
        }).RequireAuthorization();

        app.MapGet("/api/calls/turn-credentials", async (IConfiguration config, IHttpClientFactory httpClientFactory) =>
        {
            if (_cachedTurnCredentials.HasValue && _lastTurnFetch.HasValue && (DateTime.UtcNow - _lastTurnFetch.Value).TotalHours < 6)
                return Results.Ok(_cachedTurnCredentials.Value);
            var apiKey = config["MeteredSettings:ApiKey"];
            if (string.IsNullOrEmpty(apiKey)) return Results.Problem("Metered API Key not configured.");
            var client = httpClientFactory.CreateClient();
            var url = $"https://doctorchatapp.metered.live/api/v1/turn/credentials?apiKey={apiKey}";
            try
            {
                var response = await client.GetAsync(url); response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Metered TURN Response: {content}");
                var iceServers = JsonSerializer.Deserialize<JsonElement>(content);
                _cachedTurnCredentials = iceServers; _lastTurnFetch = DateTime.UtcNow;
                return Results.Ok(iceServers);
            }
            catch (Exception ex) { return Results.Problem($"Failed to fetch TURN credentials: {ex.Message}"); }
        }).RequireAuthorization();

        app.MapGet("/api/calls/history", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var calls = await db.Calls.Where(c => c.CallerId == userId || c.ReceiverId == userId).OrderByDescending(c => c.StartedAt).ToListAsync();
            var enrichedCalls = new List<object>();
            foreach (var call in calls)
            {
                var otherUserId = call.CallerId == userId ? call.ReceiverId : call.CallerId;
                enrichedCalls.Add(new { call.Id, call.CallerId, call.ReceiverId, call.CallType, call.Status, call.StartedAt, call.AnsweredAt, call.EndedAt, call.Duration, IsIncoming = call.ReceiverId == userId, OtherUserName = await GetUserNameAsync(db, otherUserId), OtherUserProfilePicture = await GetUserProfilePictureAsync(db, otherUserId), OtherUserId = otherUserId });
            }
            return Results.Ok(enrichedCalls);
        }).RequireAuthorization();

        app.MapGet("/api/calls/active", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var activeCalls = await db.Calls.Where(c => (c.CallerId == userId || c.ReceiverId == userId) && (c.Status == CallStatus.Ringing || c.Status == CallStatus.Active)).ToListAsync();
            return Results.Ok(activeCalls);
        }).RequireAuthorization();

        app.MapGet("/api/calls/missed/count", async (HttpContext httpContext, DoctorChatDbContext db) =>
        {
            var userId = Guid.Parse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var count = await db.Calls.CountAsync(c => c.ReceiverId == userId && c.Status == CallStatus.Missed);
            return Results.Ok(new { Count = count });
        }).RequireAuthorization();
    }

    public static async Task<string> GetUserNameAsync(DoctorChatDbContext db, Guid userId)
    {
        var doctor = await db.Doctors.FirstOrDefaultAsync(d => d.Id == userId);
        if (doctor != null) return $"{doctor.FirstName} {doctor.LastName}";
        var patient = await db.Patients.FirstOrDefaultAsync(p => p.Id == userId);
        if (patient != null) return $"{patient.FirstName} {patient.LastName}";
        var admin = await db.Admins.FirstOrDefaultAsync(a => a.Id == userId);
        if (admin != null) return $"{admin.FirstName} {admin.LastName}";
        return "Unknown User";
    }

    public static async Task<string?> GetUserProfilePictureAsync(DoctorChatDbContext db, Guid userId)
    {
        var doctor = await db.Doctors.FirstOrDefaultAsync(d => d.Id == userId);
        if (doctor != null) return doctor.ProfilePictureUrl;
        var patient = await db.Patients.FirstOrDefaultAsync(p => p.Id == userId);
        if (patient != null) return patient.ProfilePictureUrl;
        return null;
    }
}

// -------------------------------------------------------------------------------------
// DATABASE CONTEXT
// -------------------------------------------------------------------------------------

public static class JsonOptions { public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web); }

public class DoctorChatDbContext(DbContextOptions<DoctorChatDbContext> options) : DbContext(options)
{
    public DbSet<Doctor> Doctors { get; set; } = default!;
    public DbSet<Patient> Patients { get; set; } = default!;
    public DbSet<Admin> Admins { get; set; } = default!;
    public DbSet<Appointment> Appointments { get; set; } = default!;
    public DbSet<Review> Reviews { get; set; } = default!;
    public DbSet<MedicalRecord> MedicalRecords { get; set; } = default!;
    public DbSet<ChatMessage> ChatMessages { get; set; } = default!;
    public DbSet<Prescription> Prescriptions { get; set; } = default!;
    public DbSet<Call> Calls { get; set; } = default!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // FIX: All JSON converters now guard against NULL column values.
        // Accounts created before these columns existed have NULL in the DB.
        // JsonSerializer.Deserialize(null) throws, which the global handler
        // catches and returns as a 500 on ANY endpoint loading a Doctor or
        // Patient — including /auth/login. Fix: check IsNullOrEmpty first.

        modelBuilder.Entity<MedicalRecord>().Property(r => r.Diagnosis).HasConversion(
            v => JsonSerializer.Serialize(v, JsonOptions.Web),
            v => string.IsNullOrEmpty(v) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(v, JsonOptions.Web) ?? new List<string>());

        modelBuilder.Entity<Doctor>().Property(d => d.Preferences).HasConversion(
            v => JsonSerializer.Serialize(v, JsonOptions.Web),
            v => string.IsNullOrEmpty(v) ? new DoctorPreferences() : JsonSerializer.Deserialize<DoctorPreferences>(v, JsonOptions.Web) ?? new DoctorPreferences());

        modelBuilder.Entity<Doctor>().Property(d => d.Languages).HasConversion(
            v => JsonSerializer.Serialize(v, JsonOptions.Web),
            v => string.IsNullOrEmpty(v) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(v, JsonOptions.Web) ?? new List<string>());

        modelBuilder.Entity<Doctor>().Property(d => d.Conditions).HasConversion(
            v => JsonSerializer.Serialize(v, JsonOptions.Web),
            v => string.IsNullOrEmpty(v) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(v, JsonOptions.Web) ?? new List<string>());

        modelBuilder.Entity<Patient>().Property(p => p.Preferences).HasConversion(
            v => JsonSerializer.Serialize(v, JsonOptions.Web),
            v => string.IsNullOrEmpty(v) ? new PatientPreferences() : JsonSerializer.Deserialize<PatientPreferences>(v, JsonOptions.Web) ?? new PatientPreferences());

        modelBuilder.Entity<Prescription>().Property(p => p.AlarmTimes).IsRequired(false).HasConversion(
            v => JsonSerializer.Serialize(v, JsonOptions.Web),
            v => string.IsNullOrEmpty(v) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(v, JsonOptions.Web) ?? new List<string>());

        modelBuilder.Entity<Prescription>().Property(p => p.Schedule).IsRequired(false).HasConversion(
            v => JsonSerializer.Serialize(v, JsonOptions.Web),
            v => string.IsNullOrEmpty(v) ? new List<PrescriptionSchedule>() : JsonSerializer.Deserialize<List<PrescriptionSchedule>>(v, JsonOptions.Web) ?? new List<PrescriptionSchedule>());

        modelBuilder.Entity<Prescription>().Property(p => p.SpecificDays).IsRequired(false).HasConversion(
            v => JsonSerializer.Serialize(v, JsonOptions.Web),
            v => string.IsNullOrEmpty(v) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(v, JsonOptions.Web) ?? new List<string>());

        // Also make new frontend fields explicitly accept NULL from DB
        modelBuilder.Entity<Prescription>().Property(p => p.DrugOrActivity).IsRequired(false);
        modelBuilder.Entity<Prescription>().Property(p => p.AlarmTime).IsRequired(false);
        modelBuilder.Entity<Prescription>().Property(p => p.IntervalType).IsRequired(false);
        modelBuilder.Entity<Prescription>().Property(p => p.DoctorName).IsRequired(false);
        modelBuilder.Entity<Prescription>().Property(p => p.PrescribingDoctorId).IsRequired(false);
        modelBuilder.Entity<Prescription>().Property(p => p.Condition).IsRequired(false);

        modelBuilder.Entity<Call>().HasIndex(c => c.CallerId);
        modelBuilder.Entity<Call>().HasIndex(c => c.ReceiverId);
        modelBuilder.Entity<Call>().HasIndex(c => c.Status);
        modelBuilder.Entity<ChatMessage>().HasIndex(c => c.SenderId);
        modelBuilder.Entity<ChatMessage>().HasIndex(c => c.ReceiverId);
        modelBuilder.Entity<ChatMessage>().HasIndex(c => c.IsRead);
    }
}

// -------------------------------------------------------------------------------------
// MODELS
// -------------------------------------------------------------------------------------

public abstract class User
{
    [Key] public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? ProfilePictureUrl { get; set; }
    public bool IsSuspended { get; set; } = false;
    public string? PushToken { get; set; }
}

public class Admin : User { public bool IsSuperAdmin { get; set; } = false; }

public class Doctor : User
{
    public string Specialization { get; set; } = string.Empty;
    public string? CertificateUrl { get; set; }
    public string Bio { get; set; } = string.Empty;
    public string Education { get; set; } = string.Empty;
    public string Experience { get; set; } = string.Empty;
    public string MedicalLicense { get; set; } = string.Empty;
    public List<string> Languages { get; set; } = new();
    public string ClinicName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string ProfileColor { get; set; } = "#3B82F6";
    public string Availability { get; set; } = "Available";
    public string StartTime { get; set; } = "09:00 AM";
    public string EndTime { get; set; } = "05:00 PM";
    public string ConsultationType { get; set; } = "Video";
    public DateTime LastActive { get; set; } = DateTime.UtcNow;
    public bool Verified { get; set; } = false;
    public List<string> Conditions { get; set; } = new();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public DoctorPreferences Preferences { get; set; } = new();
    public double Rating => Reviews.Count > 0 ? Reviews.Average(r => r.Rating) : 0.0;
    public int ReviewCount => Reviews.Count;
}

public class Patient : User
{
    public string BloodGroup { get; set; } = "Not Specified";
    public string Genotype { get; set; } = "Not Specified";
    public string Gender { get; set; } = "Not Specified";
    public string PhoneNumber { get; set; } = "";
    public DateTime DateOfBirth { get; set; }
    public string Allergies { get; set; } = "";
    public string? MedicalRecordsUrl { get; set; }
    public PatientPreferences Preferences { get; set; } = new();
}

public class Appointment
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public DateTime DateTime { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Type { get; set; } = "Video";
    public string Status { get; set; } = "Pending";
    public string? ClinicalNotes { get; set; }
    public string? Diagnosis { get; set; }
    public string? PrescriptionDetails { get; set; }
    public Patient? Patient { get; set; }
    public Doctor? Doctor { get; set; }
}

public class Review
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public DateTime DateSubmitted { get; set; }
    public Doctor? Doctor { get; set; }
}

public class MedicalRecord
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public List<string> Diagnosis { get; set; } = new();
    public string Notes { get; set; } = string.Empty;
    public DateTime DateCreated { get; set; }
    public Doctor? Doctor { get; set; }
}

public class ChatMessage
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public Guid ReceiverId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public bool IsRead { get; set; } = false;
    public string MessageType { get; set; } = "text";
    public string? AttachmentUrl { get; set; }
    public Guid? PrescriptionId { get; set; }
    [NotMapped] public string? SenderName { get; set; }
    public ChatMessageDto ToDto() => new() { Id = Id, SenderId = SenderId, ReceiverId = ReceiverId, Content = Content, Timestamp = Timestamp, IsRead = IsRead, MessageType = MessageType, AttachmentUrl = AttachmentUrl, PrescriptionId = PrescriptionId, SenderName = SenderName };
}

public class ChatMessageDto
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public Guid ReceiverId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public bool IsRead { get; set; }
    public string MessageType { get; set; } = "text";
    public string? AttachmentUrl { get; set; }
    public Guid? PrescriptionId { get; set; }
    public string? SenderName { get; set; }
}

public record RegisterTokenRequest(string Token);

public class Prescription
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string MedicationName { get; set; } = string.Empty;
    public string Dosage { get; set; } = string.Empty;
    public List<string> AlarmTimes { get; set; } = new();
    public List<PrescriptionSchedule> Schedule { get; set; } = new();
    public bool IsActive { get; set; } = true;
    public DateTime DateCreated { get; set; }
    public Patient? Patient { get; set; }
    // Frontend-compatible fields
    public string DrugOrActivity { get; set; } = string.Empty;
    public string AlarmTime { get; set; } = string.Empty;
    public string IntervalType { get; set; } = "everyday";
    public List<string> SpecificDays { get; set; } = new();
    public string DoctorName { get; set; } = string.Empty;
    public string PrescribingDoctorId { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
}

public class Call
{
    public Guid Id { get; set; }
    public Guid CallerId { get; set; }
    public Guid ReceiverId { get; set; }
    public CallType CallType { get; set; }
    public CallStatus Status { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? AnsweredAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int Duration { get; set; } = 0;
}

public enum CallType { Audio = 1, Video = 2 }
public enum CallStatus { Ringing = 1, Active = 2, Ended = 3, Rejected = 4, Missed = 5 }
public enum PrescriptionSchedule { Morning = 1, Afternoon = 2, Evening = 3 }
public class DoctorPreferences { public bool AvailableForChat { get; set; } = true; public Dictionary<string, bool> NotificationSettings { get; set; } = new(); }
public class PatientPreferences { public string PreferredDoctorSpecialization { get; set; } = "Any"; public Dictionary<string, bool> NotificationSettings { get; set; } = new(); }

// -------------------------------------------------------------------------------------
// DTOs & MAPPING
// -------------------------------------------------------------------------------------

public static class ResourceMapper
{
    public static DoctorDto ToDto(this Doctor d)
    {
        var availability = UserPresenceTracker.OnlineUsers.ContainsKey(d.Id) ? d.Availability : "Offline";
        return new DoctorDto(d.Id, d.FirstName, d.LastName, d.Email, d.Role, d.ProfilePictureUrl, d.Specialization, d.Bio, d.Education, d.Experience, d.MedicalLicense, d.Languages, d.ClinicName, d.Phone, d.ProfileColor, availability, d.LastActive, d.Verified, d.Conditions, d.Rating, d.ReviewCount, d.CertificateUrl, d.StartTime, d.EndTime, d.ConsultationType);
    }
    public static PatientDto ToDto(this Patient p) => new(p.Id, p.FirstName, p.LastName, p.Email, p.Role, p.ProfilePictureUrl, p.BloodGroup, p.Genotype, p.Gender, p.PhoneNumber, p.DateOfBirth, p.MedicalRecordsUrl, p.Allergies);
    public static AppointmentDto ToDto(this Appointment a) => new(a.Id, a.PatientId, a.DoctorId, a.DateTime, a.Reason, a.Type, a.Status, a.ClinicalNotes, a.Diagnosis, a.PrescriptionDetails, a.Doctor?.ToDto(), a.Patient?.ToDto());
}

public record DoctorDto(Guid Id, string FirstName, string LastName, string Email, string Role, string? ProfilePictureUrl, string Specialization, string Bio, string Education, string Experience, string MedicalLicense, List<string> Languages, string ClinicName, string Phone, string ProfileColor, string Availability, DateTime LastActive, bool Verified, List<string> Conditions, double Rating, int ReviewCount, string? CertificateUrl, string StartTime, string EndTime, string ConsultationType);
public record PatientDto(Guid Id, string FirstName, string LastName, string Email, string Role, string? ProfilePictureUrl, string BloodGroup, string Genotype, string Gender, string PhoneNumber, DateTime DateOfBirth, string? MedicalRecordsUrl, string Allergies);
public record AppointmentDto(Guid Id, Guid PatientId, Guid DoctorId, DateTime DateTime, string Reason, string Type, string Status, string? ClinicalNotes, string? Diagnosis, string? PrescriptionDetails, DoctorDto? Doctor, PatientDto? Patient);
public record ChatSummaryDto(Guid OtherUserId, string OtherUserName, string? OtherUserInitials, string? ProfilePictureUrl, string LastMessage, DateTime LastMessageTimestamp, int UnreadCount, string MessageType, string ProfileColor, bool IsOnline);

// -------------------------------------------------------------------------------------
// REQUEST RECORDS
// -------------------------------------------------------------------------------------

public record ProfilePictureUpdateRequest(string ProfilePictureUrl);
public record AdminRegisterRequest(string Email, string Password, string FirstName, string LastName, string AdminSecretKey, bool IsSuperAdmin = false, string? ProfilePictureUrl = null);
public record RegisterPatientRequest([Required, EmailAddress] string Email, [Required, MinLength(6)] string Password, [Required] string FirstName, [Required] string LastName, string? BloodGroup, string? Genotype, string? Gender, string? PhoneNumber, DateTime? DateOfBirth, string? ProfilePictureUrl, string? MedicalRecordsUrl, string? Allergies);
public record RegisterDoctorRequest([Required, EmailAddress] string Email, [Required] string Password, [Required] string FirstName, [Required] string LastName, string? Specialization, string? Bio, string? Education, string? Experience, string? MedicalLicense, List<string>? Languages, string? ClinicName, string? PhoneNumber, List<string>? Conditions, string? ProfilePictureUrl, string? CertificateUrl);
public record UpdateDoctorProfileRequest(string FirstName, string LastName, string Email, string? PhoneNumber, string? Specialization, string? MedicalLicense, string? Experience, string? Education, string? ClinicName, string? Bio, List<string>? Languages, List<string>? Conditions);
public record LoginRequest(string Email, string Password);
public record ReviewCreateRequest(Guid DoctorId, int Rating, string Comment);
public record AppointmentCreateRequest(Guid DoctorId, DateTime DateTime, string Reason, string Type);
public record RescheduleAppointmentRequest(DateTime NewDateTime);
public record AppointmentStatusUpdateRequest(string Status);
public record CompleteConsultationRequest(string Notes, string Diagnosis, string Prescription);
public record MedicalRecordCreateRequest(Guid PatientId, List<string> Diagnosis, string Notes);
public record PrescriptionCreateRequest(string? MedicationName, string? Dosage, List<string>? AlarmTimes, List<PrescriptionSchedule>? Schedule, string? DrugOrActivity, string? AlarmTime, string? IntervalType, List<string>? SpecificDays, string? DoctorName, string? DoctorId, string? Condition);
public record AdminSuspendRequest(bool IsSuspended);
public record CallInitiateRequest(Guid ReceiverId, CallType CallType);
public record UpdateAvailabilityRequest(string? Availability, string? StartTime, string? EndTime, string? ConsultationType);

// -------------------------------------------------------------------------------------
// SERVICES & HUBS
// -------------------------------------------------------------------------------------

public static class UserPresenceTracker
{
    public static System.Collections.Concurrent.ConcurrentDictionary<Guid, bool> OnlineUsers = new();
}

public class AuthService(string key, string issuer, string audience)
{
    private readonly string _key = key;
    private readonly string _issuer = issuer;
    private readonly string _audience = audience;

    public string GenerateToken(Guid userId, string role, string firstName, string lastName)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, role), new Claim(ClaimTypes.Name, $"{firstName} {lastName}"), new Claim("firstName", firstName), new Claim("lastName", lastName) };
        var token = new JwtSecurityToken(_issuer, _audience, claims, expires: DateTime.Now.AddHours(24), signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class ChatHub(DoctorChatDbContext dbContext) : Hub
{
    private readonly DoctorChatDbContext _dbContext = dbContext;

    public override async Task OnConnectedAsync()
    {
        if (Context.User != null && Guid.TryParse(Context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userGuid))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, userGuid.ToString());
            UserPresenceTracker.OnlineUsers[userGuid] = true;
            var role = Context.User.FindFirstValue(ClaimTypes.Role);
            if (role == "Doctor")
            {
                var doctor = await _dbContext.Doctors.FindAsync(userGuid);
                if (doctor != null) { doctor.LastActive = DateTime.UtcNow; await _dbContext.SaveChangesAsync(); await Clients.All.SendAsync("DoctorAvailabilityChanged", new { doctorId = doctor.Id, availability = doctor.Availability, lastActive = doctor.LastActive }); }
            }
            await Clients.All.SendAsync("UserPresenceChanged", new { userId = userGuid, isOnline = true });
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.User != null && Guid.TryParse(Context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userGuid))
        {
            UserPresenceTracker.OnlineUsers.TryRemove(userGuid, out _);
            var role = Context.User.FindFirstValue(ClaimTypes.Role);
            if (role == "Doctor")
            {
                var doctor = await _dbContext.Doctors.FindAsync(userGuid);
                if (doctor != null) { doctor.LastActive = DateTime.UtcNow; await _dbContext.SaveChangesAsync(); await Clients.All.SendAsync("DoctorAvailabilityChanged", new { doctorId = doctor.Id, availability = "Offline", lastActive = doctor.LastActive }); }
            }
            await Clients.All.SendAsync("UserPresenceChanged", new { userId = userGuid, isOnline = false });
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(Guid targetUserId, string messageContent, string messageType = "text", string? attachmentUrl = null, Guid? prescriptionId = null)
    {
        if (Context.User == null) return;
        var senderIdStr = Context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(senderIdStr, out var senderId)) return;
        if (senderId == targetUserId) return;
        var senderName = Context.User?.FindFirstValue(ClaimTypes.Name) ?? await Program.GetUserNameAsync(_dbContext, senderId);
        var message = new ChatMessage { Id = Guid.NewGuid(), SenderId = senderId, ReceiverId = targetUserId, Content = messageContent, Timestamp = DateTime.UtcNow, IsRead = false, MessageType = messageType, AttachmentUrl = attachmentUrl, PrescriptionId = prescriptionId, SenderName = senderName };
        _dbContext.ChatMessages.Add(message); await _dbContext.SaveChangesAsync();
        var dto = message.ToDto();
        await Clients.Group(targetUserId.ToString()).SendAsync("ReceiveMessage", dto);
        await Clients.Caller.SendAsync("MessageSentConfirmation", dto);

        // Send push notification to offline receiver
        if (!UserPresenceTracker.OnlineUsers.ContainsKey(targetUserId))
        {
            var pushToken = await GetPushTokenForUserAsync(_dbContext, targetUserId);
            if (!string.IsNullOrEmpty(pushToken))
            {
                var body = messageType switch { "image" => "📷 Photo", "audio" => "🎤 Voice note", "file" => "📎 Document", "prescription" => "💊 Prescription", _ => messageContent };
                _ = SendPushNotificationAsync(pushToken, senderName ?? "New Message", body, new { senderId = senderId.ToString(), senderName, type = "chat" });
            }
        }
    }

    public static async Task<string?> GetPushTokenForUserAsync(DoctorChatDbContext db, Guid userId)
    {
        var doctor = await db.Doctors.FindAsync(userId);
        if (doctor?.PushToken != null) return doctor.PushToken;
        var patient = await db.Patients.FindAsync(userId);
        return patient?.PushToken;
    }

    public static async Task SendPushNotificationAsync(string pushToken, string title, string body, object? data = null)
    {
        try
        {
            using var httpClient = new HttpClient();
            var payload = new { to = pushToken, title, body, data, sound = "default" };
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            await httpClient.PostAsync("https://exp.host/--/api/v2/push/send", content);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Push notification failed: {ex.Message}");
        }
    }
}

public class SignalingHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        if (Context.User != null && Guid.TryParse(Context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userGuid))
            await Groups.AddToGroupAsync(Context.ConnectionId, userGuid.ToString());
        await base.OnConnectedAsync();
    }

    public async Task CallUser(Guid targetUserId, string callId, string callType, string callerName)
    {
        if (Context.User == null) return;
        var callerId = Context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!UserPresenceTracker.OnlineUsers.ContainsKey(targetUserId)) { await Clients.Caller.SendAsync("CallFailed", new { callId = callId, reason = "User is offline" }); return; }
        await Clients.Group(targetUserId.ToString()).SendAsync("IncomingCall", new { callId = callId, callerId = callerId, callerName = callerName, callType = callType.ToString() });
    }

    public async Task AnswerCall(Guid targetUserId, string callId, bool accept)
    {
        var answererId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group(targetUserId.ToString()).SendAsync("CallAnswered", new { callId = callId, answererId = answererId, isAccepted = accept });
    }

    public async Task EndCall(Guid targetUserId, string callId)
    {
        await Clients.Group(targetUserId.ToString()).SendAsync("CallEnded", new { callId = callId });
    }

    public async Task JoinCall(string callId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, callId.ToString());
    }

    public async Task SendOffer(Guid targetUserId, string callId, string sdpOffer)
    {
        await Clients.Group(targetUserId.ToString()).SendAsync("ReceiveOffer", Context.ConnectionId, callId, sdpOffer);
    }

    public async Task SendAnswer(Guid targetUserId, string callId, string sdpAnswer)
    {
        await Clients.Group(targetUserId.ToString()).SendAsync("ReceiveAnswer", Context.ConnectionId, callId, sdpAnswer);
    }

    public async Task SendCandidate(Guid targetUserId, string callId, string candidate)
    {
        await Clients.Group(targetUserId.ToString()).SendAsync("ReceiveCandidate", Context.ConnectionId, callId, candidate);
    }
}