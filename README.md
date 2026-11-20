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
| 1 | Sirkuit `NonRevocation(d)`, constraint, Circomspect, serangan `isOld0` | [fase-1-sirkuit.md](docs/fase-1-sirkuit.md) | ✔ |
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
| `npm run fase1` | Peragaan sirkuit di terminal | 1 |
| `npm run test:fase1` | 16 tes sirkuit | 1 |
| `npm run circuit:compile` / `circuit:lint` | Membangun ulang sirkuit / Circomspect (butuh circom) | 1 |
| `npm test` | Semua tes yang sudah ada (32) | semua |

## Struktur (sampai fase 1)

```
circuits/            sirkuit Circom (NonRevocation) + main per kedalaman + varian uji
src/common/          field, poseidon, commitment, context, revocationTree, paths, zk
scripts/             00-fondasi.js, fase1-peragaan.js (peragaan) · 01-02 (kompilasi, Circomspect)
build/circuits/      hasil kompilasi sirkuit (.r1cs, .wasm)
results/             hasil terukur (jumlah constraint, Circomspect)
test/                fase0-common.test.js, fase1-circuit.test.js + helpers/fixtures.js
docs/                dokumen per fase
hardhat.config.js    penjalan tes
```

Struktur ini bertambah di setiap fase.
