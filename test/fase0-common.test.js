/**
 * fase0-common.test.js — Tes FASE 0: modul bersama (src/common).
 *
 * Memastikan fondasi yang dipakai semua komponen sudah benar:
 *   - bilangan acak dan konversi alamat berada di lapangan prima BN254,
 *   - Poseidon, commitment C (Persamaan 3.1), dan ctx (Persamaan 3.3) konsisten,
 *   - pohon pencabutan + daun genesis (keputusan 1a) berperilaku sesuai Bab III 3.3.2.
 *
 * Cara membaca tes (Mocha + Chai):
 *   describe("…")  = kelompok tes
 *   it("…")        = satu tes; kalimatnya menyatakan perilaku yang dibuktikan
 *   expect(a).to.equal(b) = tes GAGAL bila a ≠ b
 *
 * Jalankan:  npm run test:fase0
 */

const { expect } = require("chai"); // pustaka pernyataan (assertion)
const { newMemEmptyTrie } = require("circomlibjs"); // pohon kosong asli circomlib (pembanding keputusan 1a)
const {  // fungsi yang diuji, semuanya dari src/common
  FIELD_P,  // orde lapangan prima BN254
  randomFieldElement,  // bilangan acak 248 bit
  addressToField,  // alamat → bilangan
  poseidonHash,  // hash Poseidon
  hashSecret,  // h = Poseidon(s)
  computeCommitment,  // C = Poseidon(credId, issuerId, schemaId, h)
  computeContext,  // ctx = Poseidon(nonce, verifierId)
  RevocationTree,  // pohon pencabutan
  getGenesisKey,  // key daun genesis
} = require("../src/common");  // semua diambil dari pintu masuk src/common/index.js
const { makeCredential, ISSUER_1, ISSUER_2, VERIFIER_A, VERIFIER_B } = require("./helpers/fixtures"); // pembantu tes

