# Fase 1 — Sirkuit `NonRevocation(d)`

> **Ringkas:** Fase ini menulis sirkuit Circom yang menyatakan "commitment `C` saya dibentuk dari rahasia saya dan `C` **tidak** ada di pohon pencabutan dengan root ini", tanpa membuka rahasia holder. Sirkuit dikompilasi untuk 4 kedalaman, dianalisis dengan Circomspect, dan diuji dengan witness yang benar maupun yang sengaja salah.
> **Hasil:** constraint d = 32 = **20.498**; selisih per level konstan **534** (linear ✔); **16 tes lolos** (total 32 dengan fase 0); peragaan `npm run fase1`.
> **Keputusan 1c (pilihan Anda):** sirkuit mengikuti Algoritma 3.1 **persis**, tanpa constraint tambahan `isOld0`. Konsekuensinya, celah `isOld0` **ada** dan dibuktikan oleh tes (bagian 8).
> **Belum ada di fase ini:** kunci Groth16, bukti sungguhan, kontrak. Fase 1 baru menghitung *witness*; bukti dibuat di fase 2.

---

## 0. Posisi fase ini

| Fase | Isi | Status |
|---|---|---|
| 0 | Fondasi: Poseidon, `s`, `h`, `C`, `ctx`, pohon pencabutan | ✔ |
| **1** | **Sirkuit `NonRevocation(d)`, constraint, Circomspect, serangan `isOld0`** | **✔ selesai, menunggu Anda** |
| 2 | Trusted setup Groth16, kunci, kontrak Verifier | belum |
| 3 | Kontrak `RevocationRegistry` | belum |
| 4 | Issuer, holder, verifier | belum |
| 5–9 | Alur terminal, uji F/P, benchmark, Sepolia, analisis | belum |

---

## 1. Apa yang dikerjakan dan untuk apa

| Pekerjaan | Untuk apa | Rujukan |
|---|---|---|
| Menulis `circuits/nonRevocation.circom` | Inti modul: bukti non-revocation untuk RQ2 | Bab III 3.3.3, Algoritma 3.1 |
| Kompilasi d = 8, 16, 24, 32 | Data jumlah constraint untuk H1 | Tabel 3.9 baris 1 |
| Menghitung selisih constraint per level | Kriteria linear H1: Δ₁ = Δ₂ = Δ₃ | Persamaan 3.5, Tabel 3.10 |
| Circomspect | Analisis statis sinyal yang kurang dibatasi | Bab III 3.9 lapis 1 |
| Tes witness benar dan salah | Memastikan sirkuit menolak yang tidak sah | Bab III 3.9 lapis 1 |
| Tes serangan `isOld0` | Membuktikan ada atau tidaknya celah *under-constrained* | Bab II 2.1.8 |
| `zk.js`, `circuitPaths()` | Pembungkus snarkjs dan lokasi berkas build | — |

**Mengapa sirkuit dikerjakan sebelum yang lain?** Ini bagian berisiko terbesar: menurut Bab II 2.1.8, mayoritas kerentanan SNARK bersifat *under-constrained* (sirkuit kurang membatasi sehingga menerima yang seharusnya ditolak). Urutan input publik `[C, root, ctx]` juga menentukan bentuk kontrak (fase 3) dan modul holder/verifier (fase 4).

---

## 2. Kesesuaian dengan Bab I–III

| Hal di fase ini | Rujukan | Status |
|---|---|---|
| Input publik `C`, `root`, `ctx` (urutan ini) | 3.3.3, Persamaan 3.3 | Sesuai |
| Constraint 1: `Poseidon(credId, issuerId, schemaId, Poseidon(s)) = C` | Algoritma 3.1 baris 1–3 | Sesuai |
| Constraint 2: `SMTVerifier` non-inklusi (`fnc = 1`, `key = C`) terhadap `root` | Algoritma 3.1 baris 4–6 | Sesuai |
| Constraint 3: `ctx` diikat ke sistem constraint (`ctxSquared <== ctx * ctx`) | Algoritma 3.1 baris 7 | Sesuai |
| Kedalaman 8, 16, 24, 32; konfigurasi utama 32 | 3.3.2, Tabel 3.9 | Sesuai |
| Template `Poseidon` dan `SMTVerifier` dari circomlib dipakai apa adanya | 3.3.3 | Sesuai |
| Circom 2.2.2, circomlib 2.0.5, snarkjs 0.7.6, Circomspect 0.9.0 | 3.8, Tabel 3.11 | Sesuai, terkunci |
| **Tidak ada constraint tambahan pada `isOld0`** | Algoritma 3.1 (tidak menyebutnya) | **Sesuai Bab III, atas pilihan Anda (keputusan 1c)** |
| Celah `isOld0` pada `SMTVerifier` circomlib 2.0.5 | **Tidak tertulis di Bab III** | **Temuan baru**, wajib dicatat di Bab IV (bagian 8) |

