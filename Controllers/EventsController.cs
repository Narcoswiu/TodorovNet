using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodorovNET.API.Data;
using TodorovNET.API.Models;

namespace TodorovNET.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EventsController(AppDbContext db)
    {
        _db = db;
    }

    // GET api/events
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var events = await _db.Events
            .Include(e => e.Classes)
            .Include(e => e.Days)
            .OrderByDescending(e => e.DateFrom)
            .ToListAsync();
        return Ok(events);
    }

    // GET api/events/1
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var ev = await _db.Events
            .Include(e => e.Classes)
            .Include(e => e.Days).ThenInclude(d => d.Segments)
            .Include(e => e.Riders)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (ev == null) return NotFound();
        return Ok(ev);
    }

    // POST api/events
    [HttpPost]
    public async Task<IActionResult> Create(Event ev)
    {
        _db.Events.Add(ev);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = ev.Id }, ev);
    }

    // PUT api/events/1/flag
    [HttpPut("{id}/flag")]
    public async Task<IActionResult> UpdateFlag(int id, [FromBody] FlagStatus flag)
    {
        var ev = await _db.Events.FindAsync(id);
        if (ev == null) return NotFound();
        ev.Flag = flag;
        await _db.SaveChangesAsync();
        return Ok(ev);
    }

    // PUT api/events/1/status
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] EventStatus status)
    {
        var ev = await _db.Events.FindAsync(id);
        if (ev == null) return NotFound();
        ev.Status = status;
        await _db.SaveChangesAsync();
        return Ok(ev);
    }

    // PUT api/events/1
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] Event updated)
    {
        var ev = await _db.Events.FindAsync(id);
        if (ev == null) return NotFound();
        ev.Name = updated.Name;
        ev.Location = updated.Location;
        ev.DateFrom = updated.DateFrom;
        ev.DateTo = updated.DateTo;
        ev.Type = updated.Type;
        ev.Status = updated.Status;
        ev.ImageUrl = updated.ImageUrl;
        await _db.SaveChangesAsync();
        return Ok(ev);
    }

    [HttpPatch("{id}/image")]
    public async Task<IActionResult> UpdateImage(int id, [FromBody] string? imageUrl)
    {
        var ev = await _db.Events.FindAsync(id);
        if (ev == null) return NotFound();
        ev.ImageUrl = imageUrl;
        await _db.SaveChangesAsync();
        return Ok(ev);
    }

    // DELETE api/events/1
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ev = await _db.Events.FindAsync(id);
        if (ev == null) return NotFound();
        _db.Events.Remove(ev);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
