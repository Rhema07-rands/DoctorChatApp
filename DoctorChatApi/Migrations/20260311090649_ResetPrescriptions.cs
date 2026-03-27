using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoctorChatApi.Migrations
{
    /// <inheritdoc />
    public partial class ResetPrescriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Schedule",
                table: "Prescriptions",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "AlarmTimes",
                table: "Prescriptions",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AlarmTime",
                table: "Prescriptions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Condition",
                table: "Prescriptions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DoctorName",
                table: "Prescriptions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DrugOrActivity",
                table: "Prescriptions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "IntervalType",
                table: "Prescriptions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PrescribingDoctorId",
                table: "Prescriptions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SpecificDays",
                table: "Prescriptions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AlarmTime",
                table: "Prescriptions");

            migrationBuilder.DropColumn(
                name: "Condition",
                table: "Prescriptions");

            migrationBuilder.DropColumn(
                name: "DoctorName",
                table: "Prescriptions");

            migrationBuilder.DropColumn(
                name: "DrugOrActivity",
                table: "Prescriptions");

            migrationBuilder.DropColumn(
                name: "IntervalType",
                table: "Prescriptions");

            migrationBuilder.DropColumn(
                name: "PrescribingDoctorId",
                table: "Prescriptions");

            migrationBuilder.DropColumn(
                name: "SpecificDays",
                table: "Prescriptions");

            migrationBuilder.UpdateData(
                table: "Prescriptions",
                keyColumn: "Schedule",
                keyValue: null,
                column: "Schedule",
                value: "");

            migrationBuilder.AlterColumn<string>(
                name: "Schedule",
                table: "Prescriptions",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.UpdateData(
                table: "Prescriptions",
                keyColumn: "AlarmTimes",
                keyValue: null,
                column: "AlarmTimes",
                value: "");

            migrationBuilder.AlterColumn<string>(
                name: "AlarmTimes",
                table: "Prescriptions",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
