using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoctorChatApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDoctorAvailabilityFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConsultationType",
                table: "Doctors",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EndTime",
                table: "Doctors",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "StartTime",
                table: "Doctors",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsultationType",
                table: "Doctors");

            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "Doctors");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "Doctors");
        }
    }
}
