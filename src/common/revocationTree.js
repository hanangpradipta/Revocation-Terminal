/**
 * revocationTree.js — Pohon pencabutan (Sparse Merkle Tree berbasis Poseidon).
 *
 * Rujukan: Bab III 3.3.2.
 *   - Pohon HANYA memuat kredensial yang dicabut: daun dengan key = C, value = 1.
 *   - Posisi daun ditentukan oleh bit-bit C.
 *   - Isi pohon disimpan privat oleh issuer; yang dipublikasikan hanya root-nya.
 *
 * Keputusan 1a (daun genesis):
 *   Root pohon kosong di circomlib bernilai 0, padahal kontrak Registry menolak
 *   root 0 (Algoritma 3.2 baris 4). Karena itu saat pohon dibuat, issuer langsung
 *   menyisipkan satu daun "genesis" dengan key tetap GENESIS_KEY. Daun ini BUKAN
 *   kredensial siapa pun; gunanya hanya membuat root tidak pernah 0.
 *
 * Batas kedalaman:
 *   Template SMTLevIns di circomlib mensyaratkan sibling pada level terakhir
 *   bernilai 0. Akibatnya sebuah daun hanya dapat dibuktikan bila lintasannya
 *   memiliki kurang dari d sibling. Pencabutan yang membuat lintasan sedalam d
 *   atau lebih diperlakukan sebagai "tumbukan posisi daun" (Bab III 3.3.2) dan ditolak.
 *
 * Istilah:
 *   root      = satu nilai hash yang mewakili SELURUH isi pohon; isi berubah → root berubah
 *   sibling   = simpul "saudara" di setiap tingkat lintasan dari daun ke root
 *   non-inklusi = bukti bahwa sebuah key TIDAK ada di pohon
 */

const { newMemEmptyTrie } = require("circomlibjs"); // implementasi Sparse Merkle Tree milik iden3 (cocok dengan sirkuit SMTVerifier)
const { poseidonHash } = require("./poseidon"); // dipakai menghitung key daun genesis
const { assertField } = require("./field"); // pemeriksa elemen lapangan

/** Nilai daun untuk kredensial yang dicabut (Bab III 3.3.2: value = 1). */
const REVOKED_VALUE = 1n; // value daun untuk kredensial yang dicabut

/**
 * Teks sumber key daun genesis. GENESIS_KEY = Poseidon(bilangan dari teks ini).
 * Hasilnya konstanta publik yang sama untuk semua issuer dan tidak mungkin
 * sama dengan commitment C kredensial nyata kecuali dengan peluang yang dapat
 * diabaikan (setara peluang tumbukan Persamaan 3.2).
 */
const GENESIS_LABEL = "revocation-blockchain.v1/genesis"; // teks tetap sumber key daun genesis

let genesisKeyCache = null; // null = belum dihitung

/**
 * Menghitung (sekali saja) key daun genesis.
 * @returns {Promise<bigint>} GENESIS_KEY
 */
async function getGenesisKey() { // menghitung key daun genesis sekali saja
  if (genesisKeyCache === null) { // pemanggilan pertama
    // Ubah teks menjadi bilangan (32 byte pertama dari hex-nya), lalu hash.
    const asNumber = BigInt("0x" + Buffer.from(GENESIS_LABEL).toString("hex").slice(0, 62)); // 62 karakter hex = 31 byte (pasti < FIELD_P)
    genesisKeyCache = await poseidonHash([asNumber]); // key genesis = Poseidon(teks sebagai bilangan)
  }
  return genesisKeyCache; // pemanggilan berikutnya memakai nilai tersimpan
}

/**
 * Pohon pencabutan milik SATU issuer.
 * Dipakai oleh layanan issuer (fase 4) dan oleh tes (fase 0, 1, 3).
 */
class RevocationTree { // pohon pencabutan milik satu issuer
  /**
   * Jangan dipanggil langsung; gunakan RevocationTree.create(depth).
   * @param {object} smt   instance Sparse Merkle Tree dari circomlibjs
   * @param {number} depth kedalaman d yang dipakai sirkuit (8, 16, 24, atau 32)
   */
  constructor(smt, depth) { // dipanggil oleh RevocationTree.create
    this.smt = smt; // pohon yang sebenarnya (disimpan di memori issuer)
    this.F = smt.F; // objek lapangan prima: mengubah nilai internal ↔ BigInt
    this.depth = depth; // kedalaman maksimum yang didukung sirkuit
  }

  /**
   * Membuat pohon pencabutan baru yang sudah berisi daun genesis (keputusan 1a).
   * Dipakai pada: inisialisasi issuer (prasyarat BPS-1).
   * @param {number} depth kedalaman pohon d
   * @returns {Promise<RevocationTree>}
   */
  static async create(depth = 32) { // cara membuat pohon baru yang benar
    if (![8, 16, 24, 32].includes(depth)) { // hanya kedalaman yang punya sirkuit & kunci
      throw new RangeError("Kedalaman pohon yang diuji hanya 8, 16, 24, atau 32 (Bab III 3.3.2)"); // galat bila kedalaman tidak didukung
    }
    const smt = await newMemEmptyTrie(); // pohon kosong (root = 0)
    const tree = new RevocationTree(smt, depth); // bungkus dengan kelas ini
    await smt.insert(await getGenesisKey(), REVOKED_VALUE); // sisipkan daun genesis → root ≠ 0 (keputusan 1a)
    return tree; // pohon siap dipakai, sudah berisi daun genesis
  }

