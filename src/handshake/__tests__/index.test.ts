import { setup } from '../../setup'
import { cores } from '../../core/cores'
import { IReceiver, ISender, IEncryptedMessage, IHandshakeAcceptMessage } from '../../types'
import { IEncodable } from '../../util/types'
import { exists } from '../../util'

const channels: { [key: string]: (msg: IEncryptedMessage) => Promise<void> } = {}

function listenTo (receiver: IReceiver, handler: (msg: IEncodable, unlisten?: () => void) => any): () => void {
  const unlisten = (): any => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete channels[receiver.annonymous.idHex]
  }
  const handlerRaw = async (msg: IEncryptedMessage): Promise<void> => {
    const decryption = await receiver.decrypt(msg)
    if ('body' in decryption) {
      await handler(decryption.body, unlisten)
    } else {
      throw new Error(decryption.error)
    }
  }
  channels[receiver.annonymous.idHex] = handlerRaw
  return unlisten
}
function listenOnce (receiver: IReceiver, handler: (msg: IEncodable) => any): () => void {
  return listenTo(receiver, async (msg, unlisten) => {
    if (exists(unlisten)) {
      unlisten()
    }
    await handler(msg)
  })
}
async function sendTo (sender: ISender, msg: IEncodable): Promise<void> {
  const { annonymous: { idHex } } = sender
  if (channels[idHex] === undefined) {
    throw new Error(`Unknown channel ${idHex}`)
  }
  const message = await sender.encrypt(msg)
  await channels[idHex](message)
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

for (const { name, crypto } of cores) {
// for (const { name, crypto } of [{ name: 'friends', crypto: friends }]) {
  const variant = setup(crypto)
  describe(`${name}: Handshake`, () => {
    const { initHandshake, acceptHandshake, HandshakeAccept, HandshakeInit, HandshakeConfirmation } = variant
    it('examplary handshake', async () => {
      const counter = new Counter()
      // ALICE
      const alice = await initHandshake()
      listenOnce(alice.receiver, async (acceptMessage): Promise<void> => {
        counter.next(2)
        const { connection: { sender, receiver }, finalMessage } = await alice.confirm(acceptMessage as IHandshakeAcceptMessage)
        listenOnce(receiver, async message => {
          counter.next(4)
          expect(message).toBe('Hello Alice')
          await sendTo(sender, 'Hello Bob')
        })
        await sendTo(sender, finalMessage)
      })

      // BOB
      const bob = await acceptHandshake(alice.firstMessage)
      listenOnce(bob.receiver, async (finalMessage): Promise<void> => {
        counter.next(3)
        const { sender, receiver } = await bob.finalize(finalMessage as Uint8Array)
        listenOnce(receiver, async (msg): Promise<void> => {
          counter.next(5)
          expect(msg).toBe('Hello Bob')
        })
        await sendTo(sender, 'Hello Alice')
      })
      await sendTo(bob.sender, bob.acceptMessage)
      expect(counter.current).toBe(5)
    })
    it('serialization', async () => {
      const counter = new Counter()
      // ALICE
      const aliceOriginal = await initHandshake()
      const alice = new HandshakeInit(aliceOriginal.toJSON())
      listenOnce(alice.receiver, async (acceptMessage): Promise<void> => {
        counter.next(2)
        const confirmationOriginal = await alice.confirm(acceptMessage as IHandshakeAcceptMessage)
        const confirmation = new HandshakeConfirmation(confirmationOriginal.toJSON())
        const { connection: { sender, receiver }, finalMessage } = confirmation
        listenOnce(receiver, async message => {
          counter.next(4)
          expect(message).toBe('Hello Alice')
          await sendTo(sender, 'Hello Bob')
        })
        await sendTo(sender, finalMessage)
      })

      // BOB
      const bobOriginal = await acceptHandshake(alice.firstMessage)
      const bob = new HandshakeAccept(bobOriginal.toJSON())
      listenOnce(bob.receiver, async (finalMessage): Promise<void> => {
        counter.next(3)
        const { sender, receiver } = await bob.finalize(finalMessage as Uint8Array)
        listenOnce(receiver, async (msg): Promise<void> => {
          counter.next(5)
          expect(msg).toBe('Hello Bob')
        })
        await sendTo(sender, 'Hello Alice')
      })
      await sendTo(bob.sender, bob.acceptMessage)
      expect(counter.current).toBe(5)
    })
  })
}
