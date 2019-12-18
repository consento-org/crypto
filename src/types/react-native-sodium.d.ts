declare module 'react-native-sodium' {
  const sodium: {
    sodium_version_string (): Promise<string>
    randombytes_random(): Promise<number>
    randombytes_uniform(upper_bound: number): Promise<number>
    randombytes_buf(size: number): Promise<string>
    randombytes_close(): Promise<0>
    randombytes_stir(): Promise<0>
    crypto_secretbox_easy(m: string, n: string, k: string): Promise<string>
    crypto_secretbox_open_easy(c: string, n: string, k: string): Promise<string>
    crypto_auth(input: string, k: string): Promise<string>
    crypto_auth_verify(h: string, input: string, k: string): Promise<number>
    crypto_box_keypair(): Promise<{pk:string, sk: string}>
    crypto_box_easy(m: string, n: string, pk: string, sk: string): Promise<string>
    crypto_box_easy_afternm(m: string, n: string, k: string): Promise<string>
    crypto_box_open_easy(c: string, n: string, pk: string, sk: string): Promise<string>
    crypto_box_open_easy_afternm(c: string, n: string, k: string): Promise<string>
    crypto_box_beforenm(pk: string, sk: string): Promise<string>
    crypto_pwhash(keylen: number, d: string, t: string, opslimit: number, memlimit: number, algo: number): Promise<string>
    crypto_box_seal(m: string, pk: string): Promise<string>
    crypto_box_seal_open(c: string, pk: string, sk: string): Promise<string>
    crypto_scalarmult_base(n: string): Promise<string>
    crypto_sign_detached(msg: string, pk: string): Promise<string>
    crypto_sign_verify_detached(sig: string, msg: string, pk: string): Promise<true> // true or throws!
    crypto_sign_keypair(): Promise<{pk: string, sk: string}>
    crypto_sign_seed_keypair(seed: string): Promise<{pk: string, sk: string}>
    crypto_sign_ed25519_sk_to_seed(sk: string): Promise<string>
    crypto_sign_ed25519_pk_to_curve25519(pk: String): Promise<string>
    crypto_sign_ed25519_sk_to_curve25519(sk: string): Promise<string>
    crypto_sign_ed25519_sk_to_pk (sk: string): Promise<string>
    crypto_secretbox_KEYBYTES: number
    crypto_secretbox_NONCEBYTES: number
    crypto_secretbox_MACBYTES: number
    crypto_auth_KEYBYTES: number
    crypto_auth_BYTES: number
    crypto_box_PUBLICKEYBYTES: number
    crypto_box_SECRETKEYBYTES: number
    crypto_box_NONCEBYTES: number
    crypto_box_MACBYTES: number
    crypto_box_ZEROBYTES: number
    crypto_box_SEALBYTES: number
    crypto_sign_PUBLICKEYBYTES: number
    crypto_sign_SECRETKEYBYTES: number
    crypto_sign_SEEDBYTES: number
    crypto_sign_BYTES: number
    crypto_pwhash_SALTBYTES: number
    crypto_pwhash_OPSLIMIT_MODERATE: number
    crypto_pwhash_OPSLIMIT_MIN: number
    crypto_pwhash_OPSLIMIT_MAX: number
    crypto_pwhash_MEMLIMIT_MODERATE: number
    crypto_pwhash_MEMLIMIT_MIN: number
    crypto_pwhash_MEMLIMIT_MAX: number
    crypto_pwhash_ALG_DEFAULT: number
    crypto_pwhash_ALG_ARGON2I13: number
    crypto_pwhash_ALG_ARGON2ID13: number
  }
  export = sodium
}
