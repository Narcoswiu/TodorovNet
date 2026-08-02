namespace TodorovNET.API.Models;

public class EventDay
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public Event Event { get; set; } = null!;
    public int DayNumber { get; set; }
    public DateTime Date { get; set; }
    public string Title { get; set; } = string.Empty;
    public ICollection<EventSegment> Segments { get; set; } = new List<EventSegment>();
}

public class EventSegment
{
    public int Id { get; set; }
    public int EventDayId { get; set; }
    public EventDay EventDay { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public SegmentType Type { get; set; }
    public int Order { get; set; }
    public string? Distance { get; set; }
    public string? Description { get; set; }
    public TimeSpan? StartTime { get; set; }
}

public enum SegmentType { Navigation, XC, SpecialStage, Prologue }
