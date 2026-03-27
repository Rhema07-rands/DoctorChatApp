using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoctorChatApi.Migrations
{
    /// <inheritdoc />
    public partial class AddPushToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PushToken",
                table: "Patients",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PushToken",
                table: "Doctors",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PushToken",
                table: "Admins",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PushToken",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "PushToken",
                table: "Doctors");

            migrationBuilder.DropColumn(
                name: "PushToken",
                table: "Admins");
        }
    }
}
