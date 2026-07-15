import { SignIn } from '@clerk/clerk-react'

// Clerk renders its own fully accessible sign-in/sign-up UI, including
// phone number + OTP login — avoiding typed passwords entirely, which is
// a much better fit for screen reader users than a custom-built form.
export default function Auth() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px 24px', background: 'var(--bg)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src="/logo.png" alt="Echoes" style={{ width: 88, height: 88, borderRadius: 22, marginBottom: 16 }} />
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #fff 0%, var(--blue-bright) 70%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          Echoes
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 16, marginTop: 8 }}>
          Audio-first social. Built for every ear.
        </p>
      </div>

      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#2F8FFF',
            colorBackground: '#11172C',
            colorText: '#F5F7FA',
            colorTextSecondary: '#8B93A8',
            colorInputBackground: '#161D38',
            colorInputText: '#F5F7FA',
            borderRadius: '16px',
          },
        }}
      />
    </div>
  )
}
