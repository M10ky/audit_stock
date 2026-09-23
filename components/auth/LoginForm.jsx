'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  IconEye, IconEyeOff, IconLoader2,
  IconLock, IconMail, IconAlertCircle, IconCircleCheck,
  IconMoon, IconSun, IconChartLine,
} from '@tabler/icons-react'
import { useUiStore } from '@/store/uiStore'
import KpiCard from '@/components/ui/KpiCard'
import ArgosLogo from '@/components/ui/ArgosLogo'

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
      setAlert({ type: 'error', msg: 'Email et mot de passe requis.'})
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
        {/* Règle métier : logo réel ARGOS — plus d'orbes flous ni de noise décorative */}
        <div className="brand-emblem">
          <ArgosLogo size={42} />
          <span>ARGOS</span>
        </div>
        <div className="brand-title">Votre stock,<br/><em>en temps réel.</em></div>
        <div className="brand-meta">Inventaire, valorisation et alertes en une vue.</div>

        {/* Règle métier : mini-carte KpiCard (signature visuelle de l'app) à la place de l'ancien graphique décoratif */}
        <div className="brand-kpi">
          <KpiCard
            icon={IconChartLine}
            color="teal"
            accent="var(--teal)"
            value="—"
            label="Valeur du stock"
            sub="Disponible après connexion"
          />
        </div>

        <ul className="brand-points">
          <li><IconCircleCheck size={15}/> Valorisation CUMP</li>
          <li><IconCircleCheck size={15}/> Amortissement automatique</li>
          <li><IconCircleCheck size={15}/> Rapports par catégorie</li>
        </ul>

        {/* Règle métier : "Connecteo" seul autorisé (entreprise), nom produit = ARGOS */}
        <div className="brand-foot">© {new Date().getFullYear()} Connecteo</div>
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
            <ArgosLogo size={40} monochrome />
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

            {/* Règle métier : « Rester connecté » aligné sur la même ligne que le lien mdpo (UI only, non persisté) */}
            <div className="login-options">
              <label className="login-remember">
                <input type="checkbox" name="stay" defaultChecked={false}/>
                <span>Rester connecté</span>
              </label>
              <a
                href="#"
                onClick={e => { e.preventDefault(); setMode('forgot'); setAlert(null) }}
              >
                Mot de passe oublié ?
              </a>
            </div>

            <button type="submit" className="login-btn" disabled={loading} aria-busy={loading}>
              {loading
                ? <><IconLoader2 size={18} className="btn-spinner"/>Connexion…</>
                : 'Se connecter'}
            </button>
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

            <button type="submit" className="login-btn" disabled={loading} aria-busy={loading}>
              {loading
                ? <><IconLoader2 size={18} className="btn-spinner"/>Envoi…</>
                : 'Envoyer le lien de réinitialisation'}
            </button>

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