  /**
   * Root pohon saat ini sebagai bigint. Nilai inilah yang dikirim issuer ke
   * kontrak lewat updateRoot(r) (BPS-4 langkah 4).
   * @returns {bigint}
   */
  get root() { // root saat ini sebagai bigint
    return this.F.toObject(this.smt.root); // representasi internal → BigInt
  }

  /**
   * Memeriksa apakah commitment C ada di pohon (sudah dicabut).
   * @param {bigint} C commitment kredensial
   * @returns {Promise<boolean>}
   */
  async isRevoked(C) { // cek apakah C ada di pohon
    const res = await this.smt.find(assertField(C, "C")); // telusuri pohon mengikuti bit-bit C
    return res.found; // true = C ada di pohon = sudah dicabut
  }

  /**
   * Mencabut kredensial: menyisipkan daun key = C, value = 1 (BPS-4 langkah 2).
   * Bila C sudah ada, tidak terjadi apa-apa dan fungsi mengembalikan false.
   * Bila penyisipan membuat lintasan terlalu dalam (tumbukan posisi daun),
   * penyisipan dibatalkan dan fungsi melempar galat.
   *
   * @param {bigint} C commitment kredensial yang dicabut
   * @returns {Promise<boolean>} true bila C baru saja disisipkan
   */
  async revoke(C) { // mencabut kredensial (menyisipkan daun)
    assertField(C, "C"); // C harus elemen lapangan
    if (await this.isRevoked(C)) return false; // sudah dicabut sebelumnya: tidak perlu apa-apa
    await this.smt.insert(C, REVOKED_VALUE); // sisipkan daun (key = C, value = 1); root berubah
    const after = await this.smt.find(C); // periksa kedalaman lintasan daun baru
    if (after.siblings.length >= this.depth) { // terlalu dalam untuk sirkuit kedalaman d
      await this.smt.delete(C); // batalkan agar pohon kembali seperti semula
      throw new Error( // batalkan penyisipan dengan galat yang jelas
        `Tumbukan posisi daun: commitment ini berbagi ${after.siblings.length} bit awal ` + // pesan galat bagian 1
          `dengan daun lain, melebihi kapasitas pohon kedalaman ${this.depth} (Bab III 3.3.2)` // pesan galat bagian 2
      );
    }
    return true; // berhasil dicabut
  }

  /**
   * Menyusun data lintasan non-inklusi untuk commitment C. Data ini adalah
   * witness privat sirkuit (Algoritma 3.1): siblings[d], oldKey, oldValue, isOld0.
   * Dipakai pada: BPS-2 langkah 3 (issuer melayani lintasan untuk holder).
   *
   * @param {bigint} C commitment kredensial
   * @returns {Promise<{root: bigint, siblings: bigint[], oldKey: bigint, oldValue: bigint, isOld0: bigint}>}
   * @throws bila C sudah dicabut (tidak ada lintasan non-inklusi)
   */
  async getNonInclusionWitness(C) { // menyusun lintasan non-inklusi
    const res = await this.smt.find(assertField(C, "C")); // telusuri pohon ke posisi C
    if (res.found) { // C ADA di pohon ...
      throw new Error("Kredensial sudah dicabut: lintasan non-inklusi tidak ada"); // ... maka mustahil membuktikan C TIDAK ada (F4)
    }
    if (res.siblings.length >= this.depth) { // lintasan lebih dalam dari kemampuan sirkuit
      throw new Error("Lintasan melebihi kedalaman pohon"); // galat bila lintasan terlalu dalam
    }
    // Ubah sibling ke bigint lalu lengkapi dengan 0 sampai panjangnya tepat d.
    const siblings = res.siblings.map((x) => this.F.toObject(x)); // sibling yang benar-benar ada
    while (siblings.length < this.depth) siblings.push(0n); // sirkuit selalu meminta tepat d sibling

    // isOld0 = 1 berarti lintasan berakhir di posisi kosong; = 0 berarti
    // berakhir di daun lain (oldKey, oldValue) yang berbeda dari C.
    return { // data lintasan untuk sirkuit
      root: this.root, // root saat lintasan dibuat (harus sama dengan root di Registry)
      siblings, // d simpul saudara
      oldKey: res.isOld0 ? 0n : this.F.toObject(res.notFoundKey), // key daun lain yang menempati jalur C (bila ada)
      oldValue: res.isOld0 ? 0n : this.F.toObject(res.notFoundValue), // value daun tersebut
      isOld0: res.isOld0 ? 1n : 0n, // jenis ujung lintasan
    };
  }

  /**
   * Menyusun lintasan INKLUSI untuk C yang sudah dicabut. Hanya dipakai oleh
   * tes keamanan (fase 1) untuk mensimulasikan penyerang yang mencoba memalsukan
   * bukti non-inklusi dari lintasan inklusi yang nyata.
   * @param {bigint} C commitment yang sudah dicabut
   * @returns {Promise<{root: bigint, siblings: bigint[]}>}
   */
  async getInclusionPath(C) { // lintasan inklusi (hanya untuk tes keamanan)
    const res = await this.smt.find(assertField(C, "C")); // telusuri ke posisi C
    if (!res.found) throw new Error("C belum dicabut"); // hanya untuk C yang ADA di pohon
    const siblings = res.siblings.map((x) => this.F.toObject(x)); // sibling lintasan inklusi
    while (siblings.length < this.depth) siblings.push(0n); // lengkapi sampai d
    return { root: this.root, siblings }; // bahan "serangan" di tes fase 1
  }
}

module.exports = { RevocationTree, getGenesisKey, REVOKED_VALUE, GENESIS_LABEL }; // nilai/fungsi yang boleh dipakai file lain
