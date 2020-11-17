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
    handler(decryption, unlisten)
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
    const aliceHandshake = initHandshake()
    listenOnce(aliceHandshake.input, (acceptMessage): void => {
      counter.next(2)
      const { connection: aliceToBob, finalMessage } = aliceHandshake.confirm(acceptMessage as IHandshakeAcceptMessage)
      listenOnce(aliceToBob.input, message => {
        counter.next(4)
        expect(message).toBe('Hello Alice')
        sendTo(aliceToBob.output, 'Hello Bob')
      })
      sendTo(aliceToBob.output, finalMessage)
    })

    // BOB
    const bobAccept = acceptHandshake(aliceHandshake.firstMessage)
    listenOnce(bobAccept.input, (finalMessage): void => {
      counter.next(3)
      const bobToAlice = bobAccept.finalize(finalMessage as Uint8Array)
      listenOnce(bobToAlice.input, (msg): void => {
        counter.next(5)
        expect(msg).toBe('Hello Bob')
      })
      sendTo(bobToAlice.output, 'Hello Alice')
    })
    sendTo(bobAccept.output, bobAccept.acceptMessage)
    expect(counter.current).toBe(5)
  })
  it('serialization', () => {
    const counter = new Counter()
    // ALICE
    const aliceOriginal = initHandshake()
    const alice = new HandshakeInit(aliceOriginal.toJSON())
    listenOnce(alice.input, acceptMessage => {
      counter.next(2)
      const confirmationOriginal = alice.confirm(acceptMessage as IHandshakeAcceptMessage)
      const confirmation = new HandshakeConfirmation(confirmationOriginal.toJSON())
      const { connection, finalMessage } = confirmation
      listenOnce(connection.input, message => {
        counter.next(4)
        expect(message).toBe('Hello Alice')
        sendTo(connection.output, 'Hello Bob')
      })
      sendTo(connection.output, finalMessage)
    })

    // BOB
    const bobOriginal = acceptHandshake(alice.firstMessage)
    const bobAccept = new HandshakeAccept(bobOriginal.toJSON())
    listenOnce(bobAccept.input, finalMessage => {
      counter.next(3)
      const connection = bobAccept.finalize(finalMessage as Uint8Array)
      listenOnce(connection.input, msg => {
        counter.next(5)
        expect(msg).toBe('Hello Bob')
      })
      sendTo(connection.output, 'Hello Alice')
    })
    sendTo(bobAccept.output, bobAccept.acceptMessage)
    expect(counter.current).toBe(5)
  })
})
