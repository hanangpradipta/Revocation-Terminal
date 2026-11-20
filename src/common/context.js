/**
 * context.js — Nilai konteks sesi verifikasi (ctx).
 *
 * Rujukan: Bab III Persamaan 3.3:   ctx = Poseidon(nonce, verifierId)
 *
 * ctx menjadi salah satu public input bukti. Karena nonce baru untuk setiap sesi
 * dan verifierId berbeda untuk setiap verifier, bukti yang dibuat untuk satu
 * sesi/verifier tidak dapat dipakai pada sesi atau verifier lain (F5, F6).
 */

const { randomFieldElement, assertField } = require("./field"); // pembangkit acak 248 bit + pemeriksa elemen lapangan
const { poseidonHash } = require("./poseidon"); // fungsi hash Poseidon

/**
 * Membangkitkan nonce acak baru (248 bit) untuk satu sesi verifikasi.
 * Dipakai pada: BPS-3 langkah 1 (verifier).
 * @returns {bigint} nonce
 */
function generateNonce() { // BPS-3 langkah 1 (verifier)
  return randomFieldElement(); // nonce = "number used once": acak dan hanya dipakai sekali
}

/**
 * Menghitung ctx = Poseidon(nonce, verifierId).
 * Dipakai pada: BPS-3 langkah 3 (holder, sebelum membuat bukti) dan langkah 9
 * (verifier menghitung ulang ctx dari nonce MILIKNYA sendiri).
 *
 * @param {bigint} nonce      nonce sesi dari verifier
 * @param {bigint} verifierId alamat Ethereum verifier sebagai bilangan
 * @returns {Promise<bigint>} ctx
 */
async function computeContext(nonce, verifierId) { // BPS-3 langkah 3 (holder) dan 9 (verifier)
  return poseidonHash([assertField(nonce, "nonce"), assertField(verifierId, "verifierId")]); // gabungkan nonce + identitas verifier menjadi satu nilai
}

module.exports = { generateNonce, computeContext }; // fungsi yang boleh dipakai file lain
