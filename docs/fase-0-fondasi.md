# Fase 0 — Fondasi

> **Ringkas:** Fase ini menyiapkan proyek dan modul bersama `src/common/` yang dipakai **semua** fase berikutnya: bilangan acak yang aman, hash Poseidon, commitment `C`, nilai konteks `ctx`, dan pohon pencabutan dengan daun genesis.
> **Hasil:** 16 tes lolos (`npm run test:fase0`) dan satu peragaan di terminal (`npm run fase0`).
> **Belum ada di fase ini:** sirkuit, kunci Groth16, kontrak, issuer, holder, verifier. Semuanya dibangun di fase 1 dan seterusnya, **satu fase per giliran**.

---

## 0. Cara kerja bertahap

Repositori ini dibangun satu fase per satu. Pola setiap fase:

1. Saya menyelesaikan satu fase: kode (setiap baris diberi komentar), dokumen fase, tes, dan peragaan di terminal.
2. Anda membaca dokumen fase, menjalankan peragaannya, membaca kodenya, lalu menjawab **uji pemahaman** di akhir dokumen.
3. Setelah Anda paham, Anda menyatakan lanjut. Baru fase berikutnya dibuat.

| Fase | Isi | Status |
|---|---|---|
| **0** | **Fondasi: bilangan acak, Poseidon, s, h, C, ctx, pohon pencabutan + daun genesis** | **✔ selesai, menunggu Anda** |
| 1 | Sirkuit `NonRevocation(d)`, jumlah constraint, Circomspect, serangan `isOld0` | belum |
| 2 | Trusted setup Groth16, kunci, kontrak Verifier | belum |
| 3 | Kontrak `RevocationRegistry` (`updateRoot`, jendela W = 2, `check`) | belum |
| 4 | Issuer (did:ethr, VC ES256K), holder, verifier | belum |
| 5 | Alur end-to-end di terminal | belum |
| 6 | Data sintetis, uji fungsional F1–F10 dan uji privasi P1–P5 | belum |
| 7 | Benchmark (H1, RQ3) | belum |
| 8 | Demonstrasi jaringan uji (Sepolia) | belum |
| 9 | Analisis biaya, skor privasi, laporan | belum |

---

## 1. Apa yang dikerjakan dan untuk apa

| Pekerjaan | Untuk apa | Rujukan |
|---|---|---|
| `package.json` dengan versi terkunci (tanpa `^` atau `~`) dan `package-lock.json` | Hasil penelitian dapat direplikasi persis; versi tidak berubah selama penelitian | Bab III 3.8, Tabel 3.11 |
| `field.js` | Semua nilai yang masuk sirkuit harus berada di lapangan prima BN254 | Bab III 3.3.1, 3.4 |
| `poseidon.js` | Hash yang sama persis dengan Poseidon di dalam sirkuit | Bab II 2.1.4 |
| `commitment.js` | Menghitung `s`, `h = Poseidon(s)`, `credId`, dan `C` | Persamaan 3.1, Tabel 3.4 |
| `context.js` | Menghitung `nonce` dan `ctx = Poseidon(nonce, verifierId)` | Persamaan 3.3 |
| `revocationTree.js` | Pohon pencabutan (Sparse Merkle Tree) milik issuer, termasuk daun genesis | Bab III 3.3.2, keputusan 1a |
| `paths.js` | Konstanta dasar (folder proyek, kedalaman 8/16/24/32) | Bab III 3.3.2 |

**Mengapa dikerjakan pertama?** Issuer, holder, verifier, dan sirkuit harus menghitung `C` dan `ctx` dengan cara yang **identik**. Satu perbedaan kecil, misalnya urutan masukan Poseidon, membuat semua bukti gagal. Karena itu perhitungan ini ditulis sekali di sini lalu dipakai bersama.

---

## 2. Kesesuaian dengan Bab I–III

