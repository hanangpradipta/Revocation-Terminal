/**
 * hardhat.config.js — Konfigurasi Hardhat.
 *
 * Pada FASE 0 Hardhat hanya dipakai sebagai PENJALAN TES (di dalamnya ada Mocha), sehingga
 * perintah `npm test` sama di semua fase. Bagian kontrak Solidity, jaringan lokal,
 * dan Sepolia baru dipakai mulai fase 3 dan 8.
 *
 * - Solidity 0.8.28 (Bab III Tabel 3.11), optimizer aktif runs = 200. Pengaturan ini
 *   memengaruhi angka gas pada fase 3 dan 7, sehingga dikunci sejak sekarang.
 * - Batas waktu tes diperbesar karena pembuatan bukti ZK (fase 2 dst.) butuh beberapa detik.
 */

module.exports = {
  solidity: {
    version: "0.8.28", // versi compiler Solidity (dipakai mulai fase 3)
    settings: {
      optimizer: { enabled: true, runs: 200 }, // memengaruhi angka gas
    },
  },
  paths: {
    sources: "./contracts", // berkas .sol (folder baru dibuat di fase 3)
    tests: "./test", // berkas tes
    cache: "./build/hardhat-cache", // cache kompilasi
    artifacts: "./build/hardhat-artifacts", // hasil kompilasi kontrak
  },
  mocha: {
    timeout: 600000, // 10 menit per tes
  },
};
