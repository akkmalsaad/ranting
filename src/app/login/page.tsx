import Image from "next/image";
import Link from "next/link";
import { assets } from "@/lib/assets";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { signIn } from "./actions";
import { supabaseConfig } from "@/lib/supabase/config";
import { redirect } from "next/navigation";
export default function Login() {
  if(!supabaseConfig()) redirect("/setup");
  return <main className="grid min-h-screen lg:grid-cols-2"><section className="flex flex-col justify-between bg-[#071e30] p-8 text-white lg:p-16"><span className="text-sm font-semibold uppercase tracking-[.25em] text-emerald-300">Built for your club</span><div className="my-20 max-w-lg"><p className="text-4xl font-semibold leading-tight tracking-tight lg:text-6xl">Less admin.<br/>More time on<br/>the mat.</p><p className="mt-6 max-w-sm leading-7 text-slate-300">Your branches, your students, your community. Bring it all together in one workspace.</p></div><p className="text-sm text-slate-300">Independent clubs. One connected platform.</p></section><section className="flex items-center justify-center p-6 py-14"><div className="w-full max-w-sm"><Image src={assets.banner} alt="Ranting" className="mb-10 h-auto w-44" priority/><h1>Welcome back</h1><p className="mb-8 mt-3 text-slate-600">Sign in to your club workspace.</p><ActionForm action={signIn} submit="Sign in"><label>Email address<Input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Password<Input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label></ActionForm><p className="mt-8 text-sm leading-6 text-slate-500">Account access is provisioned by your Ranting administrator during initial setup. Contact them if you need access or a password reset.</p><Link href="/" className="mt-6 inline-block text-sm text-primary">Back to Ranting</Link></div></section></main>;
}
