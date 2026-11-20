/**
 * fase1-circuit.test.js — Tes FASE 1: sirkuit NonRevocation(d).
 *
 * Validasi lapis 1 Bab III 3.9: uji unit sirkuit dengan witness yang BENAR dan
 * witness yang SENGAJA DIBUAT SALAH. Tes ini hanya membutuhkan hasil kompilasi
 * (.wasm dan .r1cs); pembuatan bukti Groth16 dibahas di fase 2.
 *
 * Dua cara pemeriksaan dipakai:
 *   - calculateWitness : menjalankan pembangkit witness WASM. Gagal (melempar galat)
 *                        bila ada constraint "===" yang dilanggar.
 *   - wtns.check       : memeriksa SEMUA constraint R1CS terhadap witness.
 *
 * KEPUTUSAN 1c: sirkuit utama mengikuti Algoritma 3.1 persis (tanpa constraint isOld0).
 * Dua tes terakhir membuktikan konsekuensinya: serangan isOld0 BERHASIL pada sirkuit
 * utama (celah dicatat sebagai keterbatasan) dan GAGAL pada varian uji yang diperbaiki.
 *
 * Jalankan:  npm run test:fase1   (hasil kompilasi sudah ada di build/circuits/)
 */

const path = require("path"); // menyusun alamat berkas varian uji
const { expect } = require("chai"); // pernyataan tes
const snarkjs = require("snarkjs"); // wtns.check
const { // fungsi yang dipakai, dari src/common
  FIELD_P, // orde lapangan BN254
  RevocationTree, // pohon pencabutan
  buildCircuitInput, // menyusun input sirkuit
  calculateWitness, // menghitung witness
  circuitPaths, // lokasi berkas build
  poseidonHash, // hash Poseidon
  ROOT, // folder utama proyek
} = require("../src/common"); // semua diambil dari pintu masuk src/common/index.js
const { // pembantu tes
  makeCredential, // membuat kredensial
  makeSession, // membuat sesi (nonce + ctx)
  makeValidInput, // input sirkuit yang sah
  revokeRandom, // mengisi pohon dengan pencabutan acak
  makeRevokedCredential, // kredensial yang sudah dicabut
  ISSUER_1, // alamat issuer contoh
} = require("./helpers/fixtures"); // semua diambil dari test/helpers/fixtures.js

/** Path varian uji "diperbaiki" (sirkuit utama + constraint isOld0 biner), kedalaman 8. */
const DIPERBAIKI = { // lokasi berkas varian uji diperbaiki
  wasm: path.join(ROOT, "build", "circuits", "test", "nonRevocationDiperbaiki_js", "nonRevocationDiperbaiki.wasm"), // pembangkit witness varian uji
  r1cs: path.join(ROOT, "build", "circuits", "test", "nonRevocationDiperbaiki.r1cs"), // constraint varian uji
};

/**
 * Mengembalikan true bila pembangkit witness menolak input (constraint dilanggar).
 * @param {Function} fn fungsi async yang menjalankan calculateWitness
 */
async function rejects(fn) { // true bila sirkuit menolak input
  try { // coba jalankan
    await fn(); // hitung witness
    return false; // tidak ada galat = input diterima
  } catch (e) { // galat berarti ditolak
    return true; // galat = input ditolak sirkuit
  }
}

/** Memeriksa seluruh constraint R1CS terhadap witness yang sudah dihitung. */
async function checkAllConstraints(r1csFile, wtnsData) { // memeriksa semua constraint terhadap witness
  return snarkjs.wtns.check(r1csFile, { type: "mem", data: wtnsData }); // true bila SEMUA constraint terpenuhi
}

/** Invers modular di lapangan prima (dipakai untuk menyusun input serangan). */
function inv(x) { // invers modular untuk menyusun serangan
  let result = 1n; // hasil perhitungan
  let base = ((x % FIELD_P) + FIELD_P) % FIELD_P; // pastikan 0 ≤ base < p
  let e = FIELD_P - 2n; // teorema Fermat kecil: x^(p-2) = x^(-1) mod p
  while (e > 0n) { // perpangkatan cepat (square-and-multiply)
    if (e & 1n) result = (result * base) % FIELD_P; // kalikan bila bit terendah 1
    base = (base * base) % FIELD_P; // kuadratkan dasar
    e >>= 1n; // geser eksponen satu bit
  }
  return result; // hasil invers
}