describe("FASE 0 — Modul bersama", function () {  // kelompok tes terbesar: seluruh fase 0
  describe("field.js: bilangan acak dan alamat", function () {  // kelompok tes untuk field.js
    it("randomFieldElement menghasilkan bilangan < 2^248 (selalu di lapangan BN254) dan tidak berulang", function () {  // tes 1: bilangan acak selalu sah dan tidak berulang
      const seen = new Set(); // menampung semua nilai untuk cek keunikan
      for (let i = 0; i < 200; i++) { // ambil 200 bilangan acak
        const x = randomFieldElement();  // ambil satu bilangan acak
        expect(x < 2n ** 248n).to.equal(true); // ≤ 248 bit
        expect(x < FIELD_P).to.equal(true); // elemen lapangan yang sah
        seen.add(x);  // catat ke himpunan untuk cek keunikan
      }
      expect(seen.size).to.equal(200); // tidak ada yang kembar
    });

    it("addressToField mengubah alamat Ethereum menjadi bilangan 160 bit", function () {  // tes 2: alamat → bilangan 160 bit
      expect(addressToField(ISSUER_1)).to.equal(BigInt(ISSUER_1)); // nilainya sama dengan alamat dibaca sebagai bilangan
      expect(addressToField(ISSUER_1) < 2n ** 160n).to.equal(true); // alamat = 20 byte = 160 bit
    });

    it("addressToField menolak alamat yang formatnya salah", function () {  // tes 3: alamat salah harus ditolak
      expect(() => addressToField("0x1234")).to.throw(); // terlalu pendek → galat
    });
  });

  describe("poseidon.js dan commitment.js: C = Poseidon(credId, issuerId, schemaId, Poseidon(s))", function () {  // kelompok tes untuk poseidon.js dan commitment.js
    it("Poseidon deterministik: masukan sama -> hasil sama", async function () {  // tes 4: Poseidon deterministik
      expect(await poseidonHash([1n, 2n])).to.equal(await poseidonHash([1n, 2n])); // sama → sama
      expect(await poseidonHash([1n, 2n])).to.not.equal(await poseidonHash([2n, 1n])); // urutan berbeda → hasil berbeda
    });

    it("Poseidon menolak masukan di luar lapangan prima", async function () {  // tes 5: masukan di luar lapangan harus ditolak
      let err = null;  // akan menampung galat yang terjadi
      try {  // coba hitung Poseidon dengan masukan tidak sah
        await poseidonHash([FIELD_P]); // FIELD_P sendiri sudah di luar lapangan
      } catch (e) {  // tangkap galatnya
        err = e;  // simpan galat untuk diperiksa
      }
      expect(err).to.be.instanceOf(RangeError); // harus ditolak
    });

    it("C dapat dihitung ulang holder dari s (BPS-1 langkah 7) dan hasilnya sama", async function () {  // tes 6: holder bisa menghitung ulang C
      const cred = await makeCredential(); // C dihitung "issuer"
      const again = await computeCommitment({ // C dihitung ulang "holder" dari s
        credId: cred.credId,  // credId sama dengan milik issuer
        issuerId: cred.issuerId,  // issuerId sama
        schemaId: cred.schemaId,  // schemaId sama
        h: await hashSecret(cred.s),  // h dihitung dari s milik holder
      });
      expect(again).to.equal(cred.C);  // hasilnya harus sama dengan C awal
    });

    it("mengubah SATU saja dari credId, issuerId, schemaId, atau s mengubah C", async function () {  // tes 7: mengubah satu masukan mengubah C
      const c = await makeCredential();  // buat kredensial acuan
      const base = { credId: c.credId, issuerId: c.issuerId, schemaId: c.schemaId, h: c.h };  // masukan dasar yang akan diubah satu per satu
      const variants = [ // empat variasi, masing-masing mengubah satu masukan
        { ...base, credId: c.credId + 1n },  // variasi 1: credId + 1
        { ...base, issuerId: addressToField(ISSUER_2) },  // variasi 2: issuer lain
        { ...base, schemaId: 2n },  // variasi 3: schemaId lain
        { ...base, h: await hashSecret(c.s + 1n) },  // variasi 4: rahasia s lain
      ];
      for (const v of variants) {  // periksa setiap variasi
        expect(await computeCommitment(v)).to.not.equal(c.C); // setiap perubahan menghasilkan C lain
      }
    });

    it("rahasia s berbeda per kredensial -> Poseidon(s) berbeda (dua issuer tidak dapat menautkan holder)", async function () {  // tes 8: s berbeda per kredensial → h berbeda
      const ijazah = await makeCredential(ISSUER_1, 1n);  // kredensial ijazah
      const sertifikat = await makeCredential(ISSUER_2, 2n);  // kredensial sertifikat
      expect(ijazah.h).to.not.equal(sertifikat.h); // h berbeda → issuer 1 dan 2 tidak bisa mencocokkan holder
    });
  });

  describe("context.js: ctx = Poseidon(nonce, verifierId)", function () {  // kelompok tes untuk context.js
    it("nonce berbeda atau verifier berbeda menghasilkan ctx berbeda", async function () {  // tes 9: ctx bergantung pada nonce dan verifierId
      const a = addressToField(VERIFIER_A);  // verifier A sebagai bilangan
      const b = addressToField(VERIFIER_B);  // verifier B sebagai bilangan
      const ctx = await computeContext(10n, a); // ctx acuan
      expect(await computeContext(10n, a)).to.equal(ctx); // sama persis → ctx sama
      expect(await computeContext(11n, a)).to.not.equal(ctx); // sesi lain (F6)
      expect(await computeContext(10n, b)).to.not.equal(ctx); // verifier lain (F5)
    });
  });

  describe("revocationTree.js: pohon pencabutan dan daun genesis (keputusan 1a)", function () {  // kelompok tes untuk revocationTree.js
    it("ALASAN keputusan 1a: root Sparse Merkle Tree kosong di circomlib bernilai 0", async function () {  // tes 10: alasan keputusan 1a
      const empty = await newMemEmptyTrie();  // pohon kosong asli circomlib
      expect(empty.F.toObject(empty.root)).to.equal(0n); // root 0 akan ditolak kontrak
    });

    it("pohon baru langsung berisi daun genesis sehingga root != 0", async function () {  // tes 11: pohon baru berisi daun genesis
      const tree = await RevocationTree.create(32);  // buat pohon kedalaman 32
      expect(tree.root).to.not.equal(0n);  // root tidak boleh 0
      expect(await tree.isRevoked(await getGenesisKey())).to.equal(true); // daun genesis memang ada
    });

    it("hanya kedalaman 8, 16, 24, 32 yang diizinkan", async function () {  // tes 12: hanya kedalaman 8/16/24/32
      let err = null;  // akan menampung galat
      try {  // coba buat pohon kedalaman tidak sah
        await RevocationTree.create(10); // kedalaman tanpa sirkuit
      } catch (e) {  // tangkap galatnya
        err = e;  // simpan galat
      }
      expect(err).to.be.instanceOf(RangeError);  // harus RangeError
    });

    it("mencabut kredensial mengubah root; mencabut ulang tidak mengubah apa pun", async function () {  // tes 13: revoke mengubah root, revoke ulang tidak
      const tree = await RevocationTree.create(32);  // pohon baru
      const cred = await makeCredential();  // kredensial yang akan dicabut
      const before = tree.root;  // root sebelum dicabut
      expect(await tree.revoke(cred.C)).to.equal(true); // pencabutan pertama berhasil
      const after = tree.root;  // root sesudah dicabut
      expect(after).to.not.equal(before); // root berubah
      expect(await tree.isRevoked(cred.C)).to.equal(true);  // sekarang C tercatat dicabut
      expect(await tree.revoke(cred.C)).to.equal(false); // pencabutan kedua diabaikan
      expect(tree.root).to.equal(after); // root tidak berubah lagi
    });

    it("lintasan non-inklusi tersedia untuk kredensial aktif dan panjang sibling = d", async function () {  // tes 14: lintasan non-inklusi untuk kredensial aktif
      const tree = await RevocationTree.create(16);  // pohon kedalaman 16
      const cred = await makeCredential();  // kredensial aktif
      const w = await tree.getNonInclusionWitness(cred.C);  // minta lintasan non-inklusi
      expect(w.siblings).to.have.length(16); // tepat d sibling
      expect([0n, 1n]).to.include(w.isOld0); // isOld0 biner
      expect(w.root).to.equal(tree.root); // lintasan untuk root saat ini
    });

    it("lintasan non-inklusi TIDAK tersedia untuk kredensial yang sudah dicabut", async function () {  // tes 15: tidak ada lintasan untuk kredensial dicabut
      const tree = await RevocationTree.create(32);  // pohon baru
      const cred = await makeCredential();  // kredensial
      await tree.revoke(cred.C);  // cabut kredensial
      let err = null;  // akan menampung galat
      try {  // coba minta lintasan
        await tree.getNonInclusionWitness(cred.C); // harus gagal (F4)
      } catch (e) {  // tangkap galatnya
        err = e;  // simpan galat
      }
      expect(err).to.not.equal(null);  // galat harus terjadi
    });

    it("100 pencabutan pada d = 32 tidak menimbulkan tumbukan posisi daun (Bab III 3.3.2)", async function () {  // tes 16: 100 pencabutan tanpa tumbukan
      const tree = await RevocationTree.create(32);  // pohon baru
      for (let i = 0; i < 100; i++) {  // ulangi 100 kali
        const cred = await makeCredential();  // kredensial acak baru
        expect(await tree.revoke(cred.C)).to.equal(true); // setiap pencabutan berhasil
      }
    });
  });
});
