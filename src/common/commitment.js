/**
 * commitment.js — Rahasia holder dan commitment kredensial.
 *
 * Rujukan: Bab III 3.3.1 dan Persamaan 3.1:
 *     C = Poseidon(credId, issuerId, schemaId, Poseidon(s))
 *
 * Pembagian peran (Tabel 3.4):
 *   - s            : dibangkitkan dan disimpan HANYA oleh holder.
 *   - h = Poseidon(s): dikirim holder ke issuer saat penerbitan; diketahui issuer
 *                    dan holder. Juga dipakai sebagai bukti identitas holder saat
 *                    meminta lintasan Merkle (keputusan 1b).
 *   - C            : dicantumkan di VC; diketahui issuer, holder, dan verifier.
 *
 * Mengapa commitment? C menjadi "nama samaran" kredensial di pohon pencabutan.
 * Dari C saja, orang lain tidak dapat menebak s, sehingga tidak dapat membuat
 * bukti atas nama holder.
 */

const { randomFieldElement, assertField } = require("./field"); // pembangkit acak 248 bit + pemeriksa elemen lapangan
const { poseidonHash } = require("./poseidon"); // fungsi hash Poseidon

/**
 * Membangkitkan rahasia holder s (31 byte acak) untuk SATU kredensial.
 * Satu rahasia per kredensial mencegah dua issuer menautkan kredensial milik
 * holder yang sama lewat nilai Poseidon(s) yang identik (Bab III 3.3.1).
 * Dipakai pada: BPS-1 langkah 1 (holder).
 * @returns {bigint} rahasia s
 */
function generateSecret() { // BPS-1 langkah 1 (holder)
  return randomFieldElement(); // 248 bit acak kriptografis
}

/**
 * Menghitung h = Poseidon(s). Nilai inilah yang dikirim holder ke issuer;
 * s sendiri tidak pernah keluar dari wallet holder.
 * Dipakai pada: BPS-1 langkah 2 (holder).
 * @param {bigint} s rahasia holder
 * @returns {Promise<bigint>} h
 */
async function hashSecret(s) { // BPS-1 langkah 2 (holder)
  return poseidonHash([assertField(s, "s")]); // h = Poseidon(s); hash satu arah: dari h tidak bisa kembali ke s
}

/**
 * Membangkitkan credId acak 248 bit yang unik untuk setiap kredensial.
 * Dipakai pada: BPS-1 langkah 3 (issuer).
 * @returns {bigint} credId
 */
function generateCredId() { // BPS-1 langkah 3 (issuer)
  return randomFieldElement(); // acak, bukan berurutan, agar tidak membocorkan jumlah atau urutan penerbitan
}

/**
 * Menghitung commitment kredensial C (Persamaan 3.1).
 * Dipakai pada: BPS-1 langkah 4 (issuer) dan BPS-1 langkah 7 (holder memeriksa
 * ulang C dari s miliknya).
 *
 * @param {object} p
 * @param {bigint} p.credId   nomor acak kredensial
 * @param {bigint} p.issuerId alamat Ethereum issuer sebagai bilangan
 * @param {bigint} p.schemaId jenis kredensial (1 = ijazah, 2 = sertifikat pelatihan)
 * @param {bigint} p.h        Poseidon(s) dari holder
 * @returns {Promise<bigint>} C
 */
async function computeCommitment({ credId, issuerId, schemaId, h }) { // BPS-1 langkah 4 (issuer) dan 7 (holder)
  return poseidonHash([ // urutan masukan HARUS sama dengan sirkuit (nonRevocation.circom, dibuat di fase 1)
    assertField(credId, "credId"), // masukan 1: nomor kredensial
    assertField(issuerId, "issuerId"), // masukan 2: alamat issuer (mengikat C ke satu issuer)
    assertField(schemaId, "schemaId"), // masukan 3: jenis kredensial (mengikat C ke satu skema)
    assertField(h, "h"), // masukan 4: Poseidon(s) (mengikat C ke rahasia holder)
  ]);
}

module.exports = { generateSecret, hashSecret, generateCredId, computeCommitment }; // fungsi yang boleh dipakai file lain