describe("FASE 1 — Sirkuit NonRevocation(d)", function () { // kelompok tes terbesar: seluruh fase 1
  for (const depth of [8, 32]) { // uji kedalaman terkecil dan terbesar
    describe(`kedalaman d = ${depth}`, function () { // kelompok tes untuk satu kedalaman
      let tree; // pohon pencabutan untuk tes
      let cred; // kredensial aktif untuk tes
      let session; // sesi verifikasi untuk tes

      beforeEach(async function () { // dijalankan sebelum SETIAP tes di kelompok ini
        tree = await RevocationTree.create(depth); // pohon baru berisi daun genesis
        cred = await makeCredential(ISSUER_1, 1n); // kredensial aktif
        session = await makeSession(); // nonce + ctx
        await revokeRandom(tree, 5); // isi pohon dengan beberapa pencabutan lain agar lintasannya realistis
      });

      it("witness SAH: kredensial aktif memenuhi seluruh constraint R1CS", async function () { // tes 1: witness sah diterima
        const input = await makeValidInput(tree, cred, session.ctx); // input yang sah
        const wtns = await calculateWitness(depth, input); // hitung witness
        expect(await checkAllConstraints(circuitPaths(depth).r1cs, wtns)).to.equal(true); // semua constraint terpenuhi
      });

      it("F7: rahasia s yang salah -> witness tidak dapat dibangkitkan", async function () { // tes 2: rahasia s salah ditolak (F7)
        const input = await makeValidInput(tree, cred, session.ctx); // input yang sah dulu
        input.s = (cred.s + 1n).toString(); // ganti s → Poseidon(...) ≠ C
        expect(await rejects(() => calculateWitness(depth, input))).to.equal(true); // Constraint 1 gagal
      });

      it("C publik milik kredensial lain (meminjam commitment) -> ditolak (Constraint 1)", async function () { // tes 3: meminjam C milik orang lain ditolak
        const other = await makeCredential(); // kredensial lain
        const input = await makeValidInput(tree, cred, session.ctx); // input yang sah dulu
        input.C = other.C.toString(); // C orang lain dengan rahasia sendiri
        expect(await rejects(() => calculateWitness(depth, input))).to.equal(true); // harus ditolak sirkuit
      });

      it("root yang berbeda dari root pohon -> ditolak (Constraint 2)", async function () { // tes 4: root palsu ditolak
        const input = await makeValidInput(tree, cred, session.ctx); // input yang sah dulu
        input.root = (BigInt(input.root) + 1n).toString(); // root palsu
        expect(await rejects(() => calculateWitness(depth, input))).to.equal(true); // harus ditolak sirkuit
      });

      it("F4: kredensial yang sudah dicabut tidak punya lintasan non-inklusi", async function () { // tes 5: kredensial dicabut tidak punya lintasan (F4)
        const revoked = await makeRevokedCredential(tree); // kredensial yang sudah dicabut
        expect(await rejects(() => tree.getNonInclusionWitness(revoked.C))).to.equal(true); // pohon menolak menyusun lintasan
      });

      it("F4: memakai lintasan inklusi asli sebagai 'non-inklusi' (isOld0 = 1) -> ditolak", async function () { // tes 6: pemalsuan isOld0 = 1 ditolak (F4)
        const revoked = await makeRevokedCredential(tree); // kredensial yang sudah dicabut
        const inc = await tree.getInclusionPath(revoked.C); // lintasan nyata ke daun C
        const input = buildCircuitInput({ // penyerang mengaku "ujung lintasan kosong"
          ...revoked, // salin semua nilai kredensial dicabut
          root: inc.root, // root dari lintasan inklusi
          ctx: session.ctx, // konteks sesi
          path: { siblings: inc.siblings, oldKey: 0n, oldValue: 0n, isOld0: 1n }, // lintasan inklusi asli dengan klaim ujung kosong
        });
        expect(await rejects(() => calculateWitness(depth, input))).to.equal(true); // isOld0 biner: ditolak
      });

      it("F4: memakai lintasan inklusi + oldKey = C sendiri (isOld0 = 0) -> ditolak", async function () { // tes 7: pemalsuan isOld0 = 0 dengan oldKey = C ditolak (F4)
        const revoked = await makeRevokedCredential(tree); // kredensial yang sudah dicabut
        const inc = await tree.getInclusionPath(revoked.C); // lintasan inklusi asli
        const input = buildCircuitInput({ // penyerang mengaku "ujung lintasan = daun lain", padahal daun itu C sendiri
          ...revoked, // salin semua nilai kredensial dicabut
          root: inc.root, // root dari lintasan inklusi
          ctx: session.ctx, // konteks sesi
          path: { siblings: inc.siblings, oldKey: revoked.C, oldValue: 1n, isOld0: 0n }, // lintasan inklusi dengan klaim ujung = daun C sendiri
        });
        expect(await rejects(() => calculateWitness(depth, input))).to.equal(true); // SMTVerifier menolak oldKey = key
      });
    });
  }

  describe("Keputusan 1c: serangan isOld0 non-biner pada SMTVerifier circomlib", function () { // kelompok tes keputusan 1c (celah isOld0)
    /**
     * Menyusun input SERANGAN untuk kredensial yang SUDAH DICABUT.
     *
     * Di dalam SMTVerifier (mode non-inklusi), nilai simpul di ujung lintasan
     * dihitung sebagai (1 − isOld0) · Hash1(oldKey, oldValue). Bila isOld0 boleh
     * bernilai sembarang t, penyerang memilih t sehingga
     *     (1 − t) · Hash1(oldKey, oldValue) = Hash1(C, 1)   (daun C yang asli),
     * yaitu t = 1 − Hash1(C, 1) / Hash1(oldKey, oldValue). Root yang dihitung
     * sirkuit pun sama dengan root asli, padahal C ADA di pohon.
     */
    async function buildAttackInput(tree, cred, ctx) { // menyusun input serangan isOld0
      const inc = await tree.getInclusionPath(cred.C); // lintasan inklusi nyata
      const fakeOldKey = cred.C + 1n; // key lain mana pun, asal != C
      const fakeOldValue = 1n; // value daun palsu
      const realLeaf = await poseidonHash([cred.C, 1n, 1n]); // Hash1(C, 1) = Poseidon(C, 1, 1)
      const fakeLeaf = await poseidonHash([fakeOldKey, fakeOldValue, 1n]); // daun palsu
      const t = (((1n - realLeaf * inv(fakeLeaf)) % FIELD_P) + FIELD_P) % FIELD_P; // isOld0 "ajaib" (bukan 0/1)
      return buildCircuitInput({ // susun input serangan
        ...cred, // salin semua nilai kredensial dicabut
        root: inc.root, // root dari lintasan inklusi
        ctx, // konteks sesi
        path: { siblings: inc.siblings, oldKey: fakeOldKey, oldValue: fakeOldValue, isOld0: t }, // lintasan inklusi dengan isOld0 pilihan penyerang
      });
    }

    let tree; // pohon untuk tes serangan
    let cred; // kredensial yang SUDAH dicabut
    let session; // sesi verifikasi

    beforeEach(async function () { // dijalankan sebelum setiap tes serangan
      tree = await RevocationTree.create(8); // pohon dangkal agar cepat
      cred = await makeRevokedCredential(tree); // kredensial ini SUDAH DICABUT
      session = await makeSession(); // sesi baru
    });

    it("SIRKUIT UTAMA (Algoritma 3.1 persis): kredensial dicabut LOLOS seluruh constraint → celah TERBUKTI, dicatat sebagai keterbatasan", async function () { // tes 15: sirkuit utama dapat ditipu (celah terbukti)
      const input = await buildAttackInput(tree, cred, session.ctx); // input serangan
      const wtns = await calculateWitness(8, input); // sirkuit utama TIDAK menolak
      expect(await checkAllConstraints(circuitPaths(8).r1cs, wtns)).to.equal(true); // semua constraint terpenuhi: bukti palsu mungkin dibuat
    });

    it("VARIAN DIPERBAIKI (+ isOld0 * (isOld0 - 1) === 0): serangan yang sama ditolak", async function () { // tes 16: varian diperbaiki menolak serangan yang sama
      const input = await buildAttackInput(tree, cred, session.ctx); // input serangan yang sama
      expect(await rejects(() => calculateWitness(8, input, DIPERBAIKI.wasm))).to.equal(true); // varian uji menolak
    });
  });
});
