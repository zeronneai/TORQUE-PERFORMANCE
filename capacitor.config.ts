import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.zeronne.torqueperformance',
  appName: 'Torque Performance',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0d1b2a',
    },
    StatusBar: {
      style: 'Dark',
      overlaysWebView: false,
      backgroundColor: '#0d1b2a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0d1b2a',
    preferredContentMode: 'mobile',
  },
}

export default config
