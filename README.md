# Revocation-Terminal

Prototipe **modul pencabutan kredensial digital pendidikan** berbasis Sparse Merkle Tree dan zk-SNARK Groth16 (penelitian tesis), **versi terminal**, dibangun **bertahap per fase**.

Holder membuktikan bahwa kredensialnya **belum dicabut** tanpa membuka daftar kredensial yang dicabut dan tanpa memberi verifier kemampuan memantau statusnya. Blockchain hanya menyimpan root harian pohon pencabutan untuk setiap issuer.

```
Issuer ──updateRoot (1×/hari)──► RevocationRegistry (root, prevRoot, epoch)
  │                                       ▲
  │ VC + lintasan (C + h)                 │ eth_call check() — tanpa transaksi
  ▼                                       │
Holder ──VC + bukti ZK [C, root, ctx]──► Verifier
```

## Cara memakai repositori ini

Repositori dibangun **satu fase per giliran** supaya mudah dipahami. Setiap fase berisi:

- kode dengan **komentar penjelasan di setiap baris**,
- **dokumen fase** (`docs/fase-N-….md`): apa dan mengapa, penjelasan setiap fungsi, mini BPS, kesesuaian dengan Bab I–III, panduan menjalankan, dan uji pemahaman,
- **peragaan di terminal** (`npm run faseN`) dan **tes otomatis** (`npm run test:faseN`).

Fase berikutnya baru dibuat setelah fase sebelumnya Anda pahami.

## Status

| Fase | Isi | Dokumen | Status |
|---|---|---|---|
| 0 | Fondasi: Poseidon, s, h, C, ctx, pohon pencabutan + daun genesis | [fase-0-fondasi.md](docs/fase-0-fondasi.md) | ✔ |
| 1 | Sirkuit `NonRevocation(d)`, constraint, Circomspect, serangan `isOld0` | — | belum |
| 2 | Trusted setup Groth16, kunci, kontrak Verifier | — | belum |
| 3 | Kontrak `RevocationRegistry` | — | belum |
| 4 | Issuer, holder, verifier | — | belum |
| 5 | Alur end-to-end di terminal | — | belum |
| 6 | Data sintetis, uji F1–F10 dan P1–P5 | — | belum |
| 7 | Benchmark (H1) | — | belum |
| 8 | Demonstrasi Sepolia | — | belum |
| 9 | Analisis biaya dan privasi, laporan | — | belum |

## Mulai cepat

Prasyarat: Node.js ≥ 20 dan git. Langkah lengkap (Windows 11 + WSL2 Ubuntu) ada di [`docs/fase-0-fondasi.md`](docs/fase-0-fondasi.md) bagian 6.

```bash
npm ci
```

```bash
npm run fase0
```

```bash
npm test
```

## Perintah

| Perintah | Fungsi | Fase |
|---|---|---|
| `npm run fase0` | Peragaan fondasi di terminal | 0 |
| `npm run test:fase0` | 16 tes fondasi | 0 |
| `npm test` | Semua tes yang sudah ada | semua |

## Struktur (fase 0)

```
src/common/          field, poseidon, commitment, context, revocationTree, paths
scripts/             00-fondasi.js (peragaan)
test/                fase0-common.test.js + helpers/fixtures.js
docs/                dokumen per fase
hardhat.config.js    penjalan tes
```

Struktur ini bertambah di setiap fase.
