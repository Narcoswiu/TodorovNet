using ExcelDataReader;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using TodorovNET.API.Data;
using TodorovNET.API.Models;

namespace TodorovNET.API.Controllers;

[ApiController]
[Route("api/events/{eventId}/import")]
public class ImportController : ControllerBase
{
    private readonly AppDbContext _db;
    public ImportController(AppDbContext db) { _db = db; }

    [HttpPost("riders")]
    public async Task<IActionResult> ImportRiders(int eventId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "Няма файл." });

        var ev = await _db.Events.FindAsync(eventId);
        if (ev == null) return NotFound();

        var classes = await _db.Classes.Where(c => c.EventId == eventId).ToListAsync();
        var existing = await _db.Riders.Where(r => r.EventId == eventId).ToListAsync();

        var results = new List<object>();
        var errors  = new List<object>();
        var added   = 0;
        var updated = 0;
        var skipped = 0;

        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        using var stream = file.OpenReadStream();

        // CSV
        if (file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        {
            using var reader = new StreamReader(stream, Encoding.UTF8);
            var header = await reader.ReadLineAsync();
            var cols   = ParseCsvLine(header ?? "").Select(h => h.Trim().ToLower()).ToList();
            var rowNum = 1;

            while (!reader.EndOfStream)
            {
                rowNum++;
                var line = await reader.ReadLineAsync();
                if (string.IsNullOrWhiteSpace(line)) continue;
                var vals = ParseCsvLine(line);
                var row  = new Dictionary<string, string>();
                for (var i = 0; i < cols.Count && i < vals.Count; i++)
                    row[cols[i]] = vals[i].Trim();

                var result = await ProcessRow(row, eventId, classes, existing, rowNum);
                if (result.IsError) { errors.Add(result.ErrorInfo!); skipped++; }
                else if (result.IsNew) { added++; results.Add(result.Summary!); }
                else { updated++; results.Add(result.Summary!); }
            }
        }
        // Excel
        else if (file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) ||
                 file.FileName.EndsWith(".xls",  StringComparison.OrdinalIgnoreCase))
        {
            using var excelReader = ExcelReaderFactory.CreateReader(stream);
            var ds = excelReader.AsDataSet(new ExcelDataSetConfiguration
            {
                ConfigureDataTable = _ => new ExcelDataTableConfiguration { UseHeaderRow = true }
            });

            var table = ds.Tables[0];
            var cols  = table.Columns.Cast<System.Data.DataColumn>()
                            .Select(c => c.ColumnName.Trim().ToLower()).ToList();

            for (var rowNum = 0; rowNum < table.Rows.Count; rowNum++)
            {
                var dataRow = table.Rows[rowNum];
                var row = new Dictionary<string, string>();
                for (var i = 0; i < cols.Count; i++)
                    row[cols[i]] = dataRow[i]?.ToString()?.Trim() ?? "";

                if (row.Values.All(string.IsNullOrWhiteSpace)) continue;

                var result = await ProcessRow(row, eventId, classes, existing, rowNum + 2);
                if (result.IsError) { errors.Add(result.ErrorInfo!); skipped++; }
                else if (result.IsNew) { added++; results.Add(result.Summary!); }
                else { updated++; results.Add(result.Summary!); }
            }
        }
        else
        {
            return BadRequest(new { error = "Поддържани формати: .xlsx, .xls, .csv" });
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            added,
            updated,
            skipped,
            total = added + updated + skipped,
            results,
            errors
        });
    }

    private async Task<RowResult> ProcessRow(
        Dictionary<string, string> row,
        int eventId,
        List<RaceClass> classes,
        List<Rider> existing,
        int rowNum)
    {
        var numStr = Get(row, "номер", "number", "race_number", "racenumber", "no", "#");
        if (!int.TryParse(numStr, out var raceNumber))
            return RowResult.Error(rowNum, $"Невалиден номер: '{numStr}'");

        var firstName = Get(row, "собствено", "first", "firstname", "first_name", "name");
        var lastName  = Get(row, "фамилно", "last", "lastname", "last_name", "surname");

        if (string.IsNullOrWhiteSpace(firstName) && string.IsNullOrWhiteSpace(lastName))
        {
            var fullName = Get(row, "участник", "rider", "name", "fullname");
            var parts = fullName.Split(' ', 2);
            firstName = parts.Length > 0 ? parts[0] : "";
            lastName  = parts.Length > 1 ? parts[1] : "";
        }

        if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
            return RowResult.Error(rowNum, $"Ред {rowNum}: Липсва ime за #{raceNumber}");

        var classCode = Get(row, "клас", "class", "category", "cat").ToLower();
        RaceClass? cls = null;
        if (!string.IsNullOrEmpty(classCode))
        {
            cls = classes.FirstOrDefault(c =>
                c.Code.Equals(classCode, StringComparison.OrdinalIgnoreCase) ||
                c.Name.Equals(classCode, StringComparison.OrdinalIgnoreCase));
        }

        var existing_rider = existing.FirstOrDefault(r => r.RaceNumber == raceNumber);
        var isNew = existing_rider == null;

        if (isNew)
        {
            var rider = new Rider
            {
                EventId       = eventId,
                RaceNumber    = raceNumber,
                FirstName     = firstName,
                LastName      = lastName,
                Club          = Get(row, "клуб", "club", "team"),
                Motorcycle    = Get(row, "мотор", "motorcycle", "bike", "moto"),
                LicenseNumber = Get(row, "лиценз", "license", "licence"),
                LicenseStatus = LicenseStatus.Valid,
                Country       = Get(row, "държава", "country", "nat") is { Length: > 0 } c ? c.ToUpper() : "BG",
                ClassId       = cls?.Id
            };
            _db.Riders.Add(rider);
            existing.Add(rider);
        }
        else
        {
            existing_rider!.FirstName     = firstName;
            existing_rider.LastName      = lastName;
            existing_rider.Club          = Get(row, "клуб", "club", "team") is { Length: > 0 } v ? v : existing_rider.Club;
            existing_rider.Motorcycle    = Get(row, "мотор", "motorcycle", "bike", "moto") is { Length: > 0 } v2 ? v2 : existing_rider.Motorcycle;
            existing_rider.LicenseNumber = Get(row, "лиценз", "license", "licence") is { Length: > 0 } v3 ? v3 : existing_rider.LicenseNumber;
            if (cls != null) existing_rider.ClassId = cls.Id;
        }

        return new RowResult
        {
            IsError = false,
            IsNew   = isNew,
            Summary = new { raceNumber, firstName, lastName, cls = cls?.Name ?? "—", isNew }
        };
    }

    private static string Get(Dictionary<string, string> row, params string[] keys)
    {
        foreach (var key in keys)
            if (row.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val))
                return val.Trim();
        return "";
    }

    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var inQuote = false;
        var current = new System.Text.StringBuilder();
        foreach (var ch in line)
        {
            if (ch == '"') inQuote = !inQuote;
            else if (ch == ',' && !inQuote) { result.Add(current.ToString()); current.Clear(); }
            else current.Append(ch);
        }
        result.Add(current.ToString());
        return result;
    }

    private class RowResult
    {
        public bool IsError { get; set; }
        public bool IsNew   { get; set; }
        public object? Summary { get; set; }
        public object? ErrorInfo { get; set; }
        public static RowResult Error(int row, string msg) =>
            new() { IsError = true, ErrorInfo = new { row, message = msg } };
    }
}
