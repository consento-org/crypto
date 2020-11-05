// Structure of keys:
//
// RECEIVE_KEY = [ENCRYPT_KEY][VERIFY_KEY][DECRYPT_KEY]
// SEND_KEY = [ENCRYPT_KEY][VERIFY_KEY][SIGN_KEY]

const ENCRYPT_KEY_SIZE = 32
const ENCRYPT_KEY_START = 0
const ENCRYPT_KEY_END = ENCRYPT_KEY_START + ENCRYPT_KEY_SIZE

const VERIFY_KEY_SIZE = 32
const VERIFY_KEY_START = ENCRYPT_KEY_END
const VERIFY_KEY_END = VERIFY_KEY_START + VERIFY_KEY_SIZE

const DECRYPT_KEY_SIZE = 32
const DECRYPT_KEY_START = VERIFY_KEY_END
const DECRYPT_KEY_END = DECRYPT_KEY_START + DECRYPT_KEY_SIZE

const SIGN_KEY_SIZE = 64
const SIGN_KEY_START = VERIFY_KEY_END
const SIGN_KEY_END = SIGN_KEY_START + SIGN_KEY_SIZE

export function encryptKeyFromSendOrReceiveKey (sendOrReceiveKey: Uint8Array): Uint8Array {
  return sendOrReceiveKey.slice(ENCRYPT_KEY_START, ENCRYPT_KEY_END)
}

export function verifyKeyFromSendOrReceiveKey (sendOrReceiveKey: Uint8Array): Uint8Array {
  return sendOrReceiveKey.slice(VERIFY_KEY_START, VERIFY_KEY_END)
}

export function decryptKeyFromReceiveKey (receiveKey: Uint8Array): Uint8Array {
  return receiveKey.slice(DECRYPT_KEY_START, DECRYPT_KEY_END)
}

export function signKeyFromSendKey (sendKey: Uint8Array): Uint8Array {
  return sendKey.slice(SIGN_KEY_START, SIGN_KEY_END)
}
