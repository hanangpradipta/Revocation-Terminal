/**
 * fixtures.js — Pembantu tes: membuat kredensial dan sesi sintetis.
 *
 * Fungsi-fungsi ini meniru langkah BPS-1 (penerbitan) dan BPS-3 (permintaan verifier)
 * secara ringkas, supaya setiap tes tidak perlu menulis ulang langkahnya.
 * Data yang dihasilkan fiktif (Bab III 3.4: tidak memakai data kredensial nyata).
 *
 * Berkas ini BERTAMBAH di fase berikutnya (input sirkuit, pencabutan acak, dst.).
 */

const { // fungsi fondasi yang dibutuhkan pembantu
  generateSecret, // s
  hashSecret, // h = Poseidon(s)
  generateCredId, // credId acak
  computeCommitment, // C
  generateNonce, // nonce sesi
  computeContext, // ctx
  addressToField, // alamat → bilangan
} = require("../../src/common"); // diambil dari src/common

/** Alamat contoh issuer dan verifier (format alamat Ethereum sah, bukan akun nyata). */
const ISSUER_1 = "0x1000000000000000000000000000000000000001"; // perguruan tinggi
const ISSUER_2 = "0x2000000000000000000000000000000000000002"; // lembaga pelatihan
const VERIFIER_A = "0x00000000000000000000000000000000000000aa"; // verifier A
const VERIFIER_B = "0x00000000000000000000000000000000000000bb"; // verifier B (uji F5 di fase berikutnya)

/**
 * Membuat satu kredensial sintetis (ringkasan BPS-1 langkah 1-4).
 * @param {string} issuerAddress alamat issuer
 * @param {bigint} schemaId 1 = ijazah, 2 = sertifikat pelatihan
 * @returns {Promise<{s, h, credId, issuerId, schemaId, C}>}
 */
async function makeCredential(issuerAddress = ISSUER_1, schemaId = 1n) { // membuat satu kredensial sintetis
  const s = generateSecret(); // holder: rahasia s
  const h = await hashSecret(s); // holder: h = Poseidon(s)
  const credId = generateCredId(); // issuer: credId acak
  const issuerId = addressToField(issuerAddress); // alamat issuer sebagai bilangan
  const C = await computeCommitment({ credId, issuerId, schemaId, h }); // issuer: C
  return { s, h, credId, issuerId, schemaId, C }; // kembalikan semua nilai penyusun C
}

/**
 * Membuat sesi verifikasi: nonce baru + ctx untuk verifier tertentu
 * (ringkasan BPS-3 langkah 1 dan 3).
 * @param {string} verifierAddress alamat verifier
 */
async function makeSession(verifierAddress = VERIFIER_A) { // membuat satu sesi verifikasi
  const nonce = generateNonce(); // verifier: nonce baru
  const verifierId = addressToField(verifierAddress); // alamat verifier sebagai bilangan
  const ctx = await computeContext(nonce, verifierId); // ctx = Poseidon(nonce, verifierId)
  return { nonce, verifierId, ctx }; // kembalikan nonce, verifierId, dan ctx
}

module.exports = { // fungsi & konstanta yang dipakai file tes
  ISSUER_1, // alamat issuer 1
  ISSUER_2, // alamat issuer 2
  VERIFIER_A, // alamat verifier A
  VERIFIER_B, // alamat verifier B
  makeCredential, // pembuat kredensial
  makeSession, // pembuat sesi
};
