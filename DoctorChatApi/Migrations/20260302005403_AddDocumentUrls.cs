using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoctorChatApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentUrls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MedicalRecordsUrl",
                table: "Patients",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CertificateUrl",
                table: "Doctors",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MedicalRecordsUrl",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "CertificateUrl",
                table: "Doctors");
        }
    }
}
