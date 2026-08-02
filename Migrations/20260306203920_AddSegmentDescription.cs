using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TodorovNET.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSegmentDescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "EventSegments",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "EventSegments");
        }
    }
}