Tidak ada bagian Bab I–III yang diubah atau ditambah. Satu-satunya hal baru adalah **temuan** celah, bukan perubahan desain.

---

## 3. Isi sirkuit — dibaca seperti kalimat

```
Public input  : C, root, ctx                            ← terlihat oleh verifier
Witness privat: credId, issuerId, schemaId, s,
                siblings[d], oldKey, oldValue, isOld0     ← hanya holder

Constraint 1  : Poseidon(credId, issuerId, schemaId, Poseidon(s)) === C
                → hanya pemilik s yang bisa membuat bukti untuk C ini           (F7)
Constraint 2  : SMTVerifier(d), mode non-inklusi (fnc = 1), key = C, terhadap root
                → C tidak ada di pohon                                          (F4)
Constraint 3  : ctxSquared <== ctx * ctx
                → ctx terikat ke bukti, tidak dapat diganti                     (F5, F6)
```

### Baris penting di `circuits/nonRevocation.circom`

| Baris | Isi | Fungsi |
|---|---|---|
| 25–26 | `include "circomlib/..."` | Memakai `Poseidon` dan `SMTVerifier` dari circomlib, tidak ditulis ulang |
| 28 | `template NonRevocation(nLevels)` | Sirkuit dengan parameter kedalaman pohon |
| 30–32 | `signal input C, root, ctx` | Tiga input publik (nanti dinyatakan publik di berkas `main`) |
| 35–38 | `credId, issuerId, schemaId, s` | Witness privat: atribut dan rahasia |
| 41–44 | `siblings, oldKey, oldValue, isOld0` | Witness privat: lintasan non-inklusi dari `getNonInclusionWitness` (fase 0) |
| 51–52 | `hashS = Poseidon(1)` | Menghitung `h = Poseidon(s)` di dalam sirkuit |
| 54–58 | `hashC = Poseidon(4)` | Menghitung `C' = Poseidon(credId, issuerId, schemaId, h)` |
| 60 | `hashC.out === C` | **Constraint 1:** `C'` harus sama dengan `C` publik |
| 67–78 | `SMTVerifier(nLevels)` | **Constraint 2:** `fnc = 1` berarti buktikan **non**-inklusi; `key = C` |
| 85–86 | `ctxSquared <== ctx * ctx` | **Constraint 3:** mengunci `ctx` |

Tanda `===` berarti **constraint**: kedua sisi harus sama, bila tidak pembangkit witness berhenti dengan galat. Tanda `<==` berarti memberi nilai sekaligus mengikatnya sebagai constraint.

**Mengapa constraint 3 ada?** Sinyal publik yang tidak muncul di constraint mana pun bisa diganti tanpa membuat bukti gagal. Mengkuadratkan `ctx` membuatnya ikut "terkunci". Inilah juga sebab Circomspect memberi satu peringatan (bagian 7).

### Berkas `main` per kedalaman

`circuits/main/nonRevocation_d32.circom` hanya berisi:

```circom
include "../nonRevocation.circom";
component main {public [C, root, ctx]} = NonRevocation(32);
```

Kurung `{public [C, root, ctx]}` menentukan **input publik dan urutannya**. Urutan ini harus sama persis dengan kontrak Verifier di fase 3.

---

## 4. Mini BPS — di mana sirkuit dipakai

```
BPS-2: Issuer memberi holder lintasan non-inklusi (siblings, oldKey, oldValue, isOld0)
          │
BPS-3: Holder menyusun input = C, root, ctx + credId, issuerId, schemaId, s + lintasan
          │
          ├─► pembangkit witness (.wasm) menghitung semua sinyal dan memeriksa "==="
          │       ✗ gagal bila s salah, C bukan milik holder, root salah, atau C sudah dicabut
          │
          └─► witness + proving key (fase 2) → bukti Groth16 → dikirim ke verifier
```