| Hal di fase ini | Bunyi / rujukan di Bab III | Status |
|---|---|---|
| `s` berupa bilangan acak 31 byte, satu per kredensial | 3.3.1 | Sesuai |
| `h = Poseidon(s)` dikirim ke issuer, `s` tidak pernah keluar dari holder | 3.2.2, 3.3.1, Tabel 3.4 | Sesuai |
| `credId` acak 248 bit | 3.2.2, 3.4 | Sesuai |
| `C = Poseidon(credId, issuerId, schemaId, Poseidon(s))` | Persamaan 3.1 | Sesuai, urutan masukan sama |
| `ctx = Poseidon(nonce, verifierId)` | Persamaan 3.3 | Sesuai |
| Pohon hanya memuat kredensial yang dicabut: daun `key = C`, `value = 1` | 3.3.2 | Sesuai |
| Kedalaman 8/16/24/32, konfigurasi utama 32 | 3.3.2, Tabel 3.9 | Sesuai |
| Tumbukan posisi daun ditolak; 100 pencabutan pada d = 32 tidak bertumbukan (peluang ≈ 1,2 × 10⁻⁶) | 3.3.2, Persamaan 3.2 | Sesuai, diuji |
| Versi pustaka dikunci | 3.8, Tabel 3.11 | Sesuai |
| **Daun genesis** saat pohon dibuat | **Tidak tertulis di Bab III** | **Penambahan, sudah Anda setujui (keputusan 1a).** Perlu satu kalimat di 3.3.2 |

Tidak ada bagian Bab I–III yang diubah atau ditambah oleh fase ini. Satu-satunya hal yang melampaui teks adalah keputusan 1a, dan alasannya dibuktikan oleh tes (lihat bagian 8).

---

## 3. Mini BPS — di mana fungsi fase ini dipakai nanti

```
BPS-1 Penerbitan                       BPS-3 Presentasi
─────────────────                      ────────────────
Holder: generateSecret()  → s          Verifier: generateNonce() → nonce
Holder: hashSecret(s)     → h          Holder  : computeContext(nonce, verifierId) → ctx
Issuer: generateCredId()  → credId     Verifier: computeContext(...) lagi, dari nonce MILIKNYA
Issuer: computeCommitment(...) → C
Holder: computeCommitment(...) lagi → harus sama dengan C di VC

BPS-4 Pencabutan                        BPS-2 Pengambilan lintasan
────────────────                        ──────────────────────────
Issuer: RevocationTree.create(32)       Issuer: tree.getNonInclusionWitness(C)
        (otomatis berisi daun genesis)          → siblings, oldKey, oldValue, isOld0, root
Issuer: tree.revoke(C)
Issuer: tree.root → dikirim ke updateRoot (fase 3)
```

---

## 4. Berkas yang dibuat dan urutan membacanya

Setiap baris kode di berkas-berkas ini diberi komentar. **Urutan baca yang disarankan:**

| No | Berkas | Isi | Baris |
|---|---|---|---|
| 1 | `src/common/field.js` | Lapangan prima BN254, bilangan acak, alamat → bilangan | 70 |
| 2 | `src/common/poseidon.js` | Hash Poseidon | 50 |
| 3 | `src/common/commitment.js` | `s`, `h`, `credId`, `C` | 74 |
| 4 | `src/common/context.js` | `nonce`, `ctx` | 36 |
| 5 | `src/common/revocationTree.js` | Pohon pencabutan + daun genesis | 180 |
| 6 | `src/common/paths.js`, `src/common/index.js` | Konstanta dan pintu masuk | 21, 19 |
| 7 | `scripts/00-fondasi.js` | Peragaan di terminal | 122 |
| 8 | `test/helpers/fixtures.js`, `test/fase0-common.test.js` | Pembantu tes dan 16 tes | 61, 178 |

Berkas pengaturan: `package.json` (versi terkunci dan perintah), `package-lock.json`, `hardhat.config.js` (penjalan tes), `.gitignore`.

### Versi yang dikunci pada fase 0

| Pustaka | Versi | Fungsi |
|---|---|---|
| circomlibjs | 0.1.7 | Poseidon dan Sparse Merkle Tree versi JavaScript |
| ethers | 6.17.0 | Memvalidasi alamat Ethereum (`getAddress`) |
| hardhat | 2.29.1 | Penjalan tes (di dalamnya Mocha); dipakai penuh mulai fase 3 |
| chai | 4.5.0 | Pernyataan (`expect`) di dalam tes |

