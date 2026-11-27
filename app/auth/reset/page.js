'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  IconAlertCircle, IconCircleCheck,
  IconEye, IconEyeOff, IconLock, IconMoon, IconSun,
} from '@tabler/icons-react'
import { useUiStore } from '@/store/uiStore'
import Button from '@/components/ui/Button'

export default function ResetPasswordPage() {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { theme, toggleTheme } = useUiStore()

  const [status, setStatus] = useState('checking')   // 'checking' | 'ready' | 'invalid'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert]     = useState(null)       // { type, msg }

  useEffect(() => {
    let active = true
    const verify = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (active) setStatus(session?.user ? 'ready' : 'invalid')
    }
    verify()
    return () => { active = false }
  }, [supabase])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      setAlert({ type: 'error', msg: 'Le mot de passe doit contenir au moins 8 caractères.' })
      return
    }
    if (password !== confirm) {
      setAlert({ type: 'error', msg: 'Les deux mots de passe ne correspondent pas.' })
      return
    }
    setLoading(true)
    setAlert(null)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        console.error('Reset password error:', error)
        setAlert({
          type: 'error',
          msg: 'Impossible d\'enregistrer le nouveau mot de passe. Le lien est peut-être invalide ou expiré.',
        })
        return
      }
      await supabase.auth.signOut()
      setAlert({ type: 'success', msg: 'Mot de passe mis à jour. Redirection…' })
      setTimeout(() => router.push('/login?reset=success'), 900)
    } catch (err) {
      console.error('Reset password error:', err)
      setAlert({ type: 'error', msg: 'Impossible d\'enregistrer le nouveau mot de passe. Réessayez.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
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
          <div className="login-header">
            <div className="login-logo">
              <img src="/connecteo-logo.png" alt="Connecteo" />
            </div>
            <div className="login-title">ARGOS</div>
            <div className="login-sub">Nouveau mot de passe</div>
          </div>

          {alert && (
            <div className={`login-alert ${alert.type}`} role="alert" aria-live="polite">
              {alert.type === 'error'
                ? <IconAlertCircle size={16} style={{ flexShrink: 0 }}/>
                : <IconCircleCheck size={16} style={{ flexShrink: 0 }}/>}
              <span>{alert.msg}</span>
            </div>
          )}

          {status === 'checking' && (
            <p className="login-hint">Vérification du lien…</p>
          )}

          {status === 'invalid' && (
            <>
              <div className="login-alert error" role="alert">
                <IconAlertCircle size={16} style={{ flexShrink: 0 }}/>
                <span>Lien invalide ou expiré.</span>
              </div>
              <div className="login-footer">
                <a href="/login">← Retour à la connexion</a>
              </div>
            </>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-password">Nouveau mot de passe</label>
                <div className="input-wrap">
                  <IconLock size={16} className="input-prefix-icon"/>
                  <input
                    id="reset-password"
                    type={showPwd ? 'text' : 'password'}
                    className="form-input with-prefix"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="input-suffix"
                    onClick={() => setShowPwd(!showPwd)}
                    onMouseDown={e => e.preventDefault()}
                    tabIndex={-1}
                    aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPwd ? <IconEyeOff size={16}/> : <IconEye size={16}/>}
                  </button>
                </div>
                <p className="login-hint">8 caractères minimum.</p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reset-confirm">Confirmer le mot de passe</label>
                <div className="input-wrap">
                  <IconLock size={16} className="input-prefix-icon"/>
                  <input
                    id="reset-confirm"
                    type="password"
                    className="form-input with-prefix"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="login-btn" loading={loading} aria-busy={loading}>
                {loading ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
              </Button>

              <div className="login-footer">
                <a href="/login">← Retour à la connexion</a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
