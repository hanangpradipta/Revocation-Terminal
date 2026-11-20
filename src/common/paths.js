/**
 * paths.js — Lokasi dan konstanta dasar proyek.
 *
 * FASE 0 menyediakan konstanta dasar. FASE 1 menambah circuitPaths(depth) yang menunjuk ke
 * hasil kompilasi sirkuit (build/circuits/...). FASE 2 akan menambah lokasi kunci trusted
 * setup (zkey, verification key, kontrak Verifier). Dengan menaruh semua lokasi di satu
 * tempat, skrip dan tes tidak perlu menulis ulang path secara manual.
 *
 *   build/circuits/d32/nonRevocation_d32.r1cs            sistem constraint (R1CS)
 *   build/circuits/d32/nonRevocation_d32.sym             tabel nama sinyal
 *   build/circuits/d32/nonRevocation_d32_js/...wasm      pembangkit witness
 */

const path = require("path"); // pustaka bawaan Node.js untuk menyusun alamat berkas lintas sistem operasi

/** Folder akar repositori. */
const ROOT = path.resolve(__dirname, "..", ".."); // __dirname = src/common → naik dua tingkat = folder utama proyek

/** Empat kedalaman pohon yang diuji (Bab III 3.3.2, Tabel 3.9). */
const DEPTHS = [8, 16, 24, 32]; // d = 8 sampai 32: kapasitas pohon 2^8 … 2^32 daun

/** Kedalaman konfigurasi utama (Bab III 3.3.2). */
const MAIN_DEPTH = 32; // dipakai demonstrasi dan skenario uji

/**
 * Mengembalikan semua path milik satu kedalaman pohon (bagian fase 1).
 * @param {number} depth kedalaman d
 */
function circuitPaths(depth) { // lokasi berkas build satu kedalaman
  const name = `nonRevocation_d${depth}`; // nama dasar berkas, mis. "nonRevocation_d32"
  const circuitDir = path.join(ROOT, "build", "circuits", `d${depth}`); // folder hasil kompilasi sirkuit
  return { // daftar lokasi
    name, // nama dasar
    mainCircom: path.join(ROOT, "circuits", "main", `${name}.circom`), // berkas "main" yang memanggil NonRevocation(depth)
    circuitDir, // folder hasil kompilasi
    r1cs: path.join(circuitDir, `${name}.r1cs`), // sistem constraint R1CS (dipakai trusted setup di fase 2)
    sym: path.join(circuitDir, `${name}.sym`), // tabel nama sinyal (untuk debugging)
    wasm: path.join(circuitDir, `${name}_js`, `${name}.wasm`), // program WASM penghitung witness (dipakai holder saat membuat bukti)
  };
}

module.exports = { ROOT, DEPTHS, MAIN_DEPTH, circuitPaths }; // nilai/fungsi yang boleh dipakai file lain