Pustaka lain (circom, snarkjs, did-resolver, jose, express, dst.) baru ditambahkan di fase yang memakainya.

---

## 5. Penjelasan setiap fungsi

### `field.js`

| Fungsi | Baris | Masukan → keluaran | Penjelasan |
|---|---|---|---|
| `FIELD_P` | 20 | konstanta | Orde lapangan prima BN254. Semua nilai sirkuit harus `< FIELD_P` |
| `randomFieldElement()` | 33 | — → bigint 248 bit | 31 byte acak dari generator kriptografis OS. 2^248 < FIELD_P, jadi selalu sah. Dipakai untuk `s`, `credId`, `nonce` |
| `assertField(x, name)` | 46 | bigint → bigint | Melempar galat bila `x` bukan bigint atau di luar lapangan |
| `addressToField(addr)` | 66 | `"0xAbC…"` → bigint | Alamat Ethereum (160 bit) menjadi bilangan; checksum divalidasi. Dipakai untuk `issuerId` dan `verifierId` |

### `poseidon.js`

| Fungsi | Baris | Penjelasan |
|---|---|---|
| `getPoseidon()` | 24 | Membangun Poseidon sekali saja lalu menyimpannya (pembangunannya lambat) |
| `poseidonHash([x1..xn])` | 42 | Hash Poseidon dari daftar bigint; hasilnya identik dengan template Poseidon di sirkuit |

### `commitment.js`

| Fungsi | Baris | Penjelasan | BPS |
|---|---|---|---|
| `generateSecret()` | 29 | Rahasia holder `s`, satu per kredensial | BPS-1 langkah 1 |
| `hashSecret(s)` | 40 | `h = Poseidon(s)`; hanya `h` yang dikirim ke issuer | BPS-1 langkah 2 |
| `generateCredId()` | 49 | `credId` acak 248 bit | BPS-1 langkah 3 |
| `computeCommitment({credId, issuerId, schemaId, h})` | 65 | `C = Poseidon(credId, issuerId, schemaId, h)` | BPS-1 langkah 4 dan 7 |

### `context.js`

| Fungsi | Baris | Penjelasan | BPS |
|---|---|---|---|
| `generateNonce()` | 19 | Nonce acak baru untuk setiap sesi verifikasi | BPS-3 langkah 1 |
| `computeContext(nonce, verifierId)` | 32 | `ctx = Poseidon(nonce, verifierId)` | BPS-3 langkah 3 dan 9 |

### `revocationTree.js` — kelas `RevocationTree`

| Fungsi | Baris | Penjelasan | BPS |
|---|---|---|---|
| `getGenesisKey()` | 48 | Key daun genesis = Poseidon dari teks tetap; dihitung sekali | Keputusan 1a |
| `RevocationTree.create(depth)` | 79 | Pohon baru untuk d = 8/16/24/32, langsung diisi daun genesis | Inisialisasi issuer |
| `tree.root` | 94 | Root pohon (bigint). Inilah nilai yang dikirim ke `updateRoot` | BPS-4 langkah 4 |
| `tree.isRevoked(C)` | 103 | `true` bila `C` ada di pohon | — |
| `tree.revoke(C)` | 117 | Menyisipkan daun `key = C, value = 1`. `false` bila sudah ada. Menolak dan membatalkan bila lintasan terlalu dalam (tumbukan) | BPS-4 langkah 2 |
| `tree.getNonInclusionWitness(C)` | 141 | `siblings[d]`, `oldKey`, `oldValue`, `isOld0`, `root`. Melempar galat bila `C` sudah dicabut | BPS-2 langkah 3 |
| `tree.getInclusionPath(C)` | 171 | Lintasan inklusi; **hanya dipakai tes keamanan** fase 1 | Tes fase 1 |