---

## 5. Berkas yang dibuat dan urutan membacanya

| No | Berkas | Isi |
|---|---|---|
| 1 | `circuits/nonRevocation.circom` | Sirkuit utama (Algoritma 3.1), setiap baris berkomentar |
| 2 | `circuits/main/nonRevocation_d{8,16,24,32}.circom` | Berkas `main` per kedalaman, dibuat otomatis oleh skrip 01 |
| 3 | `src/common/zk.js` | `buildCircuitInput`, `calculateWitness` |
| 4 | `src/common/paths.js` | Ditambah `circuitPaths(depth)` |
| 5 | `scripts/01-compile-circuits.js` | Kompilasi 4 kedalaman, hitung constraint dan selisih |
| 6 | `scripts/02-lint-circuit.js` | Menjalankan Circomspect |
| 7 | `scripts/fase1-peragaan.js` | Peragaan 7 langkah di terminal (`npm run fase1`) |
| 8 | `test/fase1-circuit.test.js`, `test/helpers/fixtures.js` | 16 tes dan pembantu |
| 9 | `circuits/test/nonRevocationDiperbaiki.circom` | **Varian uji**: sirkuit yang sama + satu constraint, hanya sebagai pembanding |

Hasil: `build/circuits/d{8,16,24,32}/` (`.r1cs`, `.wasm`), `build/circuits/test/` (varian uji), `results/fase1-constraints.json`, `results/fase1-circomspect.txt`.

### Pustaka yang ditambahkan

| Pustaka | Versi | Fungsi |
|---|---|---|
| circomlib | 2.0.5 | Template sirkuit `Poseidon` dan `SMTVerifier` |
| snarkjs | 0.7.6 | Menghitung witness (fase 1); bukti dan trusted setup (fase 2) |
| circom (biner) | 2.2.2 | Compiler sirkuit, dipasang terpisah (bagian 9) |
| circomspect (biner) | 0.9.0 | Analisis statis sirkuit, dipasang terpisah (bagian 9) |

---

## 6. Penjelasan setiap fungsi

### `src/common/zk.js`

| Fungsi | Baris | Penjelasan |
|---|---|---|
| `buildCircuitInput({...})` | 32 | Menyusun objek input sirkuit. Semua nilai menjadi string desimal, format yang diminta pembangkit witness. Memisahkan bagian publik (`C`, `root`, `ctx`) dan privat |
| `calculateWitness(depth, input, wasmPath?)` | 61 | Menjalankan program WASM sirkuit. **Melempar galat** bila ada constraint `===` yang dilanggar. `wasmPath` opsional untuk memakai varian uji |

### `src/common/paths.js`

| Fungsi | Baris | Penjelasan |
|---|---|---|
| `circuitPaths(depth)` | 29 | Mengembalikan lokasi `.circom` main, `.r1cs`, `.sym`, dan `.wasm` untuk satu kedalaman |

### Skrip

| Skrip | Yang dilakukan | Keluaran |
|---|---|---|
| `01-compile-circuits.js` | Menulis berkas `main` per d, memanggil `circom --r1cs --wasm --sym`, membaca jumlah constraint (`snarkjs.r1cs.info`), menghitung selisih per level, mengompilasi varian uji | `build/circuits/`, `results/fase1-constraints.json` |
| `02-lint-circuit.js` | Menjalankan `circomspect` pada sirkuit, menyimpan laporan, gagal hanya bila ada `error` | `results/fase1-circomspect.txt` |
| `fase1-peragaan.js` | Menjalankan sirkuit dengan witness benar dan salah, mencetak diterima atau ditolak | Terminal |

### Pembantu di tes

| Fungsi | Penjelasan |
|---|---|
| `rejects(fn)` | `true` bila pembangkit witness menolak input |
| `checkAllConstraints(r1cs, wtns)` | `snarkjs.wtns.check`: memeriksa **semua** constraint R1CS terhadap witness |
| `buildAttackInput(tree, cred, ctx)` | Menyusun input serangan `isOld0` (bagian 8) |
| `makeValidInput`, `revokeRandom`, `makeRevokedCredential` | Pembantu di `fixtures.js`: input sah, mengisi pohon, membuat kredensial yang sudah dicabut |

