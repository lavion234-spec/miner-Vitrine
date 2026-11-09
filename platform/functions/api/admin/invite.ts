import { createClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  PUBLIC_SITE_URL?: string
}

interface PagesContext {
  request: Request
  env: Env
}

interface InviteRequest {
  email?: string
  display_name?: string
  role?: 'ADMIN' | 'EDITOR'
}

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return Response.json({ error: 'Autenticacao necessaria.' }, { status: 401 })

  let payload: InviteRequest
  try {
    payload = await request.json() as InviteRequest
  } catch {
    return Response.json({ error: 'Corpo JSON invalido.' }, { status: 400 })
  }

  const email = payload.email?.trim().toLowerCase() ?? ''
  const role = payload.role
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (role !== 'ADMIN' && role !== 'EDITOR')) {
    return Response.json({ error: 'Informe um email valido e a funcao ADMIN ou EDITOR.' }, { status: 400 })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return Response.json({ error: 'Sessao invalida.' }, { status: 401 })

  const { data: requester } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()
  if (requester?.role !== 'OWNER') return Response.json({ error: 'Somente OWNER pode convidar usuarios.' }, { status: 403 })

  const siteUrl = env.PUBLIC_SITE_URL ?? new URL(request.url).origin
  const { data: invitation, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { display_name: (payload.display_name ?? '').trim().slice(0, 100) },
    redirectTo: `${siteUrl}/admin/`,
  })
  if (inviteError || !invitation.user) return Response.json({ error: inviteError?.message ?? 'Falha ao criar convite.' }, { status: 400 })

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: invitation.user.id,
    email,
    display_name: (payload.display_name ?? '').trim().slice(0, 100),
    role,
  })
  if (profileError) return Response.json({ error: 'Convite criado, mas a funcao nao foi atribuida. Consulte o OWNER.' }, { status: 500 })

  return Response.json({ invited: true, email, role }, { status: 201 })
}