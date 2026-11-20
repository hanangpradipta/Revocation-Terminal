pragma circom 2.1.9;

// =============================================================================
// nonRevocation.circom — Sirkuit bukti non-revocation (Bab III 3.3.3, Algoritma 3.1)
//
// Pernyataan yang dibuktikan holder TANPA membuka witness privatnya:
//   "Saya mengetahui credId, issuerId, schemaId, dan rahasia s sedemikian
//    sehingga Poseidon(credId, issuerId, schemaId, Poseidon(s)) = C, dan C TIDAK
//    terdapat di pohon pencabutan yang root-nya = root. Bukti ini dibuat untuk
//    konteks sesi ctx."
//
// Public input  : C, root, ctx                      (dilihat verifier)
// Witness privat: credId, issuerId, schemaId, s,
//                 siblings[d], oldKey, oldValue, isOld0   (hanya holder)
//
// CATATAN KEPUTUSAN 1c (dipilih peneliti): sirkuit ini mengikuti Algoritma 3.1 PERSIS,
// tanpa constraint tambahan pada isOld0. Template SMTVerifier milik circomlib tidak
// membatasi isOld0 hanya bernilai 0 atau 1, sehingga kredensial yang SUDAH DICABUT dapat
// menyusun bukti non-inklusi palsu. Celah ini DIBUKTIKAN oleh test/fase1-circuit.test.js
// dan dicatat sebagai keterbatasan. Perbaikannya satu baris (lihat circuits/test/
// nonRevocationDiperbaiki.circom): isOld0 * (isOld0 - 1) === 0.
// =============================================================================

// Template dari circomlib (tidak ditulis ulang, dipakai apa adanya):
include "circomlib/circuits/poseidon.circom";          // fungsi hash Poseidon
include "circomlib/circuits/smt/smtverifier.circom";   // verifikasi Sparse Merkle Tree

template NonRevocation(nLevels) {
    // ---------------- Public input ----------------
    signal input C;      // commitment kredensial, tercantum di credentialStatus VC
    signal input root;   // root pohon pencabutan issuer (harus ada di jendela Registry)
    signal input ctx;    // Poseidon(nonce, verifierId), mengikat bukti ke satu sesi

    // ---------------- Witness privat: atribut + rahasia ----------------
    signal input credId;    // nomor acak kredensial
    signal input issuerId;  // alamat Ethereum issuer sebagai bilangan
    signal input schemaId;  // jenis kredensial (1 = ijazah, 2 = sertifikat)
    signal input s;         // rahasia holder; hanya holder yang mengetahuinya

    // ---------------- Witness privat: lintasan non-inklusi ----------------
    signal input siblings[nLevels]; // simpul saudara di sepanjang lintasan
    signal input oldKey;            // key daun lain yang ditemui di ujung lintasan (bila ada)
    signal input oldValue;          // value daun lain tersebut
    signal input isOld0;            // 1 = ujung lintasan kosong; 0 = ujung lintasan daun lain

    // =========================================================================
    // Constraint 1 (Algoritma 3.1 baris 1-3): hitung ulang C dari atribut dan s.
    // Mencegah holder "meminjam" bukti kredensial lain dan mencegah kesalahan
    // under-constrained (Bab II 2.1.8). Tanpa s yang benar, constraint ini gagal (F7).
    // =========================================================================
    component hashS = Poseidon(1);
    hashS.inputs[0] <== s;                 // h = Poseidon(s)

    component hashC = Poseidon(4);
    hashC.inputs[0] <== credId;
    hashC.inputs[1] <== issuerId;
    hashC.inputs[2] <== schemaId;
    hashC.inputs[3] <== hashS.out;         // C' = Poseidon(credId, issuerId, schemaId, h)

    hashC.out === C;                       // C' harus sama dengan C publik

    // =========================================================================
    // Constraint 2 (Algoritma 3.1 baris 4-6): C TIDAK ada di pohon dengan root ini.
    // SMTVerifier dijalankan dalam mode non-inklusi (fnc = 1). Untuk C yang sudah
    // dicabut, tidak ada witness yang memenuhi constraint ini (F4).
    // =========================================================================
    component smt = SMTVerifier(nLevels);
    smt.enabled <== 1;         // verifikasi selalu aktif
    smt.fnc <== 1;             // 1 = buktikan NON-inklusi
    smt.root <== root;         // terhadap root publik
    for (var i = 0; i < nLevels; i++) {
        smt.siblings[i] <== siblings[i];
    }
    smt.oldKey <== oldKey;
    smt.oldValue <== oldValue;
    smt.isOld0 <== isOld0;
    smt.key <== C;             // key yang dibuktikan tidak ada = C
    smt.value <== 0;           // value diabaikan pada mode non-inklusi

    // =========================================================================
    // Constraint 3 (Algoritma 3.1 baris 7): ikat ctx ke sistem constraint.
    // Public input yang tidak muncul di constraint mana pun dapat diganti tanpa
    // membuat bukti gagal. Mengkuadratkan ctx memastikan ctx ikut "terkunci".
    // =========================================================================
    signal ctxSquared;
    ctxSquared <== ctx * ctx;
}