---

## 7. Hasil

### Jumlah constraint (Tabel 3.9 baris 1)

| d | Constraint | Wire | Input publik | Input privat |
|---|---|---|---|---|
| 8 | 7.682 | 7.692 | 3 | 15 |
| 16 | 11.954 | 11.972 | 3 | 23 |
| 24 | 16.226 | 16.252 | 3 | 31 |
| 32 | **20.498** | 20.532 | 3 | 39 |

Selisih per level: 534 / 534 / 534, jadi **pertumbuhan linear** (syarat kedua H1 terpenuhi). Sirkuit d = 32 muat di ptau 2¹⁶ (kapasitas ≈ 65 ribu, dipakai di fase 2).

> **Catatan angka.** Versi proyek sebelumnya memakai constraint tambahan `isOld0` sehingga angkanya 7.683 / 11.955 / 16.227 / **20.499** (satu lebih banyak). Angka di atas adalah milik sirkuit **tanpa** constraint itu, sesuai keputusan 1c. Bila ada angka 20.499 di naskah Anda, gantilah menjadi 20.498.

### Circomspect

| Tingkat | Jumlah | Keterangan |
|---|---|---|
| error | 0 | — |
| warning | 1 | `ctxSquared` hanya muncul di satu constraint. **Disengaja**: tugasnya hanya mengikat `ctx` (Algoritma 3.1 baris 7) |
| note | 3 | Peringatan umum aritmetika lapangan dan perbandingan pada perulangan; tidak berisiko |

> Circomspect **tidak** menganalisis isi pustaka circomlib, sehingga celah `isOld0` (bagian 8) tidak terdeteksi. Analisis statis saja tidak cukup; tes serangan tetap diperlukan.

### Tes (16 lolos)

| Tes | d | Hasil yang diharapkan | Skenario |
|---|---|---|---|
| Witness sah memenuhi seluruh constraint R1CS | 8, 32 | Lolos | Kontrol |
| Rahasia `s` salah | 8, 32 | Ditolak | F7 |
| `C` publik milik kredensial lain | 8, 32 | Ditolak | Constraint 1 |
| Root berbeda | 8, 32 | Ditolak | Constraint 2 |
| Kredensial dicabut tidak punya lintasan non-inklusi | 8, 32 | Tidak ada lintasan | F4 |
| Lintasan inklusi dipakai sebagai non-inklusi (`isOld0 = 1`) | 8, 32 | Ditolak | F4 |
| Lintasan inklusi + `oldKey = C` (`isOld0 = 0`) | 8, 32 | Ditolak | F4 |
| Serangan `isOld0` pada **sirkuit utama** | 8 | **Lolos** (celah terbukti) | Keputusan 1c |
| Serangan `isOld0` pada **varian diperbaiki** | 8 | Ditolak | Keputusan 1c |

Baris `ERROR: … Error in template …` yang tampil di terminal saat tes negatif adalah keluaran sirkuit ketika menolak input salah. Itu **diharapkan**, bukan kegagalan tes.

---

## 8. Keputusan 1c: celah `isOld0`

### Apa yang terjadi

Template `SMTVerifier` milik circomlib 2.0.5 menerima sinyal `isOld0` tanpa membatasinya hanya 0 atau 1. Di dalamnya, nilai simpul di ujung lintasan dihitung sebagai `(1 − isOld0) · Hash1(oldKey, oldValue)`. Bila `isOld0` boleh bernilai sembarang `t`, pemegang kredensial yang **sudah dicabut** bisa memilih `t` sehingga hasil perhitungan **sama persis** dengan daun C yang asli:

```
(1 − t) · Hash1(oldKey, oldValue) = Hash1(C, 1)
            ⇒  t = 1 − Hash1(C, 1) / Hash1(oldKey, oldValue)
```

Root yang dihitung sirkuit pun sama dengan root asli, padahal `C` **ada** di pohon. Sirkuit menyimpulkan "C tidak ada", padahal sebaliknya.

### Yang Anda putuskan

