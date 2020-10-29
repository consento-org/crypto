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

## Setup the crypto system

In order to be quick in node.js and have a functional react-native-compatible implementation
`@consento/crypto` comes with two variants of crypto functions.

- `sodium` that uses a [modified version](https://github.com/consento-org/libsodium.js) of `libsodium.js` which runs on react-native
- `friends` that uses a [`sodium-universal`](https://github.com/sodium-friends/sodium-universal) from [`sodium-friends`](https://github.com/sodium-friends) which runs efficiently on `node.js` and in the browser.

To get access to the actual API you will always need to run setup first:

```javascript
import { setup } from '@consento/crypto'
import { sodium } from '@consento/crypto/core/sodium'
import { friends } from '@consento/crypto/core/friends'

const cryptoFriends = setup(friends) // sodium-universal variant of crypto
const cryptoSodium = setup(sodium) // libsodium.js variant of crypto
```

## Vocabulary

- `Channel` - an e2e encrypted setup consisting of one `Receiver` and one `Sender`
- `Sender` - an object containing the keys that allow to encrypt data
- `Receiver` - an object containing the keys that allow to decrypt data created by the `Sender`
- `Connection` - an e2e encrypted setup consisting of the `Receiver` of one channel and the `Sender` of another.
- `Annonymous` - an object describing an the capability to verify if a message is part of a `Channel`
- `Blob` - a self-contained piece of data, like an image or pdf.
- `Handshake` - the process to connect two separate processes/devices resulting in a `Connection` for each process.

## Sending/Receiving encrypted messages

The crypto library contains useful primitives for sending e2e encrypted messages through public channels.

```javascript
const { createChannel } = setup(sodium)
const { receiver, sender } = createChannel()

const encrypted = sender.encrypt('hello world')
const decrypted = receiver.decrypt(encrypted)

decrypted.body === 'hello world'
```

You can create a new communication channel with the simple `createChannel` method.

```javascript
const channel = await createChannel()
const { receiver } = channel // Can decrypt messages; _could_ encrypt messages, but these would not be signed and rejected!
const { sender } = channel // Can only encrypt messages.
const { annonymous } = channel // Object that can verify messages but not de-/encrypt messages.

receiver.receiveKey // To backup/restore the receiver
sender.sendKey // To backup/restore the sender
annonymous.idBase64 === receiver.idBase64 === sender.idBase64 // The lookup id is same here

sender.encryptKey === receiver.encryptKey // Key to encrypt messages

receiver.decryptKey // Allows the receiver to decrypt messages
sender.signKey // Allows the sender to sign messages

receiver.receiveKey // allows decryption of messages
receiver.annonymous.id // public channel id - can be shared with other people - also used to verify if a message was properly sent.
receiver.id // shortcut on the sender for the channel id
```

All objects create with `createChannel` are well de-/serializable:

```javascript
const { createChannel, Receiver, Sender, Annonymous } = setup(sodium)
const { receiver, sender, annonymous } = await createChannel()

new Receiver(receiver.toJSON())
new Sender(sender.toJSON())
new Annonymous(annonymous.toJSON())
```

### .annonymous

Both the `.sender` and the `.receiver` object have a `.annoymous` field
to retreive an annonymous instance for the sender/receiver.

```javascript
const { receiver, sender } = await createChannel()
receiver.annonymous.idBase64 === sender.annonymous.idBase64
```

#### sender.encrypt(body)

Encrypt and sign a given input with the sender key.

- `body` - what you like to encrypt, any serializable object is possible

```javascript
const encrypted = await sender.encrypt('secret message')
encrypted.signature // Uint8Array
encrypted.body // Uint8Array
```

#### sender.encryptOnly(body)

Only encrypt the body. This is only recommended in an environment where the
signature needs to be created at a different time!

- `body` - what you like to encrypt, any serializable object is possible

```javascript
const encrypted = await sender.encrypt('secret message')
encrypted // Uint8Array with an encrypted message
```

#### sender.sign(data)

Signs a given data. This is only recommended in an environment where the
data was encrypted at a different time!

- `data` - Uint8Array for which a signature is wanted

```javascript
const signature = await sender.sign((await sender.encrypt('secret message')).body)
signature // Uint8Array with the signature of the encrypted message
```

#### annonymous.verify(signature, body)

Using the annonymous object we can verify a given data.

- `signature` - `Uint8Array` with the signature for the `body`
- `body` - `Uint8Array` with of the encrypted data.

```javascript
const encrypted = await sender.encrypt('hello world')
const bool = await annonymous.verify(encrypted.signature, encrypted.body)
```

#### annonymous.verifyMessage(message)

As a short-cut its also possible to just verify a message

- `message` - `{ signature: Uint8Array, body: Uint8Array }`

```javascript
const bool = await annonymous.verifyMessage(message)
```

#### receiver.decrypt(encrypted)

Get the content of a once encrypted message.

- `encrypted` - `{ signature: Uint8Array, body: Uint8Array }` as created by `sender.encrypt` or `Uint8Array` created with `sender.encryptOnly`

```javascript
const message = await receiver.decrypt(message:)
```

## Creating a handshake

`crypto` also holds primitives for a decentralized handshake mechanism.

```javascript
const { initHandshake, acceptHandshake } = setup(sodium)
```

`initHandshake` is to be used by the first person - "**A**lice".

`acceptHandshake` is to be used by the second person - "**B**ob".

How the handshake works:

1. **A**lice needs to create the initial message:

    ```javascript
    const alice = await initHandshake()
    const initMessage = alice.firstMessage
    ```

2. **A**lice needs to listen to the channel with the id `alice.receiver.id` for answers that may come from **B**ob.
3. **A**lice needs to send hand the initial message to **B**ob using any means. (QR Code, Email,...)
4. **B**ob needs to receive the initial message

    ```javascript
    const bob = await acceptHandshake(firstMessage)
    ```

5. **B**ob needs to listen to the channel with the id `bob.receiver.id` for the final message from **A**lice.
6. **B**ob needs to send the message, encrypted to the channel with the id: `bob.sender.id`:

    ```javascript
    await bob.sender.encrypt(bob.acceptMessage)
    ```

7. **A**lice has to receive the acception message and can generate the channels out of it.

    ```javascript
    const decryptedAcceptMessage = (await alice.receiver.decryptMessage(acceptMessage)).body
    const package = await confirmHandshake(alice, decryptedAcceptMessage)
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
    await aliceToBobSender.encrypt(finalMessage)
    ```

9. **B**ob can now finalize the handshake

    ```javascript
    const { sender: bobToAliceSender, receiver: aliceToBobReceiver } = await bob.finalize(finalMessage)
    ```

Now **A**lice and **B**ob have each two channels: one to send data to, one to receive data from.

```javascript
(await bobToAliceReceiver.decrypt(await aliceToBobSender.encrypt('Hello Bob!')).body // Hello Bob!
(await aliceToBobReceiver.decrypt(await bobToAliceSender.encrypt('Hello Alice!'))).body // Hello Alice!
```

## Blob Support

The crypto api also provides primitives for working with encrypted blobs:

```javascript
const { encryptBlob, decryptBlob, isEncryptedBlob } = setup(sodium)

const {
  blob, // Information about a blob: to pass around
  encrypted // Encrypted data to be stored
} = await encryptBlob('Hello Secret!')
blob.path // Path at which to store the encrypted data
blob.secretKey // Secretkey to decrypt this data
blob.size // Number of bytes of the encrypted blob (only available after encryption)

isEncryptedBlob(blob) // To verify if a set of data is a blob

const decrypted = await decryptBlob(blob.secretKey, encrypted)
```

Blob information is serializable with `toJSON` and deserializable using `toEncryptedBlob`.

```javascript
const { encryptBlob, decryptBlob, toEncryptedBlob } = setup(sodium)

const { blob } = await encryptBlob('Hello Secret!')
const blobJSON = blob.toJSON()
const sameBlob = toEncryptedBlob(blobJSON)
```

It is possible to restore a blob from it's `secretKey` but that requires async computation:

```javascript
const { encryptBlob, decryptBlob, toEncryptedBlob } = setup(sodium)

const { blob } = await encryptBlob('Hello Secret!')
const sameBlob = await toEncryptedBlob(blob.secretKey)
```

## License

[MIT](./LICENSE)
