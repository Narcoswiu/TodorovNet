namespace TodorovNET.API.Models;

public class Penalty
{
    public int Id { get; set; }
    public int RiderId { get; set; }
    public Rider Rider { get; set; } = null!;
    public int EventId { get; set; }
    public Event Event { get; set; } = null!;
    public PenaltyType Type { get; set; }
    public TimeSpan? TimeAdded { get; set; }
    public string Description { get; set; } = string.Empty;
    public PenaltyStatus Status { get; set; } = PenaltyStatus.Pending;
    public string? EvidenceUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum PenaltyType { WrongRoute, DelayTP, Equipment, DangerousDriving, DSQ, Other }
public enum PenaltyStatus { Pending, Confirmed, Rejected }