**Cara membaca `getNonInclusionWitness`.** Lintasan menelusuri pohon mengikuti bit-bit `C` dari atas. Ada dua kemungkinan ujungnya: kosong (`isOld0 = 1`) atau daun milik kredensial lain (`isOld0 = 0`, dengan `oldKey` dan `oldValue` daun itu). Dua-duanya membuktikan "`C` tidak ada di pohon". Sirkuit fase 1 memverifikasi persis data ini.

---

## 6. User guide

### 6.1 Persiapan sekali pasang (Windows 11 + WSL2 Ubuntu)

Semua perintah dijalankan di **terminal Ubuntu**, bukan PowerShell. Prompt Ubuntu berbentuk `nama@komputer:~$`.

Jika WSL Anda masih membuka `docker-desktop` sebagai bawaan, jalankan **di PowerShell**:

```powershell
wsl --set-default Ubuntu
```

```powershell
wsl -d Ubuntu --cd ~
```

Di Ubuntu, pasang perkakas dasar dan Node.js 22 lewat nvm (tanpa `sudo`):

```bash
sudo apt update && sudo apt install -y git curl build-essential
```

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Tutup lalu buka lagi terminal Ubuntu, kemudian:

```bash
nvm install 22
```

Periksa, harus `/home/<nama>/.nvm/...`, bukan `/mnt/c/...`:

```bash
which node npm
```

> Fase 0 **belum** membutuhkan Rust, circom, atau circomspect. Itu baru dipasang di fase 1.

### 6.2 Mengambil dan menjalankan

Simpan proyek di home Linux (`~`), bukan `/mnt/c/...`. Login GitHub memakai `gh auth login` (GitHub tidak menerima password akun untuk git).

```bash
cd ~ && git clone https://github.com/hanangpradipta/Revocation-Terminal.git
```

```bash
cd ~/Revocation-Terminal && npm ci
```

Peragaan di terminal (disarankan dijalankan lebih dulu, sambil membuka dokumen ini):

```bash
npm run fase0
```

Lalu tes otomatis:

```bash
npm run test:fase0
```

### 6.3 Cara membaca keluaran `npm run fase0`

| Langkah | Yang dilihat | Artinya |
|---|---|---|
| 1 | `s < 2^248 ? true`, `h < batas ? true` | Kedua nilai sah sebagai elemen lapangan BN254 |
| 2 | `C = …` | Commitment dari empat masukan (Persamaan 3.1) |
| 3 | `sama? true` | Holder bisa memeriksa C milik issuer dengan rahasianya sendiri |
| 4 | `sama dengan C asli? false` | Mengubah satu masukan mengubah C |
| 5 | `sama dengan A? false` dua kali | ctx berbeda untuk verifier berbeda dan sesi berbeda |
| 6 | `root pohon kosong circomlib 0` lalu root ≠ 0 | Alasan keputusan 1a; root berubah setelah `revoke` |
| 7 | `isOld0`, `lintasan untuk C dicabut TIDAK ADA` | Dasar uji F4 |

Angka acak (s, credId, C, nonce, ctx) berbeda setiap kali. **Root genesis `8868682256…518674` selalu sama**, karena daun genesisnya konstan.

### 6.4 Keluaran `npm run test:fase0` yang diharapkan

```
  FASE 0 — Modul bersama
    field.js: bilangan acak dan alamat
      ✔ randomFieldElement menghasilkan bilangan < 2^248 …
      ✔ addressToField mengubah alamat Ethereum menjadi bilangan 160 bit
      ✔ addressToField menolak alamat yang formatnya salah
    poseidon.js dan commitment.js: …
      ✔ … (5 tes)
    context.js: ctx = Poseidon(nonce, verifierId)
      ✔ nonce berbeda atau verifier berbeda menghasilkan ctx berbeda
    revocationTree.js: pohon pencabutan dan daun genesis (keputusan 1a)
      ✔ … (7 tes)

  16 passing
```

---

## 7. Apa yang dibuktikan 16 tes

