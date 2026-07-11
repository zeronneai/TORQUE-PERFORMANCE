import React from 'react'

// Catches render/runtime errors in its subtree and shows a fallback instead of
// letting one thrown error blank the whole app (white screen). Use a top-level
// boundary as a safety net, plus section-level boundaries so a page crash keeps
// the rest of the shell usable.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.label || '(app)', error, info)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error)
      return (
        <div style={{
          minHeight: this.props.full ? '100vh' : 260,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: 32, textAlign: 'center',
          color: 'var(--text)', background: 'var(--navy)',
        }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>⚾</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 380, lineHeight: 1.5 }}>
            This part of the app hit an error. Try reloading — the rest still works.
          </div>
          <button onClick={() => window.location.reload()} style={{
            marginTop: 6, padding: '10px 22px', borderRadius: 8,
            background: 'var(--ink)', color: 'var(--white)', border: 'none',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
            letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