| Pilihan | Dipilih |
|---|---|
| Tambahkan `isOld0 * (isOld0 - 1) === 0` (+1 constraint), Algoritma 3.1 perlu ditambah satu baris | — |
| **Ikuti Bab III persis, tanpa constraint** | **✔ pilihan Anda** |

### Yang dibuktikan tes dan peragaan

| Sirkuit | Serangan `isOld0` non-biner | Arti |
|---|---|---|
| **Utama** (Algoritma 3.1 persis) | **DITERIMA** | Celah nyata pada tingkat sirkuit |
| Varian diperbaiki (+ satu constraint) | DITOLAK | Satu baris menutupnya |

Pemalsuan sederhana (`isOld0 = 1` atau `isOld0 = 0` dengan lintasan inklusi asli) **tetap ditolak** oleh sirkuit utama. Yang lolos hanya `isOld0` **non-biner** yang dipilih khusus.

### Seberapa mudah dieksploitasi di sistem lengkap

Tes bekerja pada tingkat sirkuit: penyerang diberi lintasan inklusi (siblings) dari pohon. Pada sistem lengkap (fase 4), penyerang perlu mendapat `siblings` itu dari layanan lintasan issuer, dan layanan itu **tidak melayani kredensial yang dicabut** (ia menjawab `{revoked: true}`, keputusan 1b). Jadi eksploitasi praktis lebih sulit daripada yang ditunjukkan tes. Namun seberapa mudah penyerang memperoleh siblings dari sumber lain **belum dianalisis**, dan pertahanan di lapisan sirkuit tetap yang paling kuat. Ini layak dicatat apa adanya.

### Kalimat usulan untuk Bab IV (Keterbatasan)

> Sirkuit mengikuti Algoritma 3.1 apa adanya. Pengujian menemukan bahwa template `SMTVerifier` pada circomlib 2.0.5 tidak membatasi sinyal `isOld0` pada nilai 0 atau 1. Pemegang rahasia sebuah kredensial yang telah dicabut dapat memilih `isOld0` non-biner sehingga constraint non-inklusi terpenuhi (diperagakan pada tes fase 1). Penambahan constraint `isOld0 · (isOld0 − 1) = 0` menutup celah ini dengan satu constraint tambahan (terbukti pada varian uji), dan direkomendasikan pada pengembangan lanjutan.

### Bila nanti Anda berubah pikiran

Cukup satu baris di `circuits/nonRevocation.circom` (lihat isi `circuits/test/nonRevocationDiperbaiki.circom` baris yang diberi tanda "SATU-SATUNYA PERBEDAAN"), lalu `npm run circuit:compile`. Fase 2 dan seterusnya menyesuaikan otomatis. Sirkuit utama **tidak** saya ubah tanpa persetujuan Anda.

---

## 9. User guide

### 9.1 Yang dibutuhkan

| Keperluan | Perlu pasang? |
|---|---|
| Menjalankan **tes dan peragaan** (`npm test`, `npm run fase1`) | **Tidak.** Hasil kompilasi sudah ada di `build/circuits/` |
| **Membangun ulang sirkuit** (`npm run circuit:compile`, `npm run circuit:lint`) | Ya: Rust, circom 2.2.2, circomspect 0.9.0 |

Jadi Anda **boleh melewati 9.2** bila hanya ingin menjalankan tes dan peragaan.

### 9.2 Memasang circom dan circomspect (opsional, ±45 menit karena kompilasi Rust)

Di terminal Ubuntu:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

```bash
source "$HOME/.cargo/env"
```

```bash
cd ~ && git clone --branch v2.2.2 --depth 1 https://github.com/iden3/circom.git circom-src
```

```bash
cd ~/circom-src && cargo install --path circom
```

Periksa; harus `circom compiler 2.2.2`:

```bash
circom --version
```

```bash
cargo install circomspect --version 0.9.0
```

### 9.3 Mengambil pembaruan dan menjalankan

```bash
cd ~/Revocation-Terminal && git pull
```

```bash
npm ci
```

Peragaan (disarankan dijalankan lebih dulu, sambil membuka dokumen ini):

```bash
npm run fase1
```

Tes fase 1, lalu semua tes:

```bash
npm run test:fase1
```

```bash
npm test
```

Bila Anda memasang circom, membangun ulang:

