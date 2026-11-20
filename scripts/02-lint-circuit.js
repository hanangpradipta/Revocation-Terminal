/**
 * 02-lint-circuit.js — FASE 1: analisis statis sirkuit dengan Circomspect.
 *
 * Circomspect (Trail of Bits) menandai sinyal yang kurang dibatasi constraint
 * dan penugasan sinyal yang berisiko (Bab III 3.9 lapis 1).
 *
 * Yang dilakukan:
 *   1. Menjalankan circomspect pada circuits/nonRevocation.circom di level INFO.
 *   2. Menyimpan laporan lengkap ke results/fase1-circomspect.txt.
 *   3. Mencetak ringkasan jumlah temuan per tingkat (note / warning / error).
 *
 * Catatan: Circomspect hanya menganalisis template di berkas yang diberikan,
 * bukan isi pustaka circomlib. Karena itu celah isOld0 di SMTVerifier (circomlib)
 * TIDAK terdeteksi oleh alat ini dan dibuktikan lewat tes serangan di fase 1.
 *
 * Butuh program `circomspect` 0.9.0 terpasang (lihat docs/fase-1-sirkuit.md bagian 6).
 *
 * Cara menjalankan:  npm run circuit:lint
 */

const fs = require("fs"); // menulis laporan
const path = require("path"); // menyusun alamat berkas
const { spawnSync } = require("child_process"); // menjalankan program luar dan menangkap keluarannya
const { ROOT } = require("../src/common/paths"); // folder utama proyek

const target = path.join(ROOT, "circuits", "nonRevocation.circom"); // sirkuit yang dianalisis
const run = spawnSync("circomspect", [target, "-L", path.join(ROOT, "node_modules"), "-l", "INFO"], { // -L = folder pustaka, -l INFO = tampilkan semua tingkat temuan
  encoding: "utf8", // keluaran sebagai teks
});

if (run.error) { // program circomspect tidak ada di komputer
  console.error("circomspect tidak ditemukan. Pasang dengan: cargo install circomspect --version 0.9.0"); // beri petunjuk pemasangan
  process.exit(1); // keluar dengan kode gagal
}

// Gabungkan keluaran standar dan galat; hilangkan kode warna terminal.
const report = (run.stdout + run.stderr).replace(/\x1b\[[0-9;]*m/g, ""); // gabungkan keluaran lalu hapus kode warna terminal
fs.mkdirSync(path.join(ROOT, "results"), { recursive: true }); // pastikan folder results ada
fs.writeFileSync(path.join(ROOT, "results", "fase1-circomspect.txt"), report); // simpan laporan lengkap

// Hitung temuan per tingkat berdasarkan awalan baris.
const count = (prefix) => report.split("\n").filter((l) => l.startsWith(prefix)).length; // menghitung baris yang diawali tingkat temuan tertentu
const summary = { note: count("note:"), warning: count("warning:"), error: count("error:") }; // hasil yang tercatat: note 4, warning 1, error 0

console.log(report); // tampilkan laporan lengkap
console.log("Ringkasan temuan Circomspect:", summary); // tampilkan ringkasan jumlah temuan
console.log("Laporan lengkap: results/fase1-circomspect.txt"); // tampilkan lokasi berkas laporan

// Error menghentikan build; note dan warning ditinjau manual (lihat docs/fase-1-sirkuit.md).
process.exit(summary.error > 0 ? 1 : 0); // keluar dengan kode 1 hanya bila ada error
