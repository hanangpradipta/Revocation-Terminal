/**
 * paths.js — Lokasi dan konstanta dasar proyek.
 *
 * Pada FASE 0 berkas ini hanya berisi hal-hal paling dasar. Mulai fase 1 dan 2 ia
 * akan ditambah fungsi circuitPaths(depth) yang menunjuk ke berkas hasil kompilasi
 * sirkuit dan hasil trusted setup (build/circuits/..., build/keys/...). Dengan
 * menaruh semua lokasi di satu tempat, skrip dan tes tidak perlu menulis ulang path.
 */

const path = require("path"); // pustaka bawaan Node.js untuk menyusun alamat berkas lintas sistem operasi

/** Folder akar repositori. */
const ROOT = path.resolve(__dirname, "..", ".."); // __dirname = src/common → naik dua tingkat = folder utama proyek

/** Empat kedalaman pohon yang diuji (Bab III 3.3.2, Tabel 3.9). */
const DEPTHS = [8, 16, 24, 32]; // d = 8 sampai 32: kapasitas pohon 2^8 … 2^32 daun

/** Kedalaman konfigurasi utama (Bab III 3.3.2). */
const MAIN_DEPTH = 32; // dipakai demonstrasi dan skenario uji

module.exports = { ROOT, DEPTHS, MAIN_DEPTH }; // nilai yang boleh dipakai file lain
