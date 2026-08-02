using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using TodorovNET.API.Data;

namespace TodorovNET.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _cfg;
    private readonly AppDbContext _db;

    public AuthController(IConfiguration cfg, AppDbContext db)
    {
        _cfg = cfg;
        _db = db;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        string role = "SuperAdmin";
        string username = dto.Username;
        int? eventId = null;

        // Check hardcoded super admin first
        if (dto.Username == _cfg["Admin:Username"] && dto.Password == _cfg["Admin:Password"])
        {
            role = "SuperAdmin";
        }
        else
        {
            // Check database users
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(dto.Password))).ToLower();
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == dto.Username && u.PasswordHash == hash && u.IsActive);
            if (user == null)
                return Unauthorized(new { error = "Грешно потребителско име или парола." });
            role = user.Role;
            username = user.Username;
            eventId = user.EventId;
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role),
        };
        if (eventId.HasValue)
            claims.Add(new Claim("eventId", eventId.Value.ToString()));

        var token = new JwtSecurityToken(
            issuer: _cfg["Jwt:Issuer"],
            audience: _cfg["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds
        );

        return Ok(new {
            token = new JwtSecurityTokenHandler().WriteToken(token),
            expires = token.ValidTo,
            username,
            role,
            eventId
        });
    }
}

public record LoginDto(string Username, string Password);
