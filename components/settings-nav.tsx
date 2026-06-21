import Link from "next/link";
export function SettingsNav(){return <nav className="settings-nav"><Link href="/settings/profile">Profile</Link><Link href="/settings/privacy">Privacy</Link><Link href="/settings/security">Security</Link><Link href="/settings/notifications">Notifications</Link><Link href="/settings/integrations">Integrations</Link></nav>}
