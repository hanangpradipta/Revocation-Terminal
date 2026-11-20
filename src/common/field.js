/**
 * field.js — Utilitas bilangan pada lapangan prima BN254.
 *
 * Semua nilai yang masuk ke sirkuit Circom (s, credId, issuerId, schemaId,
 * nonce, verifierId, C, root, ctx) harus berupa elemen lapangan prima kurva
 * BN254, yaitu bilangan bulat 0 <= x < FIELD_P. File ini menyediakan fungsi
 * untuk membangkitkan bilangan acak yang aman dan mengubah alamat Ethereum
 * menjadi elemen lapangan. Rujukan: Bab III 3.3.1 dan 3.4.
 *
 * Dipakai oleh: hampir semua modul (commitment, context, issuer, holder, verifier).
 */

const crypto = require("crypto"); // pustaka bawaan Node.js: sumber bilangan acak kriptografis (dari sistem operasi)
const { getAddress } = require("ethers"); // getAddress(): memvalidasi alamat Ethereum dan menormalkan huruf besar/kecil (checksum)

/**
 * Orde lapangan prima skalar kurva BN254 (alt_bn128). Circom dan snarkjs
 * bekerja modulo bilangan ini. Nilai ini konstan dan bersifat publik.
 */
const FIELD_P = // nilai konstanta ada di baris berikutnya
  21888242871839275222246405745257275088548364400416034343698204186575808495617n; // akhiran "n" = tipe BigInt (bilangan bulat sangat besar di JavaScript)

/**
 * Membangkitkan bilangan acak 31 byte (248 bit) dari generator acak
 * kriptografis sistem operasi.
 *
 * Mengapa 31 byte? 2^248 lebih kecil dari FIELD_P (~2^253,6), sehingga hasilnya
 * PASTI elemen lapangan yang sah tanpa perlu reduksi modulo (Bab III 3.3.1).
 * Fungsi ini dipakai untuk rahasia holder s, credId, dan nonce verifier.
 *
 * @returns {bigint} bilangan acak 0 <= x < 2^248
 */
function randomFieldElement() { // dipakai untuk s, credId, dan nonce
  const bytes = crypto.randomBytes(31); // 31 byte acak kriptografis
  return BigInt("0x" + bytes.toString("hex")); // ubah 31 byte → teks hex → bilangan BigInt
}

/**
 * Memastikan sebuah nilai adalah elemen lapangan yang sah (0 <= x < FIELD_P).
 * Dipakai sebagai pengaman sebelum nilai dikirim ke Poseidon atau sirkuit.
 *
 * @param {bigint} x nilai yang diperiksa
 * @param {string} name nama nilai, untuk pesan kesalahan yang jelas
 * @returns {bigint} nilai yang sama bila sah
 */
function assertField(x, name = "nilai") { // pengaman sebelum nilai masuk Poseidon/sirkuit
  if (typeof x !== "bigint") { // nilai harus BigInt, bukan angka biasa (Number) atau teks
    throw new TypeError(`${name} harus bertipe bigint`); // hentikan dengan pesan yang menyebut nama nilainya
  }
  if (x < 0n || x >= FIELD_P) { // nilai negatif atau ≥ FIELD_P tidak sah di sirkuit
    throw new RangeError(`${name} berada di luar lapangan prima BN254`); // galat bila di luar lapangan
  }
  return x; // sah: kembalikan nilai yang sama agar bisa dipakai langsung, mis. poseidonHash([assertField(s)])
}

/**
 * Mengubah alamat Ethereum (20 byte / 160 bit) menjadi elemen lapangan.
 *
 * Dipakai untuk issuerId (alamat issuer, masukan commitment C) dan verifierId
 * (alamat verifier, masukan ctx). 2^160 < FIELD_P sehingga konversinya aman.
 * getAddress() juga memvalidasi format dan checksum alamat. Rujukan: Bab III 3.2.1, 3.4.
 *
 * @param {string} address alamat Ethereum, misalnya "0xAbC..."
 * @returns {bigint} alamat sebagai bilangan bulat
 */
function addressToField(address) { // dipakai untuk issuerId dan verifierId
  return BigInt(getAddress(address)); // validasi alamat, lalu baca teks "0x…" sebagai bilangan
}

module.exports = { FIELD_P, randomFieldElement, assertField, addressToField }; // fungsi yang boleh dipakai file lain
