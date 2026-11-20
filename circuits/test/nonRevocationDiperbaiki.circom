pragma circom 2.1.9;

// =============================================================================
// nonRevocationDiperbaiki.circom — VARIAN UJI, JANGAN DIPAKAI DI LUAR TES.
//
// Isinya sama persis dengan circuits/nonRevocation.circom (yang mengikuti Algoritma 3.1
// apa adanya) DITAMBAH satu constraint: isOld0 * (isOld0 - 1) === 0.
//
// Tujuannya hanya sebagai PEMBANDING di test/fase1-circuit.test.js: menunjukkan bahwa
// celah isOld0 pada sirkuit utama nyata, dan bahwa satu baris ini menutupnya.
// Sirkuit utama sengaja TIDAK diubah (keputusan 1c: ikuti Bab III persis).
// =============================================================================

include "circomlib/circuits/poseidon.circom";          // fungsi hash Poseidon
include "circomlib/circuits/smt/smtverifier.circom";   // verifikasi Sparse Merkle Tree

template NonRevocationDiperbaiki(nLevels) {
    signal input C;         // public: commitment kredensial
    signal input root;      // public: root pohon pencabutan
    signal input ctx;       // public: pengikat sesi
    signal input credId;    // privat: nomor kredensial
    signal input issuerId;  // privat: alamat issuer sebagai bilangan
    signal input schemaId;  // privat: jenis kredensial
    signal input s;         // privat: rahasia holder
    signal input siblings[nLevels]; // privat: simpul saudara sepanjang lintasan
    signal input oldKey;    // privat: key daun lain di ujung lintasan
    signal input oldValue;  // privat: value daun lain tersebut
    signal input isOld0;    // privat: 1 = ujung kosong, 0 = ujung daun lain

    // Constraint 1: C dihitung ulang dari atribut dan s (sama dengan sirkuit utama).
    component hashS = Poseidon(1);          // h = Poseidon(s)
    hashS.inputs[0] <== s;                  // masukan: rahasia s
    component hashC = Poseidon(4);          // C' = Poseidon(credId, issuerId, schemaId, h)
    hashC.inputs[0] <== credId;
    hashC.inputs[1] <== issuerId;
    hashC.inputs[2] <== schemaId;
    hashC.inputs[3] <== hashS.out;
    hashC.out === C;                        // C' harus sama dengan C publik

    // SATU-SATUNYA PERBEDAAN dengan sirkuit utama: isOld0 wajib 0 atau 1.
    isOld0 * (isOld0 - 1) === 0;

    // Constraint 2: C tidak ada di pohon (sama dengan sirkuit utama).
    component smt = SMTVerifier(nLevels);   // verifikasi Sparse Merkle Tree
    smt.enabled <== 1;                      // selalu aktif
    smt.fnc <== 1;                          // 1 = buktikan NON-inklusi
    smt.root <== root;                      // terhadap root publik
    for (var i = 0; i < nLevels; i++) {
        smt.siblings[i] <== siblings[i];    // salin simpul saudara
    }
    smt.oldKey <== oldKey;
    smt.oldValue <== oldValue;
    smt.isOld0 <== isOld0;
    smt.key <== C;                          // key yang dibuktikan tidak ada
    smt.value <== 0;                        // diabaikan pada mode non-inklusi

    // Constraint 3: ikat ctx (sama dengan sirkuit utama).
    signal ctxSquared;
    ctxSquared <== ctx * ctx;
}

// Hanya kedalaman 8 yang dibutuhkan untuk peragaan.
component main {public [C, root, ctx]} = NonRevocationDiperbaiki(8);
