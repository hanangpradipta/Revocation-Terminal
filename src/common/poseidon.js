/**
 * poseidon.js — Fungsi hash Poseidon versi JavaScript.
 *
 * Poseidon adalah fungsi hash yang "ramah sirkuit": jauh lebih murah dihitung di
 * dalam sirkuit ZKP dibanding SHA-256 (Bab II 2.1.4). Versi JavaScript ini
 * (circomlibjs) menghasilkan nilai yang SAMA PERSIS dengan template Poseidon di
 * circomlib. Kesamaan inilah yang membuat C dan ctx yang dihitung di luar
 * sirkuit cocok dengan yang dihitung di dalam sirkuit.
 *
 * Dipakai oleh: commitment.js (h, C), context.js (ctx), revocationTree.js (kunci genesis).
 */

const { buildPoseidon } = require("circomlibjs"); // pustaka resmi iden3: implementasi Poseidon di JavaScript
const { assertField } = require("./field"); // pemeriksa elemen lapangan (lihat field.js)

// Instance Poseidon disimpan di sini agar hanya dibangun sekali (pembangunannya
// memakan waktu karena memuat konstanta-konstanta Poseidon).
let poseidonInstance = null; // null = belum dibangun

/**
 * Mengembalikan instance Poseidon yang sudah dibangun (pola singleton).
 * @returns {Promise<Function>} fungsi poseidon dari circomlibjs
 */
async function getPoseidon() { // membangun Poseidon sekali saja
  if (!poseidonInstance) { // pemanggilan pertama: belum ada instance
    poseidonInstance = await buildPoseidon(); // bangun sekali (memuat konstanta), lalu simpan
  }
  return poseidonInstance; // pemanggilan berikutnya langsung memakai instance yang sama
}

/**
 * Menghitung Poseidon(x1, x2, ..., xn) dan mengembalikan hasilnya sebagai bigint.
 *
 * Contoh pemakaian di modul ini:
 *   - h   = Poseidon(s)                                    (Bab III 3.3.1)
 *   - C   = Poseidon(credId, issuerId, schemaId, h)        (Persamaan 3.1)
 *   - ctx = Poseidon(nonce, verifierId)                    (Persamaan 3.3)
 *
 * @param {bigint[]} inputs daftar elemen lapangan (1 sampai 16 elemen)
 * @returns {Promise<bigint>} hasil hash sebagai elemen lapangan
 */
async function poseidonHash(inputs) { // hash Poseidon dari daftar bigint
  const poseidon = await getPoseidon(); // ambil instance Poseidon (dibangun sekali saja)
  inputs.forEach((x, i) => assertField(x, `masukan Poseidon ke-${i}`)); // setiap masukan wajib elemen lapangan yang sah
  // poseidon() mengembalikan elemen dalam representasi internal (Montgomery);
  // F.toObject() mengubahnya menjadi bigint biasa.
  return poseidon.F.toObject(poseidon(inputs)); // hitung hash, lalu ubah ke BigInt biasa
}

module.exports = { getPoseidon, poseidonHash }; // fungsi yang boleh dipakai file lain
