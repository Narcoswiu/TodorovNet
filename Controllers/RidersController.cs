using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodorovNET.API.Data;
using TodorovNET.API.Models;

namespace TodorovNET.API.Controllers;

[ApiController]
[Route("api/events/{eventId}/riders")]
public class RidersController : ControllerBase
{
    private readonly AppDbContext _db;
    public RidersController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(int eventId)
    {
        var riders = await _db.Riders
            .Where(r => r.EventId == eventId)
            .OrderBy(r => r.RaceNumber)
            .ToListAsync();
        return Ok(riders);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int eventId, int id)
    {
        var rider = await _db.Riders
            .Include(r => r.Results)
            .Include(r => r.Penalties)
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.Id == id);
        if (rider == null) return NotFound();
        return Ok(rider);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(int eventId, [FromBody] CreateRiderDto dto)
    {
        var exists = await _db.Riders
            .AnyAsync(r => r.EventId == eventId && r.RaceNumber == dto.RaceNumber);
        if (exists)
            return BadRequest(new { error = $"Номер #{dto.RaceNumber} вече съществува!" });

        var rider = new Rider
        {
            EventId = eventId,
            RaceNumber = dto.RaceNumber,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            LicenseNumber = dto.LicenseNumber,
            LicenseStatus = dto.LicenseStatus,
            Club = dto.Club,
            Motorcycle = dto.Motorcycle,
            Country = dto.Country ?? "BG"
        };
        _db.Riders.Add(rider);
        await _db.SaveChangesAsync();
        return Ok(rider);
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int eventId, int id, [FromBody] CreateRiderDto dto)
    {
        var rider = await _db.Riders.FirstOrDefaultAsync(r => r.EventId == eventId && r.Id == id);
        if (rider == null) return NotFound();
        rider.RaceNumber = dto.RaceNumber;
        rider.FirstName = dto.FirstName;
        rider.LastName = dto.LastName;
        rider.LicenseNumber = dto.LicenseNumber;
        rider.LicenseStatus = dto.LicenseStatus;
        rider.Club = dto.Club;
        rider.Motorcycle = dto.Motorcycle;
        rider.Country = dto.Country ?? rider.Country;
        rider.ClassId = dto.ClassId;
        await _db.SaveChangesAsync();
        return Ok(rider);
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int eventId, int id)
    {
        var rider = await _db.Riders.FirstOrDefaultAsync(r => r.EventId == eventId && r.Id == id);
        if (rider == null) return NotFound();
        _db.Riders.Remove(rider);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record CreateRiderDto(
    int RaceNumber,
    string FirstName,
    string LastName,
    string? LicenseNumber,
    LicenseStatus LicenseStatus,
    string? Club,
    string? Motorcycle,
    string? Country,
    int? ClassId
);
