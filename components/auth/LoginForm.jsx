'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  IconEye, IconEyeOff,
  IconLock, IconMail, IconAlertCircle, IconCircleCheck,
  IconMoon, IconSun,
} from '@tabler/icons-react'
import { useUiStore } from '@/store/uiStore'
import { getLandingPath } from '@/lib/permissions'
import Button from '@/components/ui/Button'

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reason = params.get('error')
    if (reason === 'disabled') setAlert({ type: 'error', msg: 'Compte désactivé.' })
    if (reason === 'profile') setAlert({ type: 'error', msg: 'Profil introuvable.' })
    if (params.get('reset') === 'success') {
      setAlert({ type: 'success', msg: 'Mot de passe mis à jour. Vous pouvez vous connecter.' })
    }
  }, [])

  // ── Connexion ────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setAlert({ type: 'error', msg: 'Email et mot de passe requis.'})
      return
    }
    setLoading(true)
    setAlert(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('Login error:', error)
      const msg = error?.message || ''
      let detail = 'Connexion impossible pour le moment. Réessayez.'
      if (/invalid login credentials/i.test(msg)) {
        detail = 'Email ou mot de passe incorrect.'
      } else if (/email not confirmed/i.test(msg)) {
        detail = 'Confirmez votre adresse email avant de vous connecter.'
      } else if (/too many requests|rate limit/i.test(msg)) {
        detail = 'Trop de tentatives. Réessayez plus tard.'
      }
      setAlert({ type: 'error', msg: detail })
      setLoading(false)
      return
    }

    // Vérification compte actif
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAlert({ type: 'error', msg: 'Session introuvable.' })
      setLoading(false)
      return
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active, name, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      console.error('Profile check error:', profileError)
      setAlert({ type: 'error', msg: 'Impossible de vérifier votre profil.' })
      setLoading(false)
      return
    }

    if (profile.is_active === false) {
      await supabase.auth.signOut()
      setAlert({ type: 'error', msg: 'Compte désactivé.' })
      setLoading(false)
      return
    }

    router.push(getLandingPath(profile))
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

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/reset`
      : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset`

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        console.error('Forgot password error:', error)
        setAlert({
          type: 'error',
          msg: 'Impossible d\'envoyer l\'email pour le moment. Réessayez plus tard.',
        })
        return
      }
      setAlert({
        type: 'success',
        msg: 'Si cette adresse est associée à un compte, un email de réinitialisation a été envoyé.',
      })
    } catch (err) {
      console.error('Forgot password error:', err)
      setAlert({
        type: 'error',
        msg: 'Impossible d\'envoyer l\'email pour le moment. Réessayez plus tard.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">

      {/* ── Panneau formulaire ── */}
      <div className="login-panel">
        <Button
          type="button"
          variant="ghost" size="icon" className="theme-toggle login-theme-toggle"
          onClick={toggleTheme}
          aria-label="Basculer clair / sombre"
          title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
        >
          {theme === 'dark' ? <IconSun size={16}/> : <IconMoon size={16}/>}
        </Button>

        <div className="login-card">

        {/* ── Header ── */}
        <div className="login-header">
          <div className="login-logo">
            <img src="/connecteo-logo.png" alt="Connecteo" />
          </div>
            <div className="login-title">ARGOS</div>
            <div className="login-sub">
              {mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}
            </div>
          </div>

        {/* ── Alert (les 4 états : erreur, succès mdpo, compte désactivé, chargement via le bouton) ── */}
        {alert && (
          <div className={`login-alert ${alert.type}`} role="alert" aria-live="polite">
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

            {/* Règle métier : « Rester connecté » (UI only, non persisté) — rangée de boutons modernes */}
            <div className="login-options">
              <label className="login-remember">
                <input type="checkbox" name="stay" defaultChecked={false}/>
                <span className="remember-switch" aria-hidden="true">
                  <span className="remember-switch-knob"/>
                </span>
                <span>Rester connecté</span>
              </label>
              <Button
                type="button"
                variant="outline" className="login-ghost-btn"
                onClick={() => { setMode('forgot'); setAlert(null) }}
              >
                Mot de passe oublié ?
              </Button>
            </div>

            <Button type="submit" className="login-btn" loading={loading} aria-busy={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>
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

            <Button type="submit" className="login-btn" loading={loading} aria-busy={loading}>
              {loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
            </Button>

            {/* Règle métier : retour au mode connexion depuis le mode mdpo */}
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