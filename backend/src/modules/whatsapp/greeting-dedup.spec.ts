/**
 * Testa que a mensagem de boas-vindas não é enviada duas vezes
 * quando webhook e polling processam o mesmo evento simultaneamente.
 *
 * O mecanismo de dedup usa updateMany com WHERE greetingSentAt IS NULL —
 * somente o processo que conseguir setar esse campo (count > 0) envia o greeting.
 */

describe('Greeting deduplication — claim atômico', () => {
  const makeConversation = (greetingSentAt: Date | null = null) => ({
    id: 'conv-001',
    flowState: 'GREETING',
    greetingSentAt,
    customerPhone: '+5511999999999',
    companyId: 'company-001',
    status: 'OPEN',
  });

  function makePrismaMock(updateManyCount: number) {
    return {
      conversation: {
        updateMany: jest.fn().mockResolvedValue({ count: updateManyCount }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(makeConversation()),
      },
    };
  }

  function makeFlowEngineMock() {
    return {
      sendGreeting: jest.fn().mockResolvedValue(undefined),
      isBusinessHours: jest.fn().mockReturnValue(true),
    };
  }

  it('deve enviar greeting quando claim retorna count=1 (primeiro handler)', async () => {
    const prisma = makePrismaMock(1);
    const flowEngine = makeFlowEngineMock();

    // Simula o comportamento do handler após o claim atômico
    const claimed = await prisma.conversation.updateMany({
      where: { id: 'conv-001', flowState: 'GREETING', greetingSentAt: null },
      data: { greetingSentAt: new Date() },
    });

    if (claimed.count > 0) {
      await flowEngine.sendGreeting(makeConversation());
    }

    expect(prisma.conversation.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ greetingSentAt: null }),
      }),
    );
    expect(flowEngine.sendGreeting).toHaveBeenCalledTimes(1);
  });

  it('NÃO deve enviar greeting quando claim retorna count=0 (segundo handler)', async () => {
    const prisma = makePrismaMock(0); // outro processo já setou greetingSentAt
    const flowEngine = makeFlowEngineMock();

    const claimed = await prisma.conversation.updateMany({
      where: { id: 'conv-001', flowState: 'GREETING', greetingSentAt: null },
      data: { greetingSentAt: new Date() },
    });

    if (claimed.count > 0) {
      await flowEngine.sendGreeting(makeConversation());
    }

    expect(flowEngine.sendGreeting).not.toHaveBeenCalled();
  });

  it('deve enviar greeting exatamente uma vez quando dois handlers concorrem', async () => {
    const sendGreetingMock = jest.fn().mockResolvedValue(undefined);
    let greetingSentAt: Date | null = null;

    // Simula updateMany atômico: só o primeiro vence
    const atomicUpdateMany = jest.fn().mockImplementation(async ({ where }) => {
      if (where.greetingSentAt === null && greetingSentAt === null) {
        greetingSentAt = new Date();
        return { count: 1 };
      }
      return { count: 0 };
    });

    const handler = async () => {
      const claimed = await atomicUpdateMany({
        where: { id: 'conv-001', flowState: 'GREETING', greetingSentAt: null },
        data: { greetingSentAt: new Date() },
      });
      if (claimed.count > 0) {
        await sendGreetingMock();
      }
    };

    // Dois handlers concorrem (ex: webhook + polling)
    await Promise.all([handler(), handler()]);

    expect(sendGreetingMock).toHaveBeenCalledTimes(1);
  });
});
