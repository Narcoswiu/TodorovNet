namespace TodorovNET.API.Models;

public class Event
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public DateTimeOffset DateFrom { get; set; }
    public DateTimeOffset DateTo { get; set; }
    public EventType Type { get; set; } = EventType.Championship;
    public EventStatus Status { get; set; } = EventStatus.Upcoming;
    public FlagStatus Flag { get; set; } = FlagStatus.Green;
    public bool RequiresLicense { get; set; } = true;
    public bool RequiresClub { get; set; } = true;
    public bool AllowForeign { get; set; } = true;
    public bool IsPublic { get; set; } = true;
    public int? MaxRiders { get; set; }
    public string? ImageUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Rider> Riders { get; set; } = new List<Rider>();
    public ICollection<RaceClass> Classes { get; set; } = new List<RaceClass>();
    public ICollection<EventDay> Days { get; set; } = new List<EventDay>();
    public ICollection<Penalty> Penalties { get; set; } = new List<Penalty>();
    public ICollection<Contestation> Contestations { get; set; } = new List<Contestation>();
}

public enum EventType { Championship, Free }
public enum EventStatus { Upcoming, Live, Finished }
public enum FlagStatus { Green, Yellow, Red, Black }