| Kelompok | Jumlah | Yang dibuktikan |
|---|---|---|
| `field.js` | 3 | Bilangan acak selalu < 2²⁴⁸ dan tidak berulang; alamat → 160 bit; alamat salah ditolak |
| `poseidon.js` + `commitment.js` | 5 | Poseidon deterministik; masukan di luar lapangan ditolak; C bisa dihitung ulang holder; mengubah satu masukan mengubah C; `h` berbeda per kredensial |
| `context.js` | 1 | nonce berbeda atau verifier berbeda → ctx berbeda |
| `revocationTree.js` | 7 | Root pohon kosong = 0 (alasan 1a); pohon baru root ≠ 0; hanya d = 8/16/24/32; `revoke` mengubah root dan tidak berulang; lintasan non-inklusi ada untuk kredensial aktif; **tidak ada** untuk yang dicabut; 100 pencabutan pada d = 32 tanpa tumbukan |

---

## 8. Keputusan dan catatan

| No | Keputusan | Alasan | Status Bab III |
|---|---|---|---|
| 1a | **Daun genesis** saat pohon dibuat | Root pohon kosong di circomlib = 0, dan kontrak (fase 3) menolak root 0. Tes "ALASAN keputusan 1a" membuktikannya | Perlu 1 kalimat di 3.3.2 |
| — | Tumbukan posisi daun ditolak dan dibatalkan | Pada circomlib, sibling level terakhir wajib 0, sehingga lintasan maksimal d − 1 sibling | Sesuai 3.3.2 |
| — | Teks daun genesis `revocation-blockchain.v1/genesis` | Dipertahankan agar root genesis identik dengan versi sebelumnya (`8868682256…518674`) | Detail implementasi |
| — | `paths.js` baru berisi konstanta | Lokasi berkas build ditambah di fase 1–2 | — |

---

## 9. Uji pemahaman (jawab sebelum lanjut ke fase 1)

Anda tidak perlu menjawab di sini. Cukup pastikan bisa menjelaskannya dengan kata-kata sendiri. Jawabannya ada di bagian yang disebut.

1. Mengapa `s` hanya 31 byte, dan mengapa itu aman untuk sirkuit? *(bagian 5, `randomFieldElement`)*
2. Siapa yang mengetahui `s`, `h`, dan `C`? Mengapa verifier tidak boleh punya `h`? *(Tabel 3.4; dibahas lagi di fase 4)*
3. Mengapa holder menghitung ulang `C` ketika menerima VC? *(Langkah 3 di peragaan)*
4. Apa yang dilindungi `ctx`, dan serangan mana yang dicegahnya? *(Langkah 5 di peragaan)*
5. Mengapa pohon diberi daun genesis? Apa yang terjadi bila tidak? *(bagian 8, langkah 6 di peragaan)*
6. Mengapa `getNonInclusionWitness` melempar galat untuk kredensial yang sudah dicabut, dan apa hubungannya dengan uji F4? *(Langkah 7 di peragaan)*

Bila sudah paham, katakan **lanjut ke fase 1**. Fase 1 membahas sirkuit yang membuktikan "`C` ada di bawah `s` yang benar **dan** tidak ada di pohon".

---

## 10. Masalah yang sering terjadi

| Gejala | Penyebab | Solusi |
|---|---|---|
| `CMD.EXE was started … UNC paths are not supported` | npm Windows yang terpanggil, bukan npm Ubuntu | Pasang Node lewat nvm di Ubuntu; `which npm` harus `/home/<nama>/.nvm/...` |
| `which` tidak dikenal | Perintah diketik di PowerShell | Masuk Ubuntu: `wsl -d Ubuntu --cd ~` |
| Prompt `…:~#` (tanda `#`) | Masuk ke distro `docker-desktop` sebagai root | `wsl --set-default Ubuntu` |
| `Password authentication is not supported` | GitHub tidak menerima password akun | `gh auth login` |
| `rm: cannot remove 'node_modules/…': Permission denied` | `node_modules` dibuat npm Windows | Clone ulang ke folder baru di `~` |
| Tes terasa lambat | Proyek berada di `/mnt/c/...` | Pindahkan ke `~` |
| Jangan memakai `sudo npm …` | Membuat berkas milik root dan masalah izin | Jalankan tanpa `sudo` |