```bash
npm run circuit:compile
```

```bash
npm run circuit:lint
```

### 9.4 Cara membaca keluaran `npm run fase1`

| Langkah | Yang dilihat | Artinya |
|---|---|---|
| 1 | Tabel constraint, `534 / 534 / 534`, `linear? true` | Biaya bukti naik linear terhadap kedalaman (H1) |
| 2 | `seluruh constraint R1CS terpenuhi? true` | Holder yang jujur diterima |
| 3 | `DITOLAK` | Tanpa `s` yang benar, bukti tidak bisa dibuat (F7) |
| 4 | `DITOLAK` | Tidak bisa meminjam `C` kredensial lain |
| 5 | `DITOLAK` | Root karangan tidak cocok dengan lintasan |
| 6 | `lintasan … tersedia? false`, dua pemalsuan `DITOLAK` | Dasar uji F4 |
| 7 | **Sirkuit utama `DITERIMA ⚠ CELAH`**, varian `DITOLAK` | Konsekuensi keputusan 1c |
| Ringkasan | ✅ untuk setiap baris | Hasil nyata sama dengan yang diharapkan |

Angka acak (C, root, ctx, `isOld0` penyerang) berbeda setiap kali.

### 9.5 Keluaran `npm run test:fase1` yang diharapkan

```
  FASE 1 — Sirkuit NonRevocation(d)
    kedalaman d = 8
      ✔ witness SAH …   ✔ F7 …   ✔ C publik milik kredensial lain …   ✔ root yang berbeda …
      ✔ F4 (3 tes)
    kedalaman d = 32
      ✔ … (7 tes)
    Keputusan 1c: serangan isOld0 non-biner pada SMTVerifier circomlib
      ✔ SIRKUIT UTAMA …: kredensial dicabut LOLOS seluruh constraint → celah TERBUKTI …
      ✔ VARIAN DIPERBAIKI …: serangan yang sama ditolak

  16 passing
```

---

## 10. Uji pemahaman (jawab sebelum lanjut ke fase 2)

1. Apa bedanya **input publik** dan **witness privat**? Mana yang dilihat verifier? *(bagian 3)*
2. Mengapa Constraint 1 membuat bukti gagal bila `s` salah? *(bagian 3, langkah 3 peragaan; kaitkan dengan langkah 4 fase 0)*
3. Apa arti `===` dan `<==` di Circom? *(bagian 3)*
4. Mengapa `ctxSquared <== ctx * ctx` ada, dan mengapa Circomspect memberi peringatan tentangnya? *(bagian 3 dan 7)*
5. Mengapa jumlah constraint naik **linear** (534 per level), bukan eksponensial? Apa hubungannya dengan H1? *(bagian 7)*
6. Apa itu celah `isOld0`, mengapa pemalsuan sederhana ditolak tetapi `isOld0` non-biner lolos, dan apa yang Anda putuskan tentangnya? *(bagian 8)*
7. Mengapa Circomspect tidak menemukan celah `isOld0`? *(bagian 7)*

Bila sudah paham, katakan **lanjut ke fase 2**. Fase 2 membuat kunci Groth16 (trusted setup) agar sirkuit ini menghasilkan **bukti sungguhan** dan kontrak Verifier.

---

## 11. Masalah yang sering terjadi

| Gejala | Penyebab | Solusi |
|---|---|---|
| `ERROR: … Error in template …` saat tes | Keluaran sirkuit ketika menolak input salah | Normal pada tes negatif; abaikan bila tes berstatus ✔ |
| `circom: command not found` | Rust/cargo belum ada di PATH | `source "$HOME/.cargo/env"` (hanya perlu bila membangun ulang) |
| `Cannot find module '…/build/circuits/…'` | Hasil kompilasi belum ada | `git pull`, atau `npm run circuit:compile` |
| `circomspect tidak ditemukan` | Belum dipasang | `cargo install circomspect --version 0.9.0` |
| Kompilasi Rust sangat lama | Normal, ±45 menit | Tunggu; tidak perlu bila hanya menjalankan tes |
| Jumlah constraint 20.499, bukan 20.498 | Memakai sirkuit dengan constraint `isOld0` | Pastikan `circuits/nonRevocation.circom` tidak berisi `isOld0 * (isOld0 - 1)` |
