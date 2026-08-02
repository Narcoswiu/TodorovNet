using Microsoft.EntityFrameworkCore;
using TodorovNET.API.Models;

namespace TodorovNET.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Event> Events => Set<Event>();
    public DbSet<Rider> Riders => Set<Rider>();
    public DbSet<RaceClass> Classes => Set<RaceClass>();
    public DbSet<Result> Results => Set<Result>();
    public DbSet<Penalty> Penalties => Set<Penalty>();
    public DbSet<Contestation> Contestations => Set<Contestation>();
    public DbSet<EventDay> EventDays => Set<EventDay>();
    public DbSet<EventSegment> EventSegments => Set<EventSegment>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Event>()
            .Property(e => e.Type).HasConversion<string>();
        modelBuilder.Entity<Event>()
            .Property(e => e.Status).HasConversion<string>();
        modelBuilder.Entity<Event>()
            .Property(e => e.Flag).HasConversion<string>();

        modelBuilder.Entity<Rider>()
            .Property(r => r.LicenseStatus).HasConversion<string>();
        modelBuilder.Entity<Rider>()
            .HasOne(r => r.Event)
            .WithMany(e => e.Riders)
            .HasForeignKey(r => r.EventId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Rider>()
            .HasOne(r => r.Class)
            .WithMany(c => c.Riders)
            .HasForeignKey(r => r.ClassId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Result>()
            .Property(r => r.Type).HasConversion<string>();
        modelBuilder.Entity<Result>()
            .Property(r => r.Status).HasConversion<string>();

        modelBuilder.Entity<Penalty>()
            .Property(p => p.Type).HasConversion<string>();
        modelBuilder.Entity<Penalty>()
            .Property(p => p.Status).HasConversion<string>();

        modelBuilder.Entity<Contestation>()
            .Property(c => c.Status).HasConversion<string>();
        modelBuilder.Entity<Contestation>()
            .HasOne(c => c.FromRider)
            .WithMany()
            .HasForeignKey(c => c.FromRiderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EventSegment>()
            .Property(s => s.Type).HasConversion<string>();
    }
}
