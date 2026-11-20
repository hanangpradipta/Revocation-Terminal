/**
 * fase1-peragaan.js — PERAGAAN FASE 1 di terminal.
 *
 * Menjalankan sirkuit NonRevocation(d) dengan witness yang benar dan yang sengaja salah,
 * lalu mencetak apakah sirkuit menerima atau menolaknya:
 *   1. ukuran sirkuit (jumlah constraint per kedalaman)         Bab III 3.3.3, Tabel 3.9
 *   2. witness SAH: kredensial aktif diterima
 *   3. rahasia s salah → ditolak                                 uji F7
 *   4. C milik kredensial lain → ditolak
 *   5. root palsu → ditolak
 *   6. kredensial DICABUT tidak punya lintasan; lintasan palsu ditolak    uji F4
 *   7. serangan isOld0 non-biner: BERHASIL pada sirkuit utama (keputusan 1c), ditolak pada varian diperbaiki
 *
 * Cara menjalankan:  npm run fase1
 * Semua data fiktif dan acak; angka C, root, ctx berbeda setiap dijalankan.
 */

const fs = require("fs"); // membaca hasil kompilasi (results/fase1-constraints.json)
const path = require("path"); // menyusun alamat berkas
const snarkjs = require("snarkjs"); // wtns.check: memeriksa semua constraint
const common = require("../src/common"); // semua fungsi fondasi + zk fase 1

/** Menyingkat bilangan panjang: 10 digit awal … 6 digit akhir. */
const singkat = (x) => { // fungsi pembantu: memendekkan bilangan panjang
  const s = String(x); // ubah ke teks
  return s.length > 20 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s; // bilangan pendek dicetak utuh
};
const judul = (teks) => console.log(`\n── ${teks} ${"─".repeat(Math.max(0, 70 - teks.length))}`); // judul langkah
const nilai = (nama, isi) => console.log(`   ${nama.padEnd(42)} ${isi}`); // satu pasang nama–isi

/** Menjalankan fungsi sambil menyenyapkan keluaran konsol (sirkuit mencetak "ERROR" saat menolak input). */
async function senyap(fn) { // menjalankan fungsi tanpa keluaran konsol
  const log = console.log, err = console.error; // simpan konsol asli
  console.log = () => {}; // matikan sementara
  console.error = () => {}; // matikan sementara
  try { // jalankan fungsi yang diberikan
    return await fn(); // jalankan
  } finally { // selalu pulihkan konsol, berhasil maupun gagal
    console.log = log; // pulihkan konsol
    console.error = err; // pulihkan konsol
  }
}

/** Mencoba menghitung witness; mengembalikan "DITERIMA" atau "DITOLAK". */
async function coba(depth, input, wasmPath) { // mencoba satu input pada sirkuit
  try { // coba hitung witness
    await senyap(() => common.calculateWitness(depth, input, wasmPath)); // hitung witness; galat bila ada constraint dilanggar
    return "DITERIMA"; // semua constraint terpenuhi
  } catch { // galat berarti sirkuit menolak
    return "DITOLAK"; // sirkuit menolak
  }
}

/** Invers modular di lapangan prima (untuk menyusun input serangan). */
function inv(x) { // invers modular, dipakai menyusun serangan
  const p = common.FIELD_P; // orde lapangan BN254
  let hasil = 1n, dasar = ((x % p) + p) % p, e = p - 2n; // x^(p-2) = x^(-1) mod p
  while (e > 0n) { // perpangkatan cepat
    if (e & 1n) hasil = (hasil * dasar) % p; // kalikan bila bit terendah 1
    dasar = (dasar * dasar) % p; // kuadratkan dasar
    e >>= 1n; // geser eksponen satu bit
  }
  return hasil; // hasil invers
}

