# @consento/crypto

`@consento/crypto` is a set of crypto primitives useful for the communication within the
consento workflow.

## Goal

There are several crypto implementations out there, some work well on the server others work
in the browser, however due to asynchronisity issue in the libraries (some are sync, some async)
they don't work on either system. This library simplifies existing API's to a distilled
version that will work easily on server and mobile phones.

The implementation offered is as synchronous as possible, offering serialization (toJSON/Classes)
for all data types.

## Vocabulary

- `Channel` - an e2e encrypted setup consisting of one `Reader` and one `Writer`
- `Writer` - an object containing the keys that allow to encrypt data - it can _write_ on that Channel - it can not read the data!
- `Reader` - an object containing the keys that allow to decrypt data - it can _read_ on that Channel - it can not write to it!
- `Verifier` - an object describing an the capability to verify if a message is part of a `Channel` without being able to read it.
- `Connection` - an e2e encrypted setup consisting of the `Receiver` of one channel and the `Sender` of another.
- `Blob` - a self-contained piece of data, like an image or pdf.
- `Handshake` - the process to connect two separate processes/devices resulting in a `Connection` for each process.

## Sending/Receiving encrypted messages

The crypto library contains useful primitives for sending e2e encrypted messages through public channels.

```javascript
const { createChannel } = require('@consento/crypto')
const { writer, reader } = createChannel()

const encrypted = writer.encrypt('hello world')
const decrypted = reader.decrypt(encrypted)

decrypted.body === 'hello world'
```

You can create a new communication channel with the simple `createChannel` method.

```javascript
const channel = createChannel()
const { reader } = channel // Can decrypt messages; _could_ encrypt messages, but these would not be signed and rejected!
const { writer } = channel // Can only encrypt messages.
const { verifier } = channel // Object that can verify messages but not de-/encrypt messages.

reader.readerKey // To backup/restore the receiver
writer.senderKey // To backup/restore the sender
reader.channelKeyBase64 === writer.channelKeyBase64 === verifier.channelKeyBase64
// The lookup id is same here, the channelKey may be used to verify the data, can also be used for the channel

writer.signKey // Allows the writer to sign messages, only privy to the writer
reader.decryptKey // Allows the reader to decrypt messages, only privy to the reader

writer.encryptKey.equals(receiver.encryptKey) // Key to encrypt messages, receiver _can_ write but not sign the message, thus it exists pro-forma
```

All objects create with `createChannel` are well de-/serializable:

```javascript
const { createChannel, Reader, Writer, Verifier } = require('@consento/crypto')
const { reader, writer, verifier } = createChannel()

new Reader(reader.toJSON())
new Writer(writer.toJSON())
new Verifier(verifier.toJSON())
```

### .verifier

Both the `.sender` and the `.receiver` object have a `.annoymous` field
to retreive an annonymous instance for the sender/receiver.

```javascript
const { writer, reader } = createChannel()
writer.verifier.verify(...)
reader.verifier.verify(...)
```

#### writer.encrypt(body)

Encrypt and sign a given input with the sender key.

- `body` - what you like to encrypt, any serializable object is possible

```javascript
const encrypted = writer.encrypt('secret message')
encrypted.signature // Uint8Array
encrypted.body // Uint8Array
```

#### writer.encryptOnly(body), reader.encryptOnly(body)

Only encrypt the body. This is only recommended in an environment where the
signature needs to be created at a different time!

- `body` - what you like to encrypt, any serializable object is possible

```javascript
const encrypted = writer.encrypt('secret message')
encrypted // Uint8Array with an encrypted message
```

#### writer.sign(data)

Signs a given data. This is only recommended in an environment where the
data was encrypted at a different time!

- `data` - Uint8Array for which a signature is wanted

```javascript
const signature = sender.sign(sender.encryptOnly('secret message'))
signature // Uint8Array with the signature of the encrypted message
```

#### verifier.verify(signature, body)

Using the annonymous object we can verify a given data.

- `signature` - `Uint8Array` with the signature for the `body`
- `body` - `Uint8Array` with of the encrypted data.

```javascript
const encrypted = writer.encrypt('hello world')
const bool = verifier.verify(encrypted.signature, encrypted.body)
```

#### verifier.verifyMessage(message)

As a short-cut its also possible to just verify a message

- `message` - `{ signature: Uint8Array, body: Uint8Array }`

```javascript
const bool = verifier.verifyMessage(message)
```

#### reader.decrypt(encrypted)

Get the content of a once encrypted message.

- `encrypted` - `{ signature: Uint8Array, body: Uint8Array }` as created by `writer.encrypt` or `Uint8Array` created with `writer.encryptOnly`

```javascript
const message = reader.decrypt(message:)
```

## Creating a handshake

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
    const { sender: bobToAliceSender, receiver: aliceToBobReceiver } = bob.finalize(finalMessage)
    ```

Now **A**lice and **B**ob have each two channels: one to send data to, one to receive data from.

```javascript
bobToAliceReceiver.decrypt(aliceToBobSender.encrypt('Hello Bob!')).body // Hello Bob!
aliceToBobReceiver.decrypt(bobToAliceSender.encrypt('Hello Alice!')).body // Hello Alice!
```

## Blob Support

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
