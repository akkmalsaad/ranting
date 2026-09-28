import Link from "next/link";
export default function NotFound(){return <main className="mx-auto max-w-lg p-10"><h1>Page unavailable</h1><p className="my-5">This record does not exist or is outside your workspace.</p><Link href="/workspaces" className="text-primary underline">Return to your workspaces</Link></main>;}
