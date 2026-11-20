/**
 * 00-fondasi.js — PERAGAAN FASE 0 di terminal.
 *
 * Menjalankan fungsi-fungsi fondasi satu per satu dan mencetak apa yang dihitung,
 * supaya Anda bisa melihat dengan mata sendiri:
 *   1. rahasia s dan h = Poseidon(s)            (BPS-1 langkah 1–2)
 *   2. credId dan commitment C                  (BPS-1 langkah 3–4, Persamaan 3.1)
 *   3. holder menghitung ulang C                (BPS-1 langkah 7)
 *   4. mengubah satu masukan mengubah C
 *   5. nonce dan ctx                            (BPS-3, Persamaan 3.3)
 *   6. pohon pencabutan + daun genesis          (BPS-4, keputusan 1a)
 *   7. lintasan non-inklusi                     (BPS-2)
 *
 * Cara menjalankan:  npm run fase0
 * Semua data fiktif dan acak; hasil angkanya berbeda setiap dijalankan.
 * Catatan: pada aplikasi sebenarnya (fase 4 dst.) rahasia s TIDAK PERNAH dicetak.
 * Di sini ia dicetak (disingkat) hanya karena ini peragaan belajar dengan data fiktif.
 */

const common = require("../src/common"); // semua fungsi fondasi dari src/common/index.js
const { newMemEmptyTrie } = require("circomlibjs"); // pohon kosong asli circomlib, untuk membandingkan dengan keputusan 1a

/** Menyingkat bilangan panjang: 10 digit awal … 6 digit akhir. */
const singkat = (x) => {  // fungsi pembantu: memendekkan bilangan panjang agar mudah dibaca
  const s = String(x); // ubah ke teks
  return s.length > 20 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s; // bilangan pendek dicetak utuh
};

/** Mencetak judul langkah dengan garis pemisah. */
const judul = (teks) => console.log(`\n── ${teks} ${"─".repeat(Math.max(0, 70 - teks.length))}`);  // mencetak judul langkah beserta garis pemisah

/** Mencetak satu nilai: nama rata kiri, lalu isinya. */
const nilai = (nama, isi) => console.log(`   ${nama.padEnd(24)} ${isi}`);  // mencetak satu pasang nama dan isi dengan rata kiri

