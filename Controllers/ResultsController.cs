using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TodorovNET.API.Data;
using TodorovNET.API.Hubs;
using TodorovNET.API.Models;

namespace TodorovNET.API.Controllers;

[ApiController]
[Route("api/events/{eventId}/results")]
public class ResultsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<RaceHub> _hub;

    public ResultsController(AppDbContext db, IHubContext<RaceHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(int eventId)
    {
        var results = await _db.Results
            .Include(r => r.Rider)
            .Where(r => r.EventId == eventId)
            .OrderBy(r => r.Rider.RaceNumber)
            .ToListAsync();
        return Ok(results);
    }

    [HttpGet("standings")]
    public async Task<IActionResult> GetStandings(int eventId, [FromQuery] int? classId)
    {
        var riders = await _db.Riders
            .Include(r => r.Results.Where(res => res.EventId == eventId))
            .Include(r => r.Penalties.Where(p => p.EventId == eventId))
            .Include(r => r.Class)
            .Where(r => r.EventId == eventId)
            .Where(r => classId == null || r.ClassId == classId)
            .ToListAsync();

        var standings = riders.Select(r =>
        {
            var nav = r.Results.FirstOrDefault(res => res.Type == ResultType.Navigation);
            var xcTotal = r.Results
                .Where(res => res.Type == ResultType.XCLap && res.Time.HasValue)
                .Sum(res => res.Time!.Value.TotalSeconds);
            var ssTotal = r.Results
                .Where(res => res.Type == ResultType.SpecialStage && res.Time.HasValue)
                .Sum(res => res.Time!.Value.TotalSeconds);
            var penalties = r.Penalties
                .Where(p => p.Status == PenaltyStatus.Confirmed && p.TimeAdded.HasValue)
                .Sum(p => p.TimeAdded!.Value.TotalSeconds);

            var status = nav?.Status ?? FinishStatus.DNS;
            if (r.Results.Any(res => res.Status == FinishStatus.DSQ))
                status = FinishStatus.DSQ;

            var navSeconds = nav?.Time?.TotalSeconds ?? 0;
            var total = navSeconds + xcTotal + ssTotal + penalties;

            return new
            {
                rider = new {
                    r.Id, r.RaceNumber, r.FirstName, r.LastName,
                    r.Club, r.Motorcycle, r.Country,
                    Class = r.Class?.Name
                },
                navTime = nav?.Time,
                xcTotal = xcTotal > 0 ? TimeSpan.FromSeconds(xcTotal) : (TimeSpan?)null,
                ssTotal = ssTotal > 0 ? TimeSpan.FromSeconds(ssTotal) : (TimeSpan?)null,
                penalties = penalties > 0 ? TimeSpan.FromSeconds(penalties) : (TimeSpan?)null,
                totalTime = total > 0 ? TimeSpan.FromSeconds(total) : (TimeSpan?)null,
                status
            };
        })
        .OrderBy(s => s.status != FinishStatus.Finished)
        .ThenBy(s => s.totalTime)
        .Select((s, i) => new {
            position = s.status == FinishStatus.Finished ? i + 1 : (int?)null,
            s.rider, s.navTime, s.xcTotal, s.ssTotal,
            s.penalties, s.totalTime, s.status
        })
        .ToList();

        return Ok(standings);
    }

    [HttpPost]
    public async Task<IActionResult> AddResult(int eventId, [FromBody] CreateResultDto dto)
    {
        var rider = await _db.Riders
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.RaceNumber == dto.RaceNumber);
        if (rider == null)
            return NotFound(new { error = $"Участник #{dto.RaceNumber} не е намерен." });

        if (dto.Type == ResultType.XCLap && dto.LapNumber.HasValue)
        {
            var existing = await _db.Results.FirstOrDefaultAsync(r =>
                r.RiderId == rider.Id && r.EventId == eventId &&
                r.Type == ResultType.XCLap && r.LapNumber == dto.LapNumber);
            if (existing != null)
            {
                existing.Time = dto.Time;
                existing.Status = dto.Status;
                existing.RecordedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync();
                await UpdateBestLap(eventId, rider.Id);
                await PushStandings(eventId);
                return Ok(new { existing.Id, existing.RiderId, existing.Time, existing.Status, existing.Type, existing.RecordedAt });
            }
        }

        if (dto.Type == ResultType.Navigation)
        {
            var existing = await _db.Results.FirstOrDefaultAsync(r =>
                r.RiderId == rider.Id && r.EventId == eventId &&
                r.Type == ResultType.Navigation);
            if (existing != null)
            {
                existing.Time = dto.Time;
                existing.Status = dto.Status;
                existing.RecordedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync();
                await PushStandings(eventId);
                return Ok(new { existing.Id, existing.RiderId, existing.Time, existing.Status, existing.Type, existing.RecordedAt });
            }
        }

        var result = new Result
        {
            RiderId = rider.Id,
            EventId = eventId,
            Type = dto.Type,
            SegmentName = dto.SegmentName,
            Time = dto.Time,
            Status = dto.Status,
            LapNumber = dto.LapNumber
        };

        _db.Results.Add(result);
        await _db.SaveChangesAsync();

        if (dto.Type == ResultType.XCLap)
            await UpdateBestLap(eventId, rider.Id);

        await PushStandings(eventId);
        return Ok(new { result.Id, result.RiderId, result.Time, result.Status, result.Type, result.RecordedAt });
    }

    [HttpPut("rider/{raceNumber}/status")]
    public async Task<IActionResult> SetStatus(int eventId, int raceNumber, [FromBody] SetStatusDto dto)
    {
        var rider = await _db.Riders
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.RaceNumber == raceNumber);
        if (rider == null) return NotFound();

        var result = await _db.Results.FirstOrDefaultAsync(r =>
            r.RiderId == rider.Id && r.EventId == eventId && r.Type == dto.Type)
            ?? new Result { RiderId = rider.Id, EventId = eventId, Type = dto.Type };

        result.Status = dto.Status;
        result.RecordedAt = DateTimeOffset.UtcNow;

        if (result.Id == 0) _db.Results.Add(result);
        await _db.SaveChangesAsync();
        await PushStandings(eventId);
        return Ok(new { result.Id, result.RiderId, result.Time, result.Status, result.Type, result.RecordedAt });
    }

    private async Task UpdateBestLap(int eventId, int riderId)
    {
        var laps = await _db.Results
            .Where(r => r.RiderId == riderId && r.EventId == eventId &&
                        r.Type == ResultType.XCLap && r.Time.HasValue)
            .ToListAsync();
        if (!laps.Any()) return;
        var best = laps.MinBy(l => l.Time!.Value);
        foreach (var lap in laps)
            lap.IsBestLap = lap.Id == best!.Id;
        await _db.SaveChangesAsync();
    }

    private async Task PushStandings(int eventId)
    {
        var standingsResult = await GetStandings(eventId, null) as OkObjectResult;
        await _hub.Clients.Group($"event-{eventId}")
            .SendAsync("StandingsUpdated", standingsResult?.Value);
    }
}

public record CreateResultDto(
    int RaceNumber,
    ResultType Type,
    TimeSpan? Time,
    FinishStatus Status,
    string? SegmentName,
    int? LapNumber
);

public record SetStatusDto(
    ResultType Type,
    FinishStatus Status
);
