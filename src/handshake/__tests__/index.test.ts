import { IReader, IWriter, IEncryptedMessage, IHandshakeAcceptMessage } from '../../types'
import { IEncodable } from '../../util/types'
import { exists } from '../../util'
import { initHandshake, acceptHandshake, HandshakeAccept, HandshakeInit, HandshakeConfirmation } from '..'

const channels: { [key: string]: (msg: IEncryptedMessage) => void } = {}

function listenTo (receiver: IReader, handler: (msg: IEncodable, unlisten?: () => void) => any): () => void {
  const unlisten = (): any => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete channels[receiver.verifier.verifyKeyHex]
  }
  const handlerRaw = (msg: IEncryptedMessage): void => {
    const decryption = receiver.decrypt(msg)
    if ('body' in decryption) {
      handler(decryption.body, unlisten)
    } else {
      throw new Error(decryption.error)
    }
  }
  channels[receiver.verifier.verifyKeyHex] = handlerRaw
  return unlisten
}
function listenOnce (receiver: IReader, handler: (msg: IEncodable) => any): () => void {
  return listenTo(receiver, (msg, unlisten) => {
    if (exists(unlisten)) {
      unlisten()
    }
    handler(msg)
  })
}
function sendTo (sender: IWriter, msg: IEncodable): void {
  const { verifier: { verifyKeyHex: idHex } } = sender
  if (channels[idHex] === undefined) {
    throw new Error(`Unknown channel ${idHex}`)
  }
  const message = sender.encrypt(msg)
  channels[idHex](message)
}

class Counter {
  current: number

  constructor () {
    this.current = 1
  }

  next (next: number): void {
    expect(this.current).toBe(next - 1)
    this.current = next
  }
}

describe('Handshake', () => {
  it('examplary handshake', () => {
    const counter = new Counter()
    // ALICE
    const alice = initHandshake()
    listenOnce(alice.receiver, (acceptMessage): void => {
      counter.next(2)
      const { connection: { writer: sender, reader: receiver }, finalMessage } = alice.confirm(acceptMessage as IHandshakeAcceptMessage)
      listenOnce(receiver, message => {
        counter.next(4)
        expect(message).toBe('Hello Alice')
        sendTo(sender, 'Hello Bob')
      })
      sendTo(sender, finalMessage)
    })

    // BOB
    const bob = acceptHandshake(alice.firstMessage)
    listenOnce(bob.reader, (finalMessage): void => {
      counter.next(3)
      const { writer: sender, reader: receiver } = bob.finalize(finalMessage as Uint8Array)
      listenOnce(receiver, (msg): void => {
        counter.next(5)
        expect(msg).toBe('Hello Bob')
      })
      sendTo(sender, 'Hello Alice')
    })
    sendTo(bob.writer, bob.acceptMessage)
    expect(counter.current).toBe(5)
  })
  it('serialization', () => {
    const counter = new Counter()
    // ALICE
    const aliceOriginal = initHandshake()
    const alice = new HandshakeInit(aliceOriginal.toJSON())
    listenOnce(alice.receiver, acceptMessage => {
      counter.next(2)
      const confirmationOriginal = alice.confirm(acceptMessage as IHandshakeAcceptMessage)
      const confirmation = new HandshakeConfirmation(confirmationOriginal.toJSON())
      const { connection: { writer: sender, reader: receiver }, finalMessage } = confirmation
      listenOnce(receiver, message => {
        counter.next(4)
        expect(message).toBe('Hello Alice')
        sendTo(sender, 'Hello Bob')
      })
      sendTo(sender, finalMessage)
    })

    // BOB
    const bobOriginal = acceptHandshake(alice.firstMessage)
    const bob = new HandshakeAccept(bobOriginal.toJSON())
    listenOnce(bob.reader, finalMessage => {
      counter.next(3)
      const { writer: sender, reader: receiver } = bob.finalize(finalMessage as Uint8Array)
      listenOnce(receiver, msg => {
        counter.next(5)
        expect(msg).toBe('Hello Bob')
      })
      sendTo(sender, 'Hello Alice')
    })
    sendTo(bob.writer, bob.acceptMessage)
    expect(counter.current).toBe(5)
  })
})
