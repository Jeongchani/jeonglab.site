export type LaunchItem = {
  id: string
  label: string
  href: string
  description?: string
  scope: 'Tailnet' | 'Public'
  kind: 'Admin' | 'Monitor' | 'Docs' | 'App' | 'Repo'
  icon?: string // simple emoji for now
}

export const LAUNCHERS: LaunchItem[] = [
  {
    id: 'cockpit',
    label: 'Server Cockpit',
    href: 'https://just9-server.tail1fc4ba.ts.net:9090/system',
    description: '리눅스 서버 웹 관리(CPU/메모리/서비스/로그)',
    scope: 'Tailnet',
    kind: 'Admin',
    icon: '🖥️',
  },
  {
    id: 'ntfy',
    label: 'Uptime Alerts',
    href: 'https://ntfy.sh/jeong-uptime-1d3f9c7b6a',
    description: 'ntfy 토픽으로 업타임/알림 확인',
    scope: 'Public',
    kind: 'Monitor',
    icon: '🔔',
  },
  {
    id: 'dash',
    label: 'Internal Dashboard',
    href: 'http://100.72.252.62:3001/dashboard',
    description: 'Tailnet 내부 대시보드(모니터/제어)',
    scope: 'Tailnet',
    kind: 'Monitor',
    icon: '📊',
  },
  {
    id: 'pdf',
    label: 'PDF Hub',
    href: 'https://pdf.jeonglab.site',
    description: 'PDF 업로드/뷰어(학습자료 관리)',
    scope: 'Public',
    kind: 'Docs',
    icon: '📚',
  },
  {
    id: 'admin',
    label: 'API Admin',
    href: 'https://api.jeonglab.site/admin/',
    description: '서비스 백엔드 어드민(데이터 관리)',
    scope: 'Public',
    kind: 'Admin',
    icon: '🛠️',
  },
  // Personal
  {
    id: 'portfolio',
    label: 'Portfolio',
    href: 'https://jeongchani.github.io',
    description: '개인 포트폴리오',
    scope: 'Public',
    kind: 'App',
    icon: '💼',
  },
  {
    id: 'github',
    label: 'GitHub',
    href: 'https://github.com/jeongchani',
    description: '레포지토리/이슈/프로필',
    scope: 'Public',
    kind: 'Repo',
    icon: '🐙',
  },
]
