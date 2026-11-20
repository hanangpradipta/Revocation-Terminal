/**
 * 01-compile-circuits.js — FASE 1: kompilasi sirkuit untuk 4 kedalaman pohon.
 *
 * Yang dilakukan skrip ini (Bab III 3.5 langkah 2, Tabel 3.9 baris 1):
 *   1. Membuat berkas "main" untuk setiap kedalaman d = 8, 16, 24, 32
 *      (circuits/main/nonRevocation_d{d}.circom).
 *   2. Mengompilasi setiap berkas dengan Circom menjadi:
 *        - .r1cs  : sistem constraint (dipakai trusted setup dan hitung constraint)
 *        - .wasm  : program pembangkit witness (dipakai holder saat membuat bukti)
 *        - .sym   : tabel nama sinyal (untuk debugging)
 *   3. Membaca jumlah constraint N(d) dan menghitung selisih per level
 *      Δk = (N(d_k+1) − N(d_k)) / (d_k+1 − d_k)   (Persamaan 3.5).
 *   4. Menyimpan hasilnya ke results/fase1-constraints.json.
 *   5. Mengompilasi juga varian uji "diperbaiki" (d = 8): sirkuit yang sama ditambah satu constraint isOld0,
 *      hanya sebagai PEMBANDING di tes serangan isOld0.
 *
 * Butuh program `circom` 2.2.2 terpasang (lihat docs/fase-1-sirkuit.md bagian 6).
 * Hasil kompilasi sudah tersedia di build/circuits/, jadi skrip ini TIDAK wajib dijalankan.
 *
 * Cara menjalankan:  npm run circuit:compile
 */

const fs = require("fs"); // menulis berkas main dan hasil
const path = require("path"); // menyusun alamat berkas
const { execFileSync } = require("child_process"); // menjalankan program luar (circom) dan menunggu selesai
const snarkjs = require("snarkjs"); // membaca info berkas .r1cs (jumlah constraint)
const { ROOT, DEPTHS, circuitPaths } = require("../src/common/paths"); // lokasi berkas per kedalaman

/**
 * Isi berkas main untuk kedalaman d. Berkas ini hanya memanggil template
 * NonRevocation(d) dan menyatakan C, root, ctx sebagai public input
 * (urutannya menentukan urutan publicSignals: [C, root, ctx]).
 */
function mainSource(depth) { // membuat isi berkas main; baris di dalam tanda kutip miring adalah isi berkas yang ditulis
  return `pragma circom 2.1.9;

// Berkas ini DIBUAT OTOMATIS oleh scripts/01-compile-circuits.js.
// Kedalaman pohon pencabutan d = ${depth}. Public input: C, root, ctx.
include "../nonRevocation.circom";

component main {public [C, root, ctx]} = NonRevocation(${depth});
`;
}

/**
 * Menjalankan compiler circom untuk satu berkas.
 * -l node_modules  : agar include "circomlib/..." dapat ditemukan
 * --r1cs --wasm --sym : keluaran yang dibutuhkan
 * -o outDir        : folder keluaran
 */
function runCircom(circomFile, outDir) { // menjalankan compiler circom untuk satu berkas
  fs.mkdirSync(outDir, { recursive: true }); // buat folder keluaran bila belum ada
  execFileSync( // memanggil program luar `circom`
    "circom", // nama program
    [circomFile, "--r1cs", "--wasm", "--sym", "-l", path.join(ROOT, "node_modules"), "-o", outDir], // argumen circom (lihat keterangan di atas)
    { stdio: "inherit" } // tampilkan keluaran circom langsung di terminal
  );
}

