import React, { useState } from 'react';
import './SkillWorkspace.css';
import './Auth.css';
import { signIn, signUp } from '../lib/auth.js';

export function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(next) {
    setMode(next);
    setError('');
    setNotice('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    if (mode === 'signin') {
      const { data, error } = await signIn(email, password);
      setLoading(false);
      if (error) { setError(error.message); return; }
      onAuthenticated?.(data.session);
    } else {
      const { data, error } = await signUp(email, password);
      setLoading(false);
      if (error) { setError(error.message); return; }
      if (data.session) {
        onAuthenticated?.(data.session);
      } else {
        setNotice('Check your email to confirm your account before signing in.');
        setMode('signin');
      }
    }
  }

  return (
    <div className="sw-app auth-shell">
      <div className="auth-card">
        <a href="/" className="site-brand auth-brand"><span className="brand-skill">Skill</span><span className="brand-mark">mark.</span></a>
        <p className="sw-eyebrow">YOUR LEARNING WORKSPACE</p>
        <h1 className="auth-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}<span>.</span></h1>
        <p className="auth-subtitle">{mode === 'signin' ? 'Sign in to continue your skill map and roadmap.' : 'Start saving highlights and tracking your learning path.'}</p>
        <div className="auth-tabs" role="tablist" aria-label="Sign in or sign up">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Sign up</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label>Password<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <div className="sw-notice" role="status">✓ {notice}</div>}
          <button className="sw-button auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}</button>
        </form>
        <p className="auth-switch">
          {mode === 'signin'
            ? <>No account yet? <button type="button" className="sw-link" onClick={() => switchMode('signup')}>Sign up</button></>
            : <>Already have an account? <button type="button" className="sw-link" onClick={() => switchMode('signin')}>Sign in</button></>}
        </p>
        <a href="/" className="sw-link auth-back">← Back to the website</a>
      </div>
    </div>
  );
}
