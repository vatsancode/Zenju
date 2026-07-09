import styles from './auth.module.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.page}>

      {/* Decorative cloud layer */}
      <svg
        className={styles.clouds}
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 320"
        preserveAspectRatio="xMidYMax slice"
      >
        {/* Left cloud cluster */}
        <circle cx="30"  cy="270" r="70"  fill="white" fillOpacity="0.90" />
        <circle cx="110" cy="238" r="92"  fill="white" fillOpacity="0.92" />
        <circle cx="220" cy="252" r="75"  fill="white" fillOpacity="0.91" />
        <circle cx="310" cy="265" r="58"  fill="white" fillOpacity="0.88" />
        <circle cx="175" cy="220" r="60"  fill="white" fillOpacity="0.85" />
        <ellipse cx="170" cy="300" rx="260" ry="50" fill="white" fillOpacity="0.95" />

        {/* Small mid-left cloud */}
        <circle cx="520" cy="295" r="38"  fill="white" fillOpacity="0.72" />
        <circle cx="568" cy="282" r="48"  fill="white" fillOpacity="0.72" />
        <circle cx="618" cy="292" r="36"  fill="white" fillOpacity="0.70" />
        <ellipse cx="568" cy="310" rx="88" ry="22" fill="white" fillOpacity="0.74" />

        {/* Right cloud cluster */}
        <circle cx="1410" cy="275" r="72"  fill="white" fillOpacity="0.90" />
        <circle cx="1328" cy="242" r="95"  fill="white" fillOpacity="0.92" />
        <circle cx="1218" cy="258" r="78"  fill="white" fillOpacity="0.91" />
        <circle cx="1128" cy="272" r="60"  fill="white" fillOpacity="0.88" />
        <circle cx="1275" cy="225" r="62"  fill="white" fillOpacity="0.85" />
        <ellipse cx="1275" cy="302" rx="265" ry="52" fill="white" fillOpacity="0.95" />

        {/* Bottom white fill — clouds merge with bottom edge */}
        <rect x="0" y="298" width="1440" height="30" fill="white" fillOpacity="0.98" />
      </svg>

      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <span>ZJ</span>
        </div>
        <span className={styles.logoText}>ZenJu</span>
      </div>

      <div className={styles.card}>
        {children}
      </div>

    </div>
  )
}
