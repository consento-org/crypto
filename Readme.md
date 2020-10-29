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

## Sending/Receiving encrypted messages

The crypto library contains useful primitives for sending e2e encrypted
messages through public channels:


```javascript
const { createReceiver } = setup(sodium)
```

You can create a new communication channel by creating a new receiver:

```javascript
const receiver = await createReceiver()
receiver.receiveKey // allows decryption of messages
receiver.sender.sendKey // encryption key for sending messages
receiver.sender.annonymous.id // public channel id - can be shared with other people - also used to verify if a message was properly sent.
receiver.sender.id // shortcut on the sender for the channel id
receiver.id // shortcut on the receiver for the channel id
```

### Permission layers

A `Receiver` &gt; `Sender` &gt; `Annonymous` and there are methods to create a receiver/annonymous
instance out of a sender instance:

```javascript
const { createReceiver } = setup(sodium)
const receiver = await createReceiver()
```

you can also destruct each instance:

```javascript
const { receiver, sender, annonymous } = await createReceiver()
```

Every instance can verify a given message for a channel:

```javascript
const bool = await annonymous.verify(signature: Uint8Array, body: Uint8Array)
const bool2 = await annonymous.verifyMessage(message: IEncryptedMessage)
```

Only receivers and senders can decrypt a message:

```javascript
const message = await receiver.decrypt(message: IEncryptedMessage)
```

since signing is not the same as encrypting, it is also possible to sign messages for receivers.

```javascript
const signature = await receiver.sign(message: Uint8Array)
```

but only senders are able to encrypt messages.

```javascript
const encrypted: IEncryptedMessage = await sender.encrypt(message)
```

you can also encrypt a message without signing.

```javascript
const encrypted: Uint8Array = await sender.encryptOnly(message)
```

and decrypt this message:

```javascript
const message = await sender.decrypt(uint8Array)
```

### De-/Serialization

The default created Sender/Receiver/Annonymous instances can be serialized/deserialized
using common JSON structs:

```javascript
const { Receiver } = setup(sodium)
const receiverJson = receiver.toJSON()
const restoredReceiver = new Receiver(json)
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
