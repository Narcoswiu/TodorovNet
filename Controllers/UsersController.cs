using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TodorovNET.API.Data;
using TodorovNET.API.Models;
using System.Security.Cryptography;
using System.Text;

namespace TodorovNET.API.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    public UsersController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _db.Users.Include(u => u.Event).ToListAsync();
        return Ok(users.Select(u => new { u.Id, u.Username, u.Role, u.FullName, u.IsActive, u.CreatedAt, u.EventId, EventName = u.Event?.Name }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        if (await _db.Users.AnyAsync(u => u.Username == dto.Username))
            return BadRequest(new { error = "Потребителят вече съществува." });
        var user = new User
        {
            Username = dto.Username,
            PasswordHash = Hash(dto.Password),
            Role = dto.Role,
            FullName = dto.FullName,
            EventId = dto.EventId,
            IsActive = true
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return Ok(new { user.Id, user.Username, user.Role, user.FullName, user.IsActive, user.EventId });
    }

    [HttpPatch("{id}/password")]
    public async Task<IActionResult> ChangePassword(int id, [FromBody] string newPassword)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        user.PasswordHash = Hash(newPassword);
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPatch("{id}/active")]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        user.IsActive = !user.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { user.IsActive });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    static string Hash(string pw) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(pw))).ToLower();
}

public record CreateUserDto(string Username, string Password, string Role, string? FullName, int? EventId);
