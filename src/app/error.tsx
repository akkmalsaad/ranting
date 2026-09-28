"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="mx-auto max-w-lg p-8"><h1>Unable to load this page</h1><p className="my-5 text-slate-600">Please try again. If this continues, ask your administrator to check the database connection and migration.</p><Button onClick={reset}>Try again</Button></main>;}
