'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  IconEye, IconEyeOff, IconLoader2,
  IconLock, IconMail, IconAlertCircle, IconCircleCheck,
  IconMoon, IconSun,
} from '@tabler/icons-react'
import { useUiStore } from '@/store/uiStore'

export default function LoginForm() {
  const router   = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useUiStore()

  const [mode, setMode]       = useState('login')   // 'login' | 'forgot'
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert]     = useState(null)       // { type, msg }

  // ── Connexion ────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setAlert({ type: 'error', msg: 'Veuillez renseigner l\'email et le mot de passe.' })
      return
    }
    setLoading(true)
    setAlert(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setAlert({ type: 'error', msg: 'Email ou mot de passe incorrect.' })
      setLoading(false)
      return
    }

    // Vérification compte actif
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active, name')
      .eq('id', user.id)
      .single()

    if (!profile?.is_active) {
      await supabase.auth.signOut()
      setAlert({ type: 'error', msg: 'Votre compte est désactivé. Contactez l\'administrateur.' })
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  // ── Mot de passe oublié ───────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    if (!email) {
      setAlert({ type: 'error', msg: 'Veuillez renseigner votre adresse email.' })
      return
    }
    setLoading(true)
    setAlert(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset`,
    })

    setLoading(false)
    if (error) {
      setAlert({ type: 'error', msg: 'Erreur lors de l\'envoi. Vérifiez l\'adresse email.' })
    } else {
      setAlert({ type: 'success', msg: 'Un email de réinitialisation a été envoyé.' })
    }
  }

  return (
    <div className="login-page login-split">

      {/* ── Panneau marque (desktop) ── */}
      <div className="login-brand">
        <div className="brand-orb brand-orb-a"/>
        <div className="brand-orb brand-orb-b"/>
        <div className="brand-noise"/>

        <div className="brand-badge">Connecteo · ERP Stock</div>
        <div className="brand-title">Votre stock,<br/><em>en temps réel.</em></div>
        <div className="brand-meta">
          Valorisation CUMP, inventaires multi-dépôts et alertes de seuils — réunis dans une seule vue claire et auditable.
        </div>

        <ul className="brand-points">
          <li><IconCircleCheck size={15}/> Suivi comptable produits &amp; valeur d’acquisition</li>
          <li><IconCircleCheck size={15}/> Calculs d’amortissement automatiques</li>
          <li><IconCircleCheck size={15}/> Rapports et analyses par catégorie</li>
        </ul>

        <div className="brand-chart" role="presentation" aria-hidden="true">
          <span style={{ '--d': '.02s' }}/>
          <span style={{ '--d': '.08s' }}/>
          <span style={{ '--d': '.04s' }}/>
          <span style={{ '--d': '.12s' }}/>
          <span style={{ '--d': '.06s' }}/>
          <span style={{ '--d': '.1s' }}/>
          <span style={{ '--d': '.03s' }}/>
          <span style={{ '--d': '.09s' }}/>
        </div>

        <div className="brand-foot">© {new Date().getFullYear()} Connecteo — Suivi des stocks & comptabilité</div>
      </div>

      {/* ── Panneau formulaire ── */}
      <div className="login-panel">
        <button
          type="button"
          className="theme-toggle login-theme-toggle"
          onClick={toggleTheme}
          aria-label="Basculer clair / sombre"
          title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
        >
          {theme === 'dark' ? <IconSun size={16}/> : <IconMoon size={16}/>}
        </button>

        <div className="login-card">

        {/* ── Header ── */}
        <div className="login-header">
          <div className="login-logo">
            {/* Remplacer par le logo base64 de index.html si disponible */}
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="white" fillOpacity=".15"/>
              <path d="M8 20C8 13.373 13.373 8 20 8C26.627 8 32 13.373 32 20"
                stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M32 20C32 26.627 26.627 32 20 32C13.373 32 8 26.627 8 20"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4"/>
              <circle cx="20" cy="20" r="5" fill="white"/>
            </svg>
          </div>
          <div className="login-title">Connecteo Stock</div>
          <div className="login-sub">
            {mode === 'login'
              ? 'Connectez-vous à votre espace de gestion'
              : 'Réinitialiser votre mot de passe'}
          </div>
        </div>

        {/* ── Alert ── */}
        {alert && (
          <div className={`login-alert ${alert.type}`}>
            {alert.type === 'error'
              ? <IconAlertCircle size={16} style={{ flexShrink: 0 }}/>
              : <IconCircleCheck size={16} style={{ flexShrink: 0 }}/>}
            <span>{alert.msg}</span>
          </div>
        )}

        {/* ── Formulaire Login ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <div className="input-wrap">
                <IconMail size={16} className="input-prefix-icon"/>
                <input
                  type="email"
                  className="form-input with-prefix"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div className="input-wrap">
                <IconLock size={16} className="input-prefix-icon"/>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-input with-prefix"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPass(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="input-suffix"
                  onClick={() => setShowPwd(!showPwd)}
                  tabIndex={-1}
                >
                  {showPwd ? <IconEyeOff size={16}/> : <IconEye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading
                ? <><IconLoader2 size={18} className="btn-spinner"/>Connexion…</>
                : 'Se connecter'}
            </button>

            <div className="login-footer">
              <a
                href="#"
                onClick={e => { e.preventDefault(); setMode('forgot'); setAlert(null) }}
              >
                Mot de passe oublié ?
              </a>
            </div>
          </form>
        )}

        {/* ── Formulaire Forgot ── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot}>
            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <div className="input-wrap">
                <IconMail size={16} className="input-prefix-icon"/>
                <input
                  type="email"
                  className="form-input with-prefix"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading
                ? <><IconLoader2 size={18} className="btn-spinner"/>Envoi…</>
                : 'Envoyer le lien de réinitialisation'}
            </button>

            <div className="login-footer">
              <a
                href="#"
                onClick={e => { e.preventDefault(); setMode('login'); setAlert(null) }}
              >
                ← Retour à la connexion
              </a>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}