# @consento/crypto

`@consento/crypto` is a set of crypto primitives useful for the communication within the
consento workflow.

## State

Pre 1.0. This library is under heavy development. There are still updates to both the interna
of this library and to namings.

## Goal

[`libsodium`](https://doc.libsodium.org/) is a good crypto foundation to build on but
using it as-is presents various issues:

> `keys` are all of the same type (`Uint8Array`) and its easy to mistake one key for another one.

This library is set out to create a good dictionary and structure on top of `libsodium` that
enables users to clearly understand what happens where. This is achived through proper naming: for example:
we distinguish `verifyKey` and `decryptKey` which would both be called `pk` in `libsodium`. This
extends to the type definition which are as expressive as possible.

> Users need to know both the `key` type and the implementation to use it which makes it prone to type errors.

In this library we have structures like `Writer` that keep the `encryptKey` needed for a `encryption` operation
making an API like `writer.encrypt('message')` possible, which natively would look like
`crypto_box_seal(encryptKey, stringToBuffer('message'))`.

> `libsodium` works with `Uint8Array` but users have `Objects`.

Any data that is processed with `libsodium` is binary, which gives is flexibly but not how it's used in practice.
With this library comes `codec` support for all structures. You can specify for a `read` and `write` process to
use complex data structures, even supporting custom structures if you need those. Core strategy here is to specify
the types to a great detail with TypeScript. For example, the `Writer` has a generic information for the codec:
`Writer<typeof codecs.msgpack>` which means you can see while coding what data the `Writer` can encode anything
that is encodable with msgpack.

> The de-/serialization of structures using `libsodium` can be tedious.

Everything in this library can be serialized with `.toJSON()` and restored with the constructor. Example:
`new Writer(writer.toJSON())`. This allows for an easy means to preserve the data structure in a standard format.
A goal for `2.0.0` is to provide protocol buffer de-/encoding to allow more efficent data structures.

## Topics

- [Encrypted Communication](#encrypted-communication) - Sending messages between agents using [public key cryptography][PPC].
- [Establishing Connections](#establishing-connections) - Creating new connections between agents (aka. [Handshake][Handshake]).
- [Encrypted Blobs](#encrypted-blobs) - Encryption for [Blobs][Blob] that results in [Content-addressable][CADDR] data.

[PPC]: https://en.wikipedia.org/wiki/Public-key_cryptography
[Handshake]: https://en.wikipedia.org/wiki/Handshaking
[Blob]: https://en.wikipedia.org/wiki/Binary_large_object
[CADDR]: https://en.wikipedia.org/wiki/Content-addressable_storage

## Vocabulary

- `Channel` - an e2e encrypted setup consisting of one `Reader` and one `Writer`
- `Writer` - an object containing the keys that allow to encrypt data - it can _write_ on that Channel - it can not read the data!
- `Reader` - an object containing the keys that allow to decrypt data - it can _read_ on that Channel - it can not write to it!
- `Verifier` - an object describing an the capability to verify if a message is part of a `Channel` without being able to read it.
- `Connection` - an e2e encrypted setup consisting of the `Reader` of one channel, called `input` and the `Writer` of another, called `output`.
- `Blob` - a self-contained piece of data, like an image or pdf.
- `Handshake` - the process to connect two separate processes/devices resulting in a `Connection` for each process.
- `SignVector` - operations on a `Channel` **may** be `vectored` with means that there is a new sign/verify keypair for every new message.
    The `SignVector` holds the `index` and current `sign` or `verify` key.
- `VerifyVector` - sibling to `SignVector` the `VerifyVector` allows to verify things in the order that the `SignVector` created it.
- `Codec` - Data written by a reader or read by a writer will be transported binary (`Uint8Array`), a `Codec` specifies how an object read
    or written will be translated from/to binary data.

## Encrypted Communication

The crypto library contains useful primitives for sending e2e encrypted messages through public channels.

```javascript
const { createChannel } = require('@consento/crypto')
const { writer, reader } = createChannel()

const encrypted = writer.encrypt('hello world')
const decrypted = reader.decrypt(encrypted) === 'hello world'
```

You can create a new communication channel with the simple `createChannel` method.

```javascript
const channel = createChannel()
const { reader } = channel // Can decrypt messages; _could_ encrypt messages, but these would not be signed and rejected!
const { writer } = channel // Can only encrypt messages.
const { verifier } = channel // Object that can verify messages but not de-/encrypt messages.

reader.readerKey // To backup/restore the receiver
writer.senderKey // To backup/restore the sender
reader.verifyKeyBase64 === writer.verifyKeyBase64 === verifier.verifyKeyBase64
// The lookup id is same here, the verifyKey may be used to verify the data, can also be used for the channel

writer.signKey // Allows the writer to sign messages, only privy to the writer
reader.decryptKey // Allows the reader to decrypt messages, only privy to the reader

writer.encryptKey.equals(receiver.encryptKey) // Key to encrypt messages, receiver _can_ write but not sign the message, thus it exists pro-forma
```

All objects created using `createChannel` are well de-/serializable:

```javascript
const { createChannel, Reader, Writer, Verifier } = require('@consento/crypto')
const channel = createChannel()
const { reader, writer, verifier } = channel

new Channel(channel.toJSON())
new Reader(reader.toJSON())
new Writer(writer.toJSON())
new Verifier(verifier.toJSON())
```

### Codecs

Any data sent out through `Writer`s or `Reader`s is encoded using mechanism, by default it will be using `msgpack`
but you can specify any codec supported by [`@consento/codecs`](https://github.com/consento-org/codecs).

```js
const { createChannel } = require('@consento/crypto')

const { writer } = createChannel({ codec: 'json' }) // 
writer.encrypt({ foo: 'hello' }) // Changes the binary format to be utf-8 encoded JSON data.

const differentCodec = new Writer({ ...writer.toJSON(), codec: 'msgpack' })
differentCodec.encrypt({ foo: 'hello' }) // Looks same but the binary data is now encoded using msgpack
```

### Sign-Vectors

The `encrypt`, `decrypt` and `verify` operations can be extended using a `SignVector`. The `SignVector`
allows for all operations to be in sequential order. In other words: the chunks need to be decrypted/verified
in the same order as they were encrypted.

```js
const { createChannel, createSignVectors, SignVector } = require('@consento/crypto')
const { inVector, outVector } = createSignVectors()
const { writer, reader, verifier } = createChannel()

const list = []

list.push(writer.encrypt('foo', outVector))
console.log(outVector)

list.push(writer.encrypt('bar', outVector))
console.log(outVector)

list.push(writer.encrypt('baz', outVector))
console.log(outVector)

const decryptVector = new SignVector(inVector)
for (const entry of list) {
  console.log(reader.decrypt(entry, decryptVector))
  console.log(decryptVector)
}

const verifyVector = new SignVector(inVector)
for (const entry of list) {
  try {
    verifier.verify(entry, verifyVector)
  } catch (err) {
    // not verified
  }
  console.log(verifyVector)
}
```

#### writer.encrypt(body, [signVector])

Encrypt and sign a given input with the `encryptKey` and `signKey`.

- `body` - what you like to encrypt, any serializable object is possible
- `signVector` - optional `SignVector` instance to assure order of statements.
    See [Sign Vectors](#sign-vectors).

```javascript
const encrypted = writer.encrypt('secret message')
encrypted.signature // Uint8Array
encrypted.body // Uint8Array
```

#### writer.encryptOnly(body, [signVector]), reader.encryptOnly(body, [signVector])

Only encrypt the body. This is only recommended in an environment where the
signature needs to be created at a different time!

- `body` - what you like to encrypt, any serializable object is possible
- `signVector` - optional `SignVector` instance to assure order of statements.
    See [Sign Vectors](#sign-vectors).

```javascript
const encrypted = writer.encrypt('secret message')
encrypted // Uint8Array with an encrypted message
```

#### signVector.sign(message)

Signs a message in the order received.

- `message` - an `Uint8Array` that should be signed.

```javascript
const { outVector } = createSignVectors()
outVector.sign('hello world')
outVector.sign('hello world') // Different signature!
```

#### verifyVector.verify(message, signature)

Verifies that a message is encrypted with the corresponding `signVector` created using `createSignVectors`

- `message` - an `Uint8Array` with the message for the signature 
- `signature` - an `Uint8Array` that contains the signature

```javascript
const { EDecryptionError } = require('@consento/crypto')
const { inVector } = createSignVectors()
try {
  inVector.verify(message, signature)
} catch (error) {
  switch (error.code) {
    case EDecryptionError.unexpectedIndex: // Order of messages may be wrong
    case EDecryptionError.vectorIntegrity: // General vector verificaton failed
  }
}
```

#### writer.sign(data)

Signs a given data. This is only recommended in an environment where the
data was encrypted at a different time!

- `data` - Uint8Array for which a signature is wanted

```javascript
const signature = sender.sign(sender.encryptOnly('secret message'))
signature // Uint8Array with the signature of the encrypted message
```

#### verifier.verify(signature, body, [signVector])

Using the annonymous object we can verify a given data.

- `signature` - `Uint8Array` with the signature for the `body`
- `body` - `Uint8Array` with of the encrypted data.
- `signVector` - optional `SignVector` instance to assure order of statements.
    See [Sign Vectors](#sign-vectors).

```javascript
const encrypted = writer.encrypt('hello world')
try {
  verifier.verify(encrypted.signature, encrypted.body)
} catch (err) {
  switch (err.code) {
    case EDecryptionError.invalidSignature: // Signature doesn't match
    case EDecryptionError.unexpectedIndex: // Order of messages may be wrong, only with SignVector
    case EDecryptionError.vectorIntegrity: // General vector verificaton failed, only with SignVector
  }
}
```

#### verifier.verifyMessage(message, [signVector])

As a short-cut its also possible to just verify a message

- `message` - `{ signature: Uint8Array, body: Uint8Array }` can also be `Uint8Array` in combination with a
    `signVector`
- `signVector` - optional `SignVector` instance to assure order of statements.
    See [Sign Vectors](#sign-vectors).

```javascript
try {
  verifier.verifyMessage(message)
} catch (err) {
  switch (err.code) {
    case EDecryptionError.invalidSignature: // Signature doesn't match
    case EDecryptionError.unexpectedIndex: // Order of messages may be wrong, only with SignVector
    case EDecryptionError.vectorIntegrity: // General vector verificaton failed, only with SignVector
  }
}
```

#### reader.decrypt(encrypted, [signVector])

Get the content of a once encrypted message.

- `encrypted` - `{ signature: Uint8Array, body: Uint8Array }` as created by `writer.encrypt` or
    `Uint8Array` created with `writer.encryptOnly`
- `signVector` - optional `SignVector` instance to assure order of statements.
    See [Sign Vectors](#sign-vectors).

```javascript
const message = reader.decrypt(message:)
```

## Establishing Connections

`crypto` also holds primitives for a decentralized handshake mechanism.

```javascript
const { initHandshake, acceptHandshake } = require('@consento/crypto')
```

`initHandshake` is to be used by the first person - "**A**lice".

`acceptHandshake` is to be used by the second person - "**B**ob".

How the handshake works:

1. **A**lice needs to create the initial message:

    ```javascript
    const alice = initHandshake()
    const initMessage = alice.firstMessage
    ```

2. **A**lice needs to listen to the channel with the id `alice.receiver.id` for answers that may come from **B**ob.
3. **A**lice needs to send hand the initial message to **B**ob using any means. (QR Code, Email,...)
4. **B**ob needs to receive the initial message

    ```javascript
    const bob = acceptHandshake(firstMessage)
    ```

5. **B**ob needs to listen to the channel with the id `bob.receiver.id` for the final message from **A**lice.
6. **B**ob needs to send the message, encrypted to the channel with the id: `bob.sender.id`:

    ```javascript
    bob.sender.encrypt(bob.acceptMessage)
    ```

7. **A**lice has to receive the acception message and can generate the channels out of it.

    ```javascript
    const decryptedAcceptMessage = alice.receiver.decryptMessage(acceptMessage).body
    const package = confirmHandshake(alice, decryptedAcceptMessage)
    const {
      connection: {
        sender: aliceToBobSender, // channel to send messages to Bob
        receiver: bobToAliceReceiver, // channel to receive messages from Bob
      },
      finalMessage
    } = package
    ```

8. **A**lice has to send the final message to bob:

    ```javascript
    aliceToBobSender.encrypt(finalMessage)
    ```

9. **B**ob can now finalize the handshake

    ```javascript
    const { output: bobToAliceOutput, input: aliceToBobInput } = bob.finalize(finalMessage)
    ```

Now **A**lice and **B**ob have each two channels: one to send data to, one to receive data from.

```javascript
bobToAliceReceiver.decrypt(aliceToBobSender.encrypt('Hello Bob!')) // Hello Bob!
aliceToBobReceiver.decrypt(bobToAliceSender.encrypt('Hello Alice!')) // Hello Alice!
```

## Encrypted Blobs

The crypto api also provides primitives for working with encrypted blobs:

```javascript
const { encryptBlob, decryptBlob, isEncryptedBlob } = setup(sodium)

const {
  blob, // Information about a blob: to pass around
  encrypted // Encrypted data to be stored
} = encryptBlob('Hello Secret!')
blob.path // Path at which to store the encrypted data
blob.secretKey // Secretkey to decrypt this data
blob.size // Number of bytes of the encrypted blob (only available after encryption)

isEncryptedBlob(blob) // To verify if a set of data is a blob

const decrypted = decryptBlob(blob.secretKey, encrypted)
```

Blob information is serializable with `toJSON` and deserializable using `toEncryptedBlob`.

```javascript
const { encryptBlob, decryptBlob, toEncryptedBlob } = setup(sodium)

const { blob } = encryptBlob('Hello Secret!')
const blobJSON = blob.toJSON()
const sameBlob = toEncryptedBlob(blobJSON)
```

It is possible to restore a blob from it's `secretKey` but that requires async computation:

```javascript
const { encryptBlob, decryptBlob, toEncryptedBlob } = setup(sodium)

const { blob } = encryptBlob('Hello Secret!')
const sameBlob = toEncryptedBlob(blob.secretKey)
```

## License

[MIT](./LICENSE)
