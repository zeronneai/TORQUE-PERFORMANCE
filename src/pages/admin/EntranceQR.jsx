import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { PageHeader } from '../../components/UI'

const CHECKIN_URL = 'https://torque-performance.vercel.app/checkin'

export default function EntranceQR() {
  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #entrance-qr-print, #entrance-qr-print * { visibility: visible !important; }
          #entrance-qr-print { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="fade-in no-print">
        <PageHeader
          eyebrow="Academy"
          title="Entrance QR"
          subtitle="Print and place at the academy entrance — parents scan to check in"
        />
      </div>

      <div id="entrance-qr-print" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        {/* QR card */}
        <div style={{
          background: '#ffffff', borderRadius: 20, padding: '36px 36px 28px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 28 }}>⚾</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, letterSpacing: '0.06em', color: '#060d18', lineHeight: 1 }}>TORQUE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '0.18em', color: '#666', textTransform: 'uppercase' }}>PERFORMANCE</div>
            </div>
          </div>

          <QRCodeSVG
            value={CHECKIN_URL}
            size={260}
            level="H"
            includeMargin={false}
            fgColor="#060d18"
          />

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#060d18', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Escanea para registrar tu entrada
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4, fontFamily: 'monospace' }}>{CHECKIN_URL}</div>
          </div>
        </div>

        {/* Print button — hidden when printing */}
        <button
          className="no-print"
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 28px', borderRadius: 10,
            background: '#ffffff', color: '#060d18',
            border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Printer size={16} />
          Print QR Code
        </button>

        <div className="no-print" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
          This QR encodes <span style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)' }}>{CHECKIN_URL}</span>.
          Parents scan it at the entrance, log in with their Clerk account, and check in their player.
        </div>
      </div>
    </>
  )
}
