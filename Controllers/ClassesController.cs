using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodorovNET.API.Data;
using TodorovNET.API.Models;

namespace TodorovNET.API.Controllers;

[ApiController]
[Route("api/events/{eventId}/classes")]
public class ClassesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ClassesController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll(int eventId)
    {
        var classes = await _db.Classes
            .Where(c => c.EventId == eventId)
            .OrderBy(c => c.StartGroup)
            .ToListAsync();
        return Ok(classes);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int eventId, [FromBody] CreateClassDto dto)
    {
        var ev = await _db.Events.FindAsync(eventId);
        if (ev == null) return NotFound();
        var cls = new RaceClass { EventId=eventId, Code=dto.Code, Name=dto.Name, Color=dto.Color, LapsXC=dto.LapsXC, SpecialStages=dto.SpecialStages, HasNavigation=dto.HasNavigation, StartGroup=dto.StartGroup };
        _db.Classes.Add(cls);
        await _db.SaveChangesAsync();
        return Ok(cls);
    }

    [HttpPost("{id}/riders")]
    public async Task<IActionResult> AddRider(int eventId, int id, [FromBody] AssignRiderDto dto)
    {
        var rider = await _db.Riders.FirstOrDefaultAsync(r => r.Id == dto.RiderId && r.EventId == eventId);
        if (rider == null) return NotFound();
        rider.ClassId = id;
        await _db.SaveChangesAsync();
        return Ok(rider);
    }

    [HttpDelete("{id}/riders/{riderId}")]
    public async Task<IActionResult> RemoveRider(int eventId, int id, int riderId)
    {
        var rider = await _db.Riders.FirstOrDefaultAsync(r => r.Id == riderId && r.EventId == eventId);
        if (rider == null) return NotFound();
        rider.ClassId = null;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("seed")]
    public async Task<IActionResult> SeedDefaultClasses(int eventId)
    {
        var ev = await _db.Events.FindAsync(eventId);
        if (ev == null) return NotFound();
        var existing = await _db.Classes.AnyAsync(c => c.EventId == eventId);
        if (existing) return BadRequest(new { error = "Класовете вече са добавени." });
        var defaults = new List<RaceClass>
        {
            new() { EventId=eventId, Code="pro", Name="Pro",        Color="#ffffff", LapsXC=3, SpecialStages=3, HasNavigation=true,  StartGroup=1 },
            new() { EventId=eventId, Code="exp", Name="Expert",     Color="#ef4444", LapsXC=3, SpecialStages=3, HasNavigation=true,  StartGroup=2 },
            new() { EventId=eventId, Code="s40", Name="Senior 40+", Color="#f87171", LapsXC=2, SpecialStages=2, HasNavigation=true,  StartGroup=3 },
            new() { EventId=eventId, Code="s50", Name="Senior 50+", Color="#4ade80", LapsXC=2, SpecialStages=2, HasNavigation=true,  StartGroup=3 },
            new() { EventId=eventId, Code="std", Name="Standard",   Color="#86efac", LapsXC=2, SpecialStages=0, HasNavigation=true,  StartGroup=4 },
            new() { EventId=eventId, Code="jun", Name="Junior",     Color="#60a5fa", LapsXC=1, SpecialStages=0, HasNavigation=false, StartGroup=5 },
            new() { EventId=eventId, Code="wom", Name="Women",      Color="#f472b6", LapsXC=1, SpecialStages=0, HasNavigation=false, StartGroup=5 },
        };
        _db.Classes.AddRange(defaults);
        await _db.SaveChangesAsync();
        return Ok(defaults);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int eventId, int id)
    {
        var cls = await _db.Classes.FirstOrDefaultAsync(c => c.EventId == eventId && c.Id == id);
        if (cls == null) return NotFound();
        _db.Classes.Remove(cls);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record AssignRiderDto(int RiderId);
public record CreateClassDto(string Code, string Name, string Color, int LapsXC, int SpecialStages, bool HasNavigation, int StartGroup);
