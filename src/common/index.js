/**
 * index.js — Satu pintu masuk untuk semua modul bersama (src/common).
 *
 * Modul lain cukup menulis:
 *     const common = require("../common");
 * lalu memakai common.computeCommitment, common.RevocationTree, dan seterusnya.
 * Tanda "..." menyalin semua fungsi dari setiap berkas ke satu objek.
 *
 * Berkas ini BERTAMBAH di setiap fase: fase 1 menambah ./zk, fase 4 menambah ./did dan ./vc.
 */

module.exports = { // semua ekspor dikumpulkan di satu objek
  ...require("./field"), // FIELD_P, randomFieldElement, assertField, addressToField
  ...require("./poseidon"), // getPoseidon, poseidonHash
  ...require("./commitment"), // generateSecret (s), hashSecret (h), generateCredId, computeCommitment (C)
  ...require("./context"), // generateNonce, computeContext (ctx)
  ...require("./revocationTree"), // RevocationTree (Sparse Merkle Tree pencabutan)
  ...require("./paths"), // ROOT, DEPTHS, MAIN_DEPTH, circuitPaths
  ...require("./zk"), // buildCircuitInput, calculateWitness (fase 1)
};
