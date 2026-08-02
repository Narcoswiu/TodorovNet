namespace TodorovNET.API.Models;

public class Contestation
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public Event Event { get; set; } = null!;
    public int FromRiderId { get; set; }
    public Rider FromRider { get; set; } = null!;
    public int? AgainstRiderId { get; set; }
    public string Description { get; set; } = string.Empty;
    public ContestationStatus Status { get; set; } = ContestationStatus.Pending;
    public string? JuryDecision { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ResolvedAt { get; set; }
}

public enum ContestationStatus { Pending, Approved, Rejected }