async function main() { // fungsi utama: seluruh peragaan
  const ISSUER = "0x1000000000000000000000000000000000000001"; // issuer contoh (fiktif)
  const VERIFIER = "0x00000000000000000000000000000000000000aa"; // verifier contoh (fiktif)
  const hasil = []; // ringkasan akhir: [langkah, hasil nyata, hasil diharapkan]

  // ── Langkah 1 ──────────────────────────────────────────────────────────────
  judul("1. Ukuran sirkuit   [circuits/nonRevocation.circom, Bab III 3.3.3]"); // mencetak judul langkah 1
  const ukuran = JSON.parse(fs.readFileSync(path.join(common.ROOT, "results", "fase1-constraints.json"), "utf8")); // hasil npm run circuit:compile
  for (const r of ukuran.rows) nilai(`d = ${r.depth}`, `${String(r.constraints).padStart(6)} constraint   ${r.publicInputs} input publik, ${r.privateInputs} input privat`); // satu baris per kedalaman
  nilai("selisih per level", ukuran.deltas.map((d) => d.deltaPerLevel).join(" / ") + `   linear? ${ukuran.linear}`); // Persamaan 3.5
  console.log("   ✔ setiap tambahan 1 level pohon menambah tepat 534 constraint: biaya bukti naik linear, bukan eksponensial."); // penjelasan arti langkah 1

  // ── Persiapan umum ─────────────────────────────────────────────────────────
  const issuerId = common.addressToField(ISSUER); // alamat issuer sebagai bilangan
  const tree = await common.RevocationTree.create(32); // pohon d = 32 (konfigurasi utama)
  for (let i = 0; i < 5; i++) { // isi pohon dengan 5 pencabutan acak agar lintasan realistis
    const c = await common.computeCommitment({ credId: common.generateCredId(), issuerId, schemaId: 1n, h: await common.hashSecret(common.generateSecret()) }); // C acak untuk satu pencabutan
    await tree.revoke(c); // sisipkan ke pohon
  }
  const s = common.generateSecret(); // rahasia holder
  const credId = common.generateCredId(); // nomor kredensial
  const C = await common.computeCommitment({ credId, issuerId, schemaId: 1n, h: await common.hashSecret(s) }); // commitment kredensial AKTIF
  const nonce = common.generateNonce(); // nonce sesi
  const ctx = await common.computeContext(nonce, common.addressToField(VERIFIER)); // ctx sesi
  const path32 = await tree.getNonInclusionWitness(C); // lintasan non-inklusi untuk C
  const input = common.buildCircuitInput({ C, root: path32.root, ctx, credId, issuerId, schemaId: 1n, s, path: path32 }); // input sirkuit yang SAH

  // ── Langkah 2 ──────────────────────────────────────────────────────────────
  judul("2. Witness SAH: kredensial aktif   [Constraint 1, 2, 3]"); // mencetak judul langkah 2
  nilai("input publik C", singkat(input.C)); // commitment
  nilai("input publik root", singkat(input.root)); // root pohon
  nilai("input publik ctx", singkat(input.ctx)); // konteks sesi
  nilai("input privat", "credId, issuerId, schemaId, s, 32 siblings, oldKey, oldValue, isOld0"); // tidak dicetak nilainya
  const wtns = await senyap(() => common.calculateWitness(32, input)); // hitung witness
  const semua = await snarkjs.wtns.check(common.circuitPaths(32).r1cs, { type: "mem", data: wtns }); // periksa SEMUA constraint R1CS
  nilai("seluruh constraint R1CS terpenuhi?", String(semua)); // harus true
  hasil.push(["witness sah", semua ? "DITERIMA" : "DITOLAK", "DITERIMA"]); // catat hasil untuk ringkasan akhir
  console.log("   ✔ holder benar-benar mengetahui s, dan C tidak ada di pohon: sirkuit menerimanya."); // penjelasan arti langkah 2

  // ── Langkah 3 ──────────────────────────────────────────────────────────────
  judul("3. Rahasia s salah   [Constraint 1, uji F7]"); // mencetak judul langkah 3
  const salahS = { ...input, s: (s + 1n).toString() }; // s diganti → Poseidon(...) ≠ C
  const r3 = await coba(32, salahS); // coba witness
  nilai("sirkuit", r3); // tampilkan hasil
  hasil.push(["s salah (F7)", r3, "DITOLAK"]); // catat hasil untuk ringkasan akhir
  console.log("   ✔ VC yang dicuri tanpa rahasia s tidak bisa dipakai membuat bukti."); // penjelasan arti langkah 3

  // ── Langkah 4 ──────────────────────────────────────────────────────────────
  judul("4. C milik kredensial lain (meminjam commitment)   [Constraint 1]"); // mencetak judul langkah 4
  const lain = await common.computeCommitment({ credId: common.generateCredId(), issuerId, schemaId: 1n, h: await common.hashSecret(common.generateSecret()) }); // C kredensial lain
  const r4 = await coba(32, { ...input, C: lain.toString() }); // C publik diganti, rahasia tetap milik sendiri
  nilai("sirkuit", r4); // tampilkan hasil
  hasil.push(["C milik orang lain", r4, "DITOLAK"]); // catat hasil untuk ringkasan akhir
  console.log("   ✔ bukti terikat ke C: tidak bisa memakai C kredensial lain."); // penjelasan arti langkah 4

  // ── Langkah 5 ──────────────────────────────────────────────────────────────
  judul("5. Root palsu   [Constraint 2]"); // mencetak judul langkah 5
  const r5 = await coba(32, { ...input, root: (BigInt(input.root) + 1n).toString() }); // root publik diubah
  nilai("sirkuit", r5); // tampilkan hasil
  hasil.push(["root palsu", r5, "DITOLAK"]); // catat hasil untuk ringkasan akhir
  console.log("   ✔ lintasan hanya cocok dengan root yang benar; root karangan ditolak."); // penjelasan arti langkah 5

  // ── Langkah 6 ──────────────────────────────────────────────────────────────
  judul("6. Kredensial DICABUT   [uji F4]"); // mencetak judul langkah 6
  const t8 = await common.RevocationTree.create(8); // pohon d = 8 untuk langkah 6 dan 7
  const cabut = { s: common.generateSecret(), credId: common.generateCredId() }; // kredensial yang akan dicabut
  const Ccabut = await common.computeCommitment({ credId: cabut.credId, issuerId, schemaId: 1n, h: await common.hashSecret(cabut.s) }); // C-nya
  await t8.revoke(Ccabut); // issuer mencabutnya
  let adaLintasan = true; // apakah pohon mau menyusun lintasan?
  try { await t8.getNonInclusionWitness(Ccabut); } catch { adaLintasan = false; } // seharusnya melempar galat
  nilai("lintasan non-inklusi tersedia?", String(adaLintasan)); // harus false
  hasil.push(["dicabut: lintasan jujur", adaLintasan ? "ADA" : "TIDAK ADA", "TIDAK ADA"]); // catat: pohon menolak menyusun lintasan
  const inc = await t8.getInclusionPath(Ccabut); // penyerang memakai lintasan INKLUSI asli
  const ctx8 = await common.computeContext(nonce, common.addressToField(VERIFIER)); // ctx untuk pohon d = 8
  const palsu1 = common.buildCircuitInput({ C: Ccabut, root: inc.root, ctx: ctx8, credId: cabut.credId, issuerId, schemaId: 1n, s: cabut.s, path: { siblings: inc.siblings, oldKey: 0n, oldValue: 0n, isOld0: 1n } }); // mengaku "ujung lintasan kosong"
  const palsu2 = common.buildCircuitInput({ C: Ccabut, root: inc.root, ctx: ctx8, credId: cabut.credId, issuerId, schemaId: 1n, s: cabut.s, path: { siblings: inc.siblings, oldKey: Ccabut, oldValue: 1n, isOld0: 0n } }); // mengaku "ujung lintasan = daun lain" padahal itu C sendiri
  const r6a = await coba(8, palsu1); // coba pemalsuan pertama
  const r6b = await coba(8, palsu2); // coba pemalsuan kedua
  nilai("lintasan inklusi dipalsukan (isOld0 = 1)", r6a); // tampilkan hasil pemalsuan pertama
  nilai("lintasan inklusi dipalsukan (isOld0 = 0)", r6b); // tampilkan hasil pemalsuan kedua
  hasil.push(["pemalsuan isOld0 = 1", r6a, "DITOLAK"], ["pemalsuan isOld0 = 0", r6b, "DITOLAK"]); // catat dua hasil untuk ringkasan akhir
  console.log("   ✔ kredensial yang dicabut tidak bisa menyusun bukti non-inklusi dengan cara-cara sederhana."); // penjelasan arti langkah 6

  // ── Langkah 7 ──────────────────────────────────────────────────────────────
  judul("7. Serangan isOld0 NON-BINER   [keputusan 1c]"); // mencetak judul langkah 7
  const fakeKey = Ccabut + 1n; // key daun palsu
  const daunAsli = await common.poseidonHash([Ccabut, 1n, 1n]); // Hash1(C, 1): daun C yang sesungguhnya
  const daunPalsu = await common.poseidonHash([fakeKey, 1n, 1n]); // Hash1(fakeKey, 1)
  const t = (((1n - daunAsli * inv(daunPalsu)) % common.FIELD_P) + common.FIELD_P) % common.FIELD_P; // isOld0 "ajaib" supaya (1 − t)·daunPalsu = daunAsli
  const serangan = common.buildCircuitInput({ C: Ccabut, root: inc.root, ctx: ctx8, credId: cabut.credId, issuerId, schemaId: 1n, s: cabut.s, path: { siblings: inc.siblings, oldKey: fakeKey, oldValue: 1n, isOld0: t } }); // penyerang memilih isOld0 = t
  nilai("isOld0 yang dipilih penyerang", singkat(t) + "   (bukan 0 dan bukan 1)"); // tampilkan isOld0 pilihan penyerang
  const utama = await coba(8, serangan); // sirkuit utama: Algoritma 3.1 persis
  const diperbaiki = await coba(8, serangan, path.join(common.ROOT, "build", "circuits", "test", "nonRevocationDiperbaiki_js", "nonRevocationDiperbaiki.wasm")); // varian + constraint isOld0 biner
  nilai("SIRKUIT UTAMA (Bab III persis)", `${utama}   ⚠ CELAH`); // hasil pada sirkuit utama
  nilai("varian uji + isOld0·(isOld0−1) = 0", diperbaiki); // hasil pada varian diperbaiki
  hasil.push(["serangan isOld0: sirkuit utama", utama, "DITERIMA (celah 1c)"], ["serangan isOld0: varian diperbaiki", diperbaiki, "DITOLAK"]); // catat dua hasil untuk ringkasan akhir
  console.log("   ⚠ pada sirkuit utama, kredensial yang SUDAH DICABUT lolos. Ini keterbatasan yang Anda putuskan untuk dicatat (keputusan 1c)."); // peringatan: celah keputusan 1c
  console.log("   ✔ satu baris tambahan menutupnya, terbukti pada varian uji. Sirkuit utama sengaja tidak diubah."); // penjelasan: satu baris menutup celah

  // ── Ringkasan ──────────────────────────────────────────────────────────────
  judul("Ringkasan"); // mencetak judul ringkasan
  for (const [nama, nyata, harap] of hasil) console.log(`   ${harap.startsWith(nyata) ? "✅" : "❌"} ${nama.padEnd(36)} ${nyata.padEnd(10)} (diharapkan ${harap})`); // ✅ bila hasil nyata sama dengan awal teks harapan
  console.log("\nSelesai. Fase 2 akan membuat kunci Groth16 agar sirkuit ini bisa menghasilkan bukti sungguhan.\n"); // penutup peragaan
  process.exit(hasil.every(([, n, h]) => h.startsWith(n)) ? 0 : 1); // kode keluar 0 bila semua sesuai
}

main().catch((e) => { // galat tak terduga → tampilkan dan keluar dengan kode 1
  console.error(e); // tampilkan galat
  process.exit(1); // keluar dengan kode gagal
});
