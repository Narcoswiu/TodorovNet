using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodorovNET.API.Data;
using TodorovNET.API.Models;

namespace TodorovNET.API.Controllers;

[ApiController]
[Route("api/events/{eventId}/schedule")]
public class ScheduleController : ControllerBase
{
    private readonly AppDbContext _db;
    public ScheduleController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetSchedule(int eventId)
    {
        var days = await _db.EventDays
            .Include(d => d.Segments.OrderBy(s => s.Order).ThenBy(s => s.StartTime))
            .Where(d => d.EventId == eventId)
            .OrderBy(d => d.Date)
            .ToListAsync();
        return Ok(days);
    }

    [HttpPost("days")]
    public async Task<IActionResult> AddDay(int eventId, [FromBody] DayDto dto)
    {
        var count = await _db.EventDays.CountAsync(d => d.EventId == eventId);
        var day = new EventDay { EventId = eventId, Title = dto.Title, Date = dto.Date, DayNumber = count + 1 };
        _db.EventDays.Add(day);
        await _db.SaveChangesAsync();
        return Ok(day);
    }

    [HttpDelete("days/{dayId}")]
    public async Task<IActionResult> DeleteDay(int eventId, int dayId)
    {
        var day = await _db.EventDays.FindAsync(dayId);
        if (day == null || day.EventId != eventId) return NotFound();
        _db.EventDays.Remove(day);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("days/{dayId}/segments")]
    public async Task<IActionResult> AddSegment(int eventId, int dayId, [FromBody] SegmentDto dto)
    {
        var count = await _db.EventSegments.CountAsync(s => s.EventDayId == dayId);
        var seg = new EventSegment { 
            EventDayId = dayId, 
            Name = dto.Name, 
            Description = dto.Description, 
            StartTime = dto.StartTime, 
            Type = 0, 
            Order = count + 1 
        };
        _db.EventSegments.Add(seg);
        await _db.SaveChangesAsync();
        return Ok(seg);
    }

    [HttpDelete("days/{dayId}/segments/{segId}")]
    public async Task<IActionResult> DeleteSegment(int eventId, int dayId, int segId)
    {
        var seg = await _db.EventSegments.FindAsync(segId);
        if (seg == null) return NotFound();
        _db.EventSegments.Remove(seg);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record DayDto(string Title, DateTime Date, int DayNumber);
public record SegmentDto(string Name, string? Description, TimeSpan? StartTime, int Order);
