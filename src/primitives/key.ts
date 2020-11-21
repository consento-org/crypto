import { Buffer } from '../util'

// Structure of keys:
//
// READER_KEY = [ENCRYPT_KEY][VERIFY_KEY][DECRYPT_KEY]
// WRITER_KEY = [ENCRYPT_KEY][VERIFY_KEY][SIGN_KEY]
// CHANNEL_KEY = [ENCRYPT_KEY][VERIFY_KEY][DECRYPT_KEY][SIGN_KEY]
// CONNECTION_KEY = [IN_READER_KEY][OUT_WRITER_KEY]
//

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

const SIGN_KEY_CHANNEL_START = DECRYPT_KEY_END
const SIGN_KEY_CHANNEL_END = SIGN_KEY_CHANNEL_START + SIGN_KEY_SIZE

const CONNECTION_KEY_IN_START = 0
const CONNECTION_KEY_IN_END = CONNECTION_KEY_IN_START + DECRYPT_KEY_END
const CONNECTION_KEY_OUT_START = CONNECTION_KEY_IN_END
const CONNECTION_KEY_OUT_END = CONNECTION_KEY_OUT_START + SIGN_KEY_END

export function encryptKeyFromSendOrReceiveKey (writerOrReaderKey: Uint8Array): Uint8Array {
  return writerOrReaderKey.slice(ENCRYPT_KEY_START, ENCRYPT_KEY_END)
}

export function verifyKeyFromSendOrReceiveKey (writerOrReaderKey: Uint8Array): Uint8Array {
  return writerOrReaderKey.slice(VERIFY_KEY_START, VERIFY_KEY_END)
}

export function decryptKeyFromReceiveKey (readerKey: Uint8Array): Uint8Array {
  return readerKey.slice(DECRYPT_KEY_START, DECRYPT_KEY_END)
}

export function signKeyFromSendKey (writerKey: Uint8Array): Uint8Array {
  return writerKey.slice(SIGN_KEY_START, SIGN_KEY_END)
}

export function signKeyFromChannelKey (channelKey: Uint8Array): Uint8Array {
  return channelKey.slice(SIGN_KEY_CHANNEL_START, SIGN_KEY_CHANNEL_END)
}

export function readerKeyFromChannelKey (channelKey: Uint8Array): Uint8Array {
  return channelKey.slice(ENCRYPT_KEY_START, DECRYPT_KEY_END)
}

export function writerKeyFromChannelKey (channelKey: Uint8Array): Uint8Array {
  const channelBuf = Buffer.from(channelKey)
  return Buffer.concat([channelBuf.slice(ENCRYPT_KEY_START, VERIFY_KEY_END), channelBuf.slice(SIGN_KEY_CHANNEL_START, SIGN_KEY_CHANNEL_END)])
}

export function inReaderKeyFromConnectionKey (connectionKey: Uint8Array): Uint8Array {
  return connectionKey.slice(CONNECTION_KEY_IN_START, CONNECTION_KEY_IN_END)
}

export function outWriterKeyFromConnectionKey (connectionKey: Uint8Array): Uint8Array {
  return connectionKey.slice(CONNECTION_KEY_OUT_START, CONNECTION_KEY_OUT_END)
}
