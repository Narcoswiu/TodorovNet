namespace TodorovNET.API.Models;

public class Result
{
    public int Id { get; set; }
    public int RiderId { get; set; }
    public Rider Rider { get; set; } = null!;
    public int EventId { get; set; }
    public ResultType Type { get; set; }
    public string? SegmentName { get; set; }
    public TimeSpan? Time { get; set; }
    public FinishStatus Status { get; set; } = FinishStatus.Finished;
    public int? LapNumber { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsBestLap { get; set; } = false;
}

public enum ResultType { Navigation, XCLap, SpecialStage }
public enum FinishStatus { Finished, DNF, DNS, DSQ }
