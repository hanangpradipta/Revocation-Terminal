/**
 * zk.js — Pembungkus snarkjs untuk menyusun input sirkuit dan menghitung witness.
 *
 * Rujukan: Bab III 3.3.3 (sirkuit), Algoritma 3.1.
 *
 * FASE 1 berisi dua fungsi: buildCircuitInput dan calculateWitness.
 * FASE 2 menambah pembuatan bukti Groth16 dan verifikasinya.
 *
 * Public input sirkuit (urutan PENTING, harus sama dengan kontrak di fase 3):
 *     [0] C      commitment kredensial
 *     [1] root   root pohon pencabutan yang dipakai
 *     [2] ctx    Poseidon(nonce, verifierId)
 *
 * Istilah:
 *   witness = seluruh nilai sinyal sirkuit (publik + privat) yang memenuhi semua constraint
 */

const snarkjs = require("snarkjs"); // pustaka zk-SNARK: di fase 1 dipakai untuk menghitung witness
const { circuitPaths } = require("./paths"); // lokasi berkas wasm per kedalaman

/**
 * Menyusun objek input untuk sirkuit NonRevocation(d).
 * Semua nilai diubah menjadi string desimal karena itulah format yang
 * diharapkan pembangkit witness Circom.
 *
 * @param {object} p
 * @param {bigint} p.C, p.root, p.ctx                  public input
 * @param {bigint} p.credId, p.issuerId, p.schemaId, p.s  witness privat (atribut + rahasia)
 * @param {object} p.path   hasil RevocationTree.getNonInclusionWitness(C)
 * @returns {object} input siap pakai untuk snarkjs
 */
function buildCircuitInput({ C, root, ctx, credId, issuerId, schemaId, s, path }) { // menyusun input sirkuit
  return { // objek input: bagian publik lalu privat
    // --- public input ---
    C: C.toString(), // commitment kredensial (juga tertulis di VC)
    root: root.toString(), // root pohon pencabutan yang dipakai bukti
    ctx: ctx.toString(), // pengikat sesi
    // --- witness privat ---
    credId: credId.toString(), // nomor kredensial
    issuerId: issuerId.toString(), // alamat issuer sebagai bilangan
    schemaId: schemaId.toString(), // jenis kredensial
    s: s.toString(), // RAHASIA holder (hanya dipakai di komputer holder)
    siblings: path.siblings.map((x) => x.toString()), // simpul saudara sepanjang lintasan Merkle (d buah)
    oldKey: path.oldKey.toString(), // key daun lain di ujung lintasan (bila ada)
    oldValue: path.oldValue.toString(), // value daun lain tersebut
    isOld0: path.isOld0.toString(), // 1 = ujung lintasan kosong; 0 = ujung lintasan daun lain
  };
}

/**
 * Menjalankan pembangkit witness (WASM) saja, tanpa membuat bukti.
 * Bila ada constraint yang dilanggar (misalnya s salah atau C sudah dicabut),
 * fungsi ini MELEMPAR galat. Dipakai tes untuk membuktikan bahwa witness
 * yang tidak sah memang ditolak sirkuit (F4, F7).
 *
 * @param {number} depth kedalaman pohon
 * @param {object} input hasil buildCircuitInput
 * @param {string} [wasmPath] path WASM lain (dipakai tes untuk varian sirkuit uji)
 * @returns {Promise<Uint8Array>} witness dalam format wtns
 */
async function calculateWitness(depth, input, wasmPath) { // menghitung witness (galat bila constraint dilanggar)
  const wtns = { type: "mem" }; // simpan witness di memori (bukan berkas)
  await snarkjs.wtns.calculate(input, wasmPath || circuitPaths(depth).wasm, wtns); // jalankan program WASM sirkuit; galat bila constraint tidak terpenuhi
  return wtns.data; // witness biner
}

module.exports = { // fungsi yang boleh dipakai file lain
  buildCircuitInput, // penyusun input
  calculateWitness, // penghitung witness
};
