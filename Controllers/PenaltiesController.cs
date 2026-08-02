using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TodorovNET.API.Data;
using TodorovNET.API.Hubs;
using TodorovNET.API.Models;

namespace TodorovNET.API.Controllers;

[ApiController]
[Route("api/events/{eventId}/penalties")]
public class PenaltiesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<RaceHub> _hub;

    public PenaltiesController(AppDbContext db, IHubContext<RaceHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(int eventId)
    {
        var penalties = await _db.Penalties
            .Include(p => p.Rider)
            .Where(p => p.EventId == eventId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
        return Ok(penalties);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int eventId, [FromBody] CreatePenaltyDto dto)
    {
        var rider = await _db.Riders
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.RaceNumber == dto.RaceNumber);
        if (rider == null)
            return NotFound(new { error = $"Участник #{dto.RaceNumber} не е намерен." });

        var penalty = new Penalty
        {
            EventId = eventId,
            RiderId = rider.Id,
            Type = dto.Type,
            TimeAdded = dto.TimeAdded,
            Description = dto.Description,
            Status = PenaltyStatus.Pending
        };

        _db.Penalties.Add(penalty);
        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"event-{eventId}")
            .SendAsync("PenaltyAdded", new {
                raceNumber = dto.RaceNumber,
                rider = $"{rider.FirstName} {rider.LastName}",
                penalty.Type,
                penalty.TimeAdded,
                penalty.Description
            });

        return Ok(penalty);
    }

    [HttpPut("{id}/confirm")]
    public async Task<IActionResult> Confirm(int eventId, int id)
    {
        var penalty = await _db.Penalties
            .Include(p => p.Rider)
            .FirstOrDefaultAsync(p => p.EventId == eventId && p.Id == id);
        if (penalty == null) return NotFound();

        penalty.Status = PenaltyStatus.Confirmed;
        await _db.SaveChangesAsync();

        // Класацията се обновява защото наказанието е потвърдено
        await _hub.Clients.Group($"event-{eventId}")
            .SendAsync("PenaltyConfirmed", new {
                raceNumber = penalty.Rider.RaceNumber,
                penalty.TimeAdded
            });

        return Ok(penalty);
    }

    [HttpPut("{id}/reject")]
    public async Task<IActionResult> Reject(int eventId, int id)
    {
        var penalty = await _db.Penalties
            .FirstOrDefaultAsync(p => p.EventId == eventId && p.Id == id);
        if (penalty == null) return NotFound();

        penalty.Status = PenaltyStatus.Rejected;
        await _db.SaveChangesAsync();
        return Ok(penalty);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int eventId, int id)
    {
        var penalty = await _db.Penalties
            .FirstOrDefaultAsync(p => p.EventId == eventId && p.Id == id);
        if (penalty == null) return NotFound();
        _db.Penalties.Remove(penalty);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record CreatePenaltyDto(
    int RaceNumber,
    PenaltyType Type,
    TimeSpan? TimeAdded,
    string Description
);