async function main() { // fungsi utama: kompilasi semua kedalaman
  const circomVersion = execFileSync("circom", ["--version"]).toString().trim(); // catat versi compiler (harus 2.2.2)
  console.log(`Compiler: ${circomVersion}\n`); // tampilkan versi compiler

  const rows = []; // satu baris per kedalaman
  for (const depth of DEPTHS) { // d = 8, 16, 24, 32
    const p = circuitPaths(depth); // semua lokasi berkas untuk kedalaman ini
    // Langkah 1: tulis berkas main untuk kedalaman ini.
    fs.mkdirSync(path.dirname(p.mainCircom), { recursive: true }); // pastikan folder circuits/main ada
    fs.writeFileSync(p.mainCircom, mainSource(depth)); // tulis berkas main untuk kedalaman ini

    // Langkah 2: kompilasi.
    console.log(`=== Kompilasi d = ${depth} ===`); // tampilkan kemajuan
    runCircom(p.mainCircom, p.circuitDir); // kompilasi sirkuit → .r1cs, .wasm, .sym

    // Langkah 3: baca jumlah constraint dari berkas .r1cs.
    const info = await snarkjs.r1cs.info(p.r1cs); // baca info jumlah constraint dari .r1cs
    rows.push({ // simpan satu baris hasil
      depth, // kedalaman pohon
      constraints: info.nConstraints, // jumlah constraint N(d) (makin banyak → bukti makin lama dibuat)
      wires: info.nVars, // jumlah sinyal/variabel
      publicInputs: info.nPubInputs, // harus 3 (C, root, ctx)
      privateInputs: info.nPrvInputs, // witness privat
    });
  }

  // Hitung Δ per level antara dua kedalaman berurutan (Persamaan 3.5).
  const deltas = []; // daftar selisih antar kedalaman berurutan
  for (let k = 0; k < rows.length - 1; k++) { // untuk setiap pasangan kedalaman berurutan
    const a = rows[k]; // kedalaman lebih kecil
    const b = rows[k + 1]; // kedalaman berikutnya
    deltas.push({ // simpan hasil selisih
      from: a.depth, // kedalaman awal
      to: b.depth, // kedalaman akhir
      deltaPerLevel: (b.constraints - a.constraints) / (b.depth - a.depth), // tambahan constraint per satu tingkat pohon
    });
  }
  // Pertumbuhan linear bila Δ1 = Δ2 = Δ3 (kriteria H1, Tabel 3.10).
  const linear = deltas.every((d) => d.deltaPerLevel === deltas[0].deltaPerLevel); // linear bila ketiga selisih sama persis

  // Langkah 5: varian uji "diperbaiki" sebagai pembanding peragaan serangan isOld0.
  console.log(`=== Kompilasi varian uji diperbaiki (d = 8) ===`); // tampilkan kemajuan
  runCircom(path.join(ROOT, "circuits", "test", "nonRevocationDiperbaiki.circom"), path.join(ROOT, "build", "circuits", "test")); // kompilasi varian uji (hanya untuk pembanding tes)

  // Langkah 4: simpan hasil.
  const result = { compiler: circomVersion, generatedAt: new Date().toISOString(), rows, deltas, linear }; // susun hasil lengkap
  fs.mkdirSync(path.join(ROOT, "results"), { recursive: true }); // pastikan folder results ada
  fs.writeFileSync(path.join(ROOT, "results", "fase1-constraints.json"), JSON.stringify(result, null, 2) + "\n"); // tulis hasil ke berkas JSON

  console.log("\nJumlah constraint per kedalaman:"); // ringkasan di terminal
  console.table(rows); // tampilkan tabel jumlah constraint
  console.log("Selisih constraint per level (Persamaan 3.5):"); // judul tabel selisih
  console.table(deltas); // tampilkan tabel selisih
  console.log(`Pertumbuhan linear (Δ1 = Δ2 = Δ3): ${linear ? "YA" : "TIDAK"}`); // tampilkan kesimpulan linear atau tidak
  console.log("Hasil disimpan di results/fase1-constraints.json"); // tampilkan lokasi berkas hasil
  process.exit(0); // snarkjs membiarkan worker thread hidup; keluar secara eksplisit
}

main().catch((err) => { // galat tak terduga → tampilkan dan keluar dengan kode 1
  console.error(err); // tampilkan galat
  process.exit(1); // keluar dengan kode gagal
});
