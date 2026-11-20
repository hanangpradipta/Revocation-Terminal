pragma circom 2.1.9;

// Berkas ini DIBUAT OTOMATIS oleh scripts/01-compile-circuits.js.
// Kedalaman pohon pencabutan d = 32. Public input: C, root, ctx.
include "../nonRevocation.circom";

component main {public [C, root, ctx]} = NonRevocation(32);
