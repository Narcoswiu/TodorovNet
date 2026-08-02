namespace TodorovNET.API.Models;

public class Rider
{
    public int Id { get; set; }
    public int RaceNumber { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? LicenseNumber { get; set; }
    public string? Club { get; set; }
    public string? Motorcycle { get; set; }
    public string Country { get; set; } = "BG";
    public LicenseStatus LicenseStatus { get; set; } = LicenseStatus.Valid;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public int EventId { get; set; }
    public Event Event { get; set; } = null!;
    public int? ClassId { get; set; }
    public RaceClass? Class { get; set; }
    public ICollection<Result> Results { get; set; } = new List<Result>();
    public ICollection<Penalty> Penalties { get; set; } = new List<Penalty>();
}

public enum LicenseStatus { Valid, Expired, Foreign, Missing }
