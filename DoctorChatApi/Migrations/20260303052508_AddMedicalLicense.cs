using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoctorChatApi.Migrations
{
    /// <inheritdoc />
    public partial class AddMedicalLicense : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MedicalLicense",
                table: "Doctors",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MedicalLicense",
                table: "Doctors");
        }
    }
}
