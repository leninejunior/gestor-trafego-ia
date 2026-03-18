// Mock completo do Supabase client para testes
export const createClient = jest.fn(() => {
  const mockQueryBuilder = {
    select: jest.fn(() => mockQueryBuilder),
    insert: jest.fn(() => mockQueryBuilder),
    update: jest.fn(() => mockQueryBuilder),
    delete: jest.fn(() => mockQueryBuilder),
    upsert: jest.fn(() => mockQueryBuilder),
    order: jest.fn(() => mockQueryBuilder),
    lte: jest.fn(() => mockQueryBuilder),
    ilike: jest.fn(() => mockQueryBuilder),
    lt: jest.fn(() => mockQueryBuilder),
    eq: jest.fn(() => mockQueryBuilder),
    in: jest.fn(() => mockQueryBuilder),
    gte: jest.fn(() => mockQueryBuilder),
    gt: jest.fn(() => mockQueryBuilder),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    range: jest.fn(() => mockQueryBuilder),
    limit: jest.fn(() => mockQueryBuilder),
    data: [],
    error: null
  };

  return {
    from: jest.fn(() => mockQueryBuilder),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithPassword: jest.fn(() => Promise.resolve({ data: null, error: null })),
      signUp: jest.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      refreshSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null }))
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
        remove: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    },
    functions: {
      invoke: jest.fn(() => Promise.resolve({ data: null, error: null }))
    },
    // Adicionar método rpc para consultas diretas
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null }))
  };
});

// Mock do cliente real para uso em testes
export const mockSupabaseClient = createClient();