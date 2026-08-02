namespace TodorovNET.API.Models;

public class RaceClass
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty; // "pro", "exp", "s40"
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int LapsXC { get; set; } = 2;
    public int SpecialStages { get; set; } = 0;
    public bool HasNavigation { get; set; } = true;
    public int StartGroup { get; set; } = 1;
    public int EventId { get; set; }
    public Event Event { get; set; } = null!;
    public ICollection<Rider> Riders { get; set; } = new List<Rider>();
}