async function main() {  // fungsi utama: seluruh peragaan ada di sini
  const ISSUER = "0x1000000000000000000000000000000000000001"; // alamat issuer contoh (fiktif)
  const VERIFIER_A = "0x00000000000000000000000000000000000000aa"; // verifier A (fiktif)
  const VERIFIER_B = "0x00000000000000000000000000000000000000bb"; // verifier B (fiktif)

  // ── Langkah 1 ──────────────────────────────────────────────────────────────
  judul("1. Rahasia holder s dan h = Poseidon(s)   [field.js, commitment.js, poseidon.js]");  // mencetak judul langkah 1
  const s = common.generateSecret(); // holder membuat rahasia acak 248 bit
  const h = await common.hashSecret(s); // holder menghitung h = Poseidon(s)
  nilai("s (rahasia holder)", `${singkat(s)}   < 2^248 ? ${s < 2n ** 248n}`);  // s harus < 2^248 (pasti di dalam lapangan BN254)
  nilai("h = Poseidon(s)", singkat(h));  // h hasil hash Poseidon dari s
  nilai("batas lapangan BN254", `${singkat(common.FIELD_P)}   h < batas ? ${h < common.FIELD_P}`);  // h juga harus < batas lapangan
  console.log("   ✔ hanya h yang nanti dikirim ke issuer; dari h tidak bisa kembali ke s (hash satu arah).");  // penjelasan arti langkah 1

  // ── Langkah 2 ──────────────────────────────────────────────────────────────
  judul("2. credId dan commitment C = Poseidon(credId, issuerId, schemaId, h)   [Persamaan 3.1]");  // mencetak judul langkah 2
  const credId = common.generateCredId(); // issuer membuat nomor kredensial acak
  const issuerId = common.addressToField(ISSUER); // alamat issuer dijadikan bilangan
  const schemaId = 1n; // 1 = ijazah
  const C = await common.computeCommitment({ credId, issuerId, schemaId, h }); // issuer menghitung C
  nilai("credId", singkat(credId));  // credId yang dipakai
  nilai("issuerId", `${ISSUER}  →  ${singkat(issuerId)}`);  // alamat issuer dan bentuk bilangannya
  nilai("schemaId", String(schemaId));  // jenis kredensial (1 = ijazah)
  nilai("C", singkat(C));  // commitment C hasil Persamaan 3.1

  // ── Langkah 3 ──────────────────────────────────────────────────────────────
  judul("3. Holder menghitung ulang C dari s miliknya sendiri   [BPS-1 langkah 7]");  // mencetak judul langkah 3
  const C2 = await common.computeCommitment({ credId, issuerId, schemaId, h: await common.hashSecret(s) }); // holder hitung ulang
  nilai("C dari issuer", singkat(C));  // C yang dibuat issuer
  nilai("C hitungan holder", singkat(C2));  // C yang dihitung ulang holder
  nilai("sama?", String(C === C2));  // harus true bila rahasia holder cocok
  console.log("   ✔ bila tidak sama, holder menolak VC (rahasianya tidak cocok).");  // penjelasan arti langkah 3

  // ── Langkah 4 ──────────────────────────────────────────────────────────────
  judul("4. Mengubah SATU masukan saja mengubah C sepenuhnya");  // mencetak judul langkah 4
  const Cberbeda = await common.computeCommitment({ credId: credId + 1n, issuerId, schemaId, h }); // credId + 1
  nilai("C (credId + 1)", singkat(Cberbeda));  // C bila credId diganti
  nilai("sama dengan C asli?", String(Cberbeda === C));  // harus false: C berubah total
  console.log("   ✔ C mengikat keempat masukannya sekaligus.");  // penjelasan arti langkah 4

  // ── Langkah 5 ──────────────────────────────────────────────────────────────
  judul("5. nonce dan ctx = Poseidon(nonce, verifierId)   [context.js, Persamaan 3.3]");  // mencetak judul langkah 5
  const nonce = common.generateNonce(); // verifier membuat nonce sesi
  const ctxA = await common.computeContext(nonce, common.addressToField(VERIFIER_A)); // ctx untuk verifier A
  const ctxB = await common.computeContext(nonce, common.addressToField(VERIFIER_B)); // ctx untuk verifier B, nonce sama
  const ctxBaru = await common.computeContext(common.generateNonce(), common.addressToField(VERIFIER_A)); // ctx sesi lain di verifier A
  nilai("ctx (verifier A)", singkat(ctxA));  // ctx untuk verifier A
  nilai("ctx (verifier B)", `${singkat(ctxB)}   sama dengan A? ${ctxB === ctxA}`);  // ctx untuk verifier B harus berbeda
  nilai("ctx (sesi baru, A)", `${singkat(ctxBaru)}   sama dengan A? ${ctxBaru === ctxA}`);  // ctx untuk sesi baru harus berbeda
  console.log("   ✔ bukti yang terikat ke ctx tidak bisa dipakai di verifier lain (F5) atau sesi lain (F6).");  // penjelasan arti langkah 5

  // ── Langkah 6 ──────────────────────────────────────────────────────────────
  judul("6. Pohon pencabutan dan daun genesis   [revocationTree.js, keputusan 1a]");  // mencetak judul langkah 6
  const kosong = await newMemEmptyTrie(); // pohon kosong asli circomlib
  nilai("root pohon kosong circomlib", String(kosong.F.toObject(kosong.root)));  // root pohon kosong circomlib adalah 0
  const tree = await common.RevocationTree.create(32); // pohon kita: sudah berisi daun genesis
  const rootAwal = tree.root; // root sebelum ada pencabutan
  nilai("root pohon kita (genesis)", singkat(rootAwal));  // root pohon kita tidak 0 karena ada daun genesis
  console.log("   ✔ root 0 akan ditolak kontrak (fase 3), maka pohon diberi daun genesis agar root ≠ 0.");  // penjelasan alasan keputusan 1a
  nilai("C sudah dicabut?", String(await tree.isRevoked(C)));  // sebelum dicabut: false
  await tree.revoke(C); // issuer mencabut kredensial ini
  nilai("setelah revoke(C)", `root berubah? ${tree.root !== rootAwal}   dicabut? ${await tree.isRevoked(C)}`);  // setelah dicabut: root berubah dan isRevoked true
  nilai("revoke(C) lagi", `mengembalikan ${await tree.revoke(C)} (sudah ada, tidak terjadi apa-apa)`);  // mencabut dua kali: kedua kalinya mengembalikan false

  // ── Langkah 7 ──────────────────────────────────────────────────────────────
  judul("7. Lintasan non-inklusi   [BPS-2, bahan sirkuit fase 1]");  // mencetak judul langkah 7
  const lain = await common.computeCommitment({ credId: common.generateCredId(), issuerId, schemaId, h }); // C kredensial lain yang belum dicabut
  const w = await tree.getNonInclusionWitness(lain); // lintasan untuk C yang BELUM dicabut
  nilai("jumlah siblings", `${w.siblings.length} (= kedalaman pohon)`);  // jumlah siblings = kedalaman pohon (32)
  nilai("siblings bukan nol", String(w.siblings.filter((x) => x !== 0n).length));  // hanya sedikit sibling yang bukan nol karena pohon hampir kosong
  nilai("isOld0", `${w.isOld0}  (1 = ujung lintasan kosong, 0 = ujung lintasan daun lain)`);  // jenis ujung lintasan
  nilai("root lintasan = root pohon", String(w.root === tree.root));  // lintasan dibuat untuk root pohon saat ini
  try {  // coba minta lintasan untuk C yang SUDAH dicabut
    await tree.getNonInclusionWitness(C); // C yang SUDAH dicabut
    nilai("lintasan untuk C dicabut", "ADA (tidak diharapkan!)");  // jika sampai di sini, ada yang salah
  } catch (e) {  // galat adalah hasil yang diharapkan
    nilai("lintasan untuk C dicabut", `TIDAK ADA → "${e.message}"`);  // tampilkan pesan galatnya
  }
  console.log("   ✔ inilah dasar uji F4: kredensial yang dicabut tidak bisa membuktikan non-inklusi.");  // penjelasan arti langkah 7

  console.log("\nSelesai. Semua langkah di atas dijalankan oleh fungsi di src/common/.\n");  // penutup peragaan
  process.exit(0); // keluar eksplisit agar proses tidak menunggu sisa pekerjaan latar belakang
}

main().catch((e) => { // galat tak terduga → tampilkan dan keluar dengan kode 1
  console.error(e);  // tampilkan galat
  process.exit(1);  // keluar dengan kode gagal
});